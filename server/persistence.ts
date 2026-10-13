import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

// Local development keeps its atomic files. Cloud invocations hydrate the same
// objects under one fenced D1 lease, so existing synchronous invariants remain
// valid across processes, cold starts and overlapping scheduled requests.
export const cloudStorage = process.env.STORAGE_MODE === 'd1';
type JsonObject = Record<string, any>;
const stores = new Map<string, { data: JsonObject; defaults: JsonObject; dirty: boolean }>();
let lease: string | undefined;
let leaseUntil = 0;
let previous = new Map<string, string>();
let localTail: Promise<void> = Promise.resolve();
let commitTail: Promise<void> = Promise.resolve();
let collectionScopes: Set<string> | undefined;
let jobContext:{owner:string;until:number}|undefined;
export function reconcile(target: JsonObject, source: JsonObject) {
 for (const key of Object.keys(target)) if (!Object.hasOwn(source, key)) delete target[key];
 for (const [key, value] of Object.entries(source)) {
  if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) reconcile(target[key], value);
  else target[key] = value;
 }
}
export function jsonStore<T extends JsonObject>(file: string, defaults: T) {
 let item = stores.get(file);
 if (!item) {
  const data = !cloudStorage && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : structuredClone(defaults);
  for (const [key, value] of Object.entries(defaults)) if (!Object.hasOwn(data, key)) data[key] = structuredClone(value);
  item = { data, defaults: structuredClone(defaults), dirty: false }; stores.set(file, item);
 }
 const data = item.data as T;
 return { data, save() {
  if (cloudStorage) { if(collectionScopes) { if(!collectionScopes.has(file))throw new Error('Collection cannot modify private state.'); } else assertLease(); item!.dirty = true; return; }
  fs.mkdirSync('.data', { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(data), { mode: 0o600 }); fs.renameSync(file + '.tmp', file);
 } };
}
export function assertLease() {
 if (cloudStorage && (!lease || Date.now() >= leaseUntil - 5000)) throw new Error('Durable storage is temporarily unavailable. Retry shortly.');
}
async function rpc(path: string, body: unknown) {
 const origin = process.env.D1_GATEWAY_URL; const secret = process.env.D1_GATEWAY_SECRET;
 if (!origin || !secret || !origin.startsWith('https://') && !origin.startsWith('http://127.0.0.1:')) throw new Error('Durable storage is not configured.');
 const started=Date.now();let response:Response;
 try{response=await fetch(origin + path, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });}
 catch(e){console.error(JSON.stringify({event:'storage_transport_failure',path,elapsedMs:Date.now()-started,reason:e instanceof Error?e.name:'unknown'}));throw e;}
 if (!response.ok) {const error=new Error(response.status === 409 ? 'Another operation is in progress. Retry shortly.' : 'Durable storage is temporarily unavailable. Retry shortly.');Object.assign(error,{status:response.status});throw error;}
 return response.json() as Promise<any>;
}
async function acquire(owner:string,shortLease=false){
 const until=Date.now()+20000;
 for(;;){try{return await rpc('/storage/acquire',{owner,paginated:true,shortLease});}catch(e){
  if((e as {status?:number}).status!==409||Date.now()>=until)throw e;
  await new Promise(r=>setTimeout(r,100+Math.floor(Math.random()*200)));
 }}
}
async function remainingPages(opened:any,owner:string){
 let cursor=opened.cursor,bytes=Buffer.byteLength(JSON.stringify(opened.rows));
 if(bytes>12000000)throw new Error('Storage capacity reached. Contact support.');
 while(cursor){assertLease();const page=await rpc('/storage/page',{owner,after:cursor});bytes+=Buffer.byteLength(JSON.stringify(page.rows));
  if(bytes>12000000||page.cursor&&page.cursor<=cursor)throw new Error('Storage capacity reached. Contact support.');
  opened.rows.push(...page.rows);cursor=page.cursor;
 }
}
// Partition by two map levels: each review, identity, policy and indexed event
// occupies its own row. Only changed rows are written; no full-file overwrites.
export function encodeStores(input: Map<string, JsonObject>) {
 const rows = new Map<string, string>();
 for (const [scope, data] of input) {
  for (const [a, value] of Object.entries(data)) {
   if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
    for (const [b, nested] of Object.entries(value)) rows.set(JSON.stringify([scope, a, b]), JSON.stringify(nested));
   } else rows.set(JSON.stringify([scope, a]), JSON.stringify(value));
  }
 }
 return rows;
}
export function decodeStores(rows: { key: string; value: string }[]) {
 const result = new Map<string, JsonObject>();
 for (const row of rows) {
  const [scope, a, b] = JSON.parse(row.key);
  if ([a,b].some(k => ['__proto__','constructor','prototype'].includes(k))) throw new Error('Invalid stored record.');
  const data = result.get(scope) || {}; result.set(scope, data);
  if (b === undefined) data[a] = JSON.parse(row.value);
  else { data[a] ||= {}; data[a][b] = JSON.parse(row.value); }
 }
 return result;
}
async function commitCheckpoint() {
 if (!cloudStorage) return;
 assertLease();
 const all = encodeStores(new Map([...stores].map(([key, s]) => [key, s.data])));
 const changes: { key: string; value: string | null }[] = [];
 for (const [key, value] of all) if (previous.get(key) !== value) changes.push({ key, value });
 for (const key of previous.keys()) if (stores.has(JSON.parse(key)[0]) && !all.has(key)) changes.push({ key, value: null });
 if (changes.length) await rpc('/storage/commit', { owner: lease, changes });
 else await rpc('/storage/assert', { owner: lease });
 for(const change of changes){if(change.value===null)previous.delete(change.key);else previous.set(change.key,change.value);}
 for (const s of stores.values()) s.dirty = false;
}
export function checkpoint() {
 if(!cloudStorage)return Promise.resolve();
 if(collectionScopes&&!jobContext)return Promise.reject(new Error('External effects are forbidden during detached collection.'));
 if(jobContext){const next=commitTail.then(commitJobCheckpoint);commitTail=next.catch(()=>{});return next;}
 const next=commitTail.then(commitCheckpoint);commitTail=next.catch(()=>{});return next;
}
async function commitJobCheckpoint(){
 const job=jobContext;
 if(!job||Date.now()>=job.until-5000)throw new Error('Executor lease expired.');
 const selected=new Map([...stores].filter(([key,s])=>collectionScopes!.has(key)&&s.dirty).map(([key,s])=>[key,s.data]));
 const all=encodeStores(selected),changes:{key:string;value:string|null}[]=[];
 for(const [key,value] of all)if(previous.get(key)!==value)changes.push({key,value});
 for(const key of previous.keys())if(selected.has(JSON.parse(key)[0])&&!all.has(key))changes.push({key,value:null});
 try{
  const current=await acquire(job.owner,true);lease=job.owner;leaseUntil=current.expires;await remainingPages(current,job.owner);
  const latest=new Map<string,string>(current.rows.map((r:any)=>[r.key,r.value]));
  if(changes.some(c=>latest.get(c.key)!==previous.get(c.key)))throw new Error('Executor state changed. Retry shortly.');
  await rpc('/storage/commit',{owner:job.owner,jobOwner:job.owner,changes});
  for(const c of changes){if(c.value===null)previous.delete(c.key);else previous.set(c.key,c.value);}
  for(const key of selected.keys())stores.get(key)!.dirty=false;
 }finally{try{await rpc('/storage/release',{owner:job.owner});}finally{lease=undefined;leaseUntil=0;}}
}
let publicRead:Promise<{data:any;busy:boolean}>|undefined;
let lastPublicRead:{data:any;busy:boolean}|undefined;
export async function readPublicSnapshot() {
 if(publicRead)return publicRead;
 publicRead=(async()=>{try{const result = await rpc('/storage/public-snapshot', {});
  lastPublicRead={data:decodeStores(result.rows).get('.data/public-snapshot.json'),busy:result.busy===true};return lastPublicRead;
 }catch(e){if(lastPublicRead?.data)return {data:{...lastPublicRead.data,time:0},busy:true};throw e;}})().finally(()=>{publicRead=undefined;});
 return publicRead;
}
export async function durableOperation<T>(operation: () => Promise<T>, options?: {collectionScopes: string[]}|{jobScopes:string[]}): Promise<T> {
 if (!cloudStorage) return operation();
 const before = localTail; let release!: () => void; localTail = new Promise<void>(r => { release = r; });
 await before;
 const owner = randomUUID();
 let collectionUntil=0;
 const isJob=!!options&&'jobScopes' in options;
 try {
  if(options){const held=await rpc(isJob?'/storage/job-acquire':'/storage/collection-acquire',{owner});collectionUntil=held.expires;}
  const opened = await acquire(owner,!!options); lease = owner; leaseUntil = opened.expires;
  // Older gateways return the complete snapshot without a cursor. New gateways
  // page under the same lease, so readers cannot observe interleaved writes.
  await remainingPages(opened,owner);
  const loaded = decodeStores(opened.rows); previous = new Map(opened.rows.map((r: any) => [r.key, r.value]));
  for (const [key, s] of stores) { const next = { ...structuredClone(s.defaults), ...loaded.get(key) }; reconcile(s.data, next); s.dirty = false; }
  if(options) {
   // Detached work holds its own lease. Display collection cannot checkpoint;
   // executor jobs must durably checkpoint their journal before broadcasting.
   await rpc('/storage/release',{owner});lease=undefined;leaseUntil=0;
   collectionScopes=new Set('jobScopes' in options?options.jobScopes:options.collectionScopes);
   if(isJob){jobContext={owner,until:collectionUntil};try{const result=await operation();await checkpoint();return result;}catch(e){await checkpoint();throw e;}}
   const result=await operation();
   const selected=new Map([...stores].filter(([key,s])=>collectionScopes!.has(key)&&s.dirty).map(([key,s])=>[key,s.data]));
   const all=encodeStores(selected);
   const changes:{key:string;value:string|null}[]=[];
   for(const [key,value] of all)if(previous.get(key)!==value)changes.push({key,value});
   for(const key of previous.keys())if(selected.has(JSON.parse(key)[0])&&!all.has(key))changes.push({key,value:null});
   collectionScopes=undefined;
   if(changes.length) {
    // Reacquire briefly and compare against the hydrated version before writing.
    // A concurrent update is rejected rather than overwritten or replayed.
    const current=await acquire(owner,true);lease=owner;leaseUntil=current.expires;
    await remainingPages(current,owner);
    if(Date.now()>=collectionUntil-5000)throw new Error('Collection lease expired.');
    const latest=new Map<string,string>(current.rows.map((r:any)=>[r.key,r.value]));
    if(changes.some(c=>latest.get(c.key)!==previous.get(c.key)))throw new Error('Snapshot changed during collection. Retry shortly.');
    await rpc('/storage/commit',{owner,changes});
   }
   return result;
  }
  try { const result = await operation(); await checkpoint(); return result; }
  catch (e) { await checkpoint(); throw e; }
 } finally {
  // The acquire response can be lost after D1 grants the lease. Release by our
  // unique owner even without a local acknowledgement; fencing protects peers.
  try { await rpc('/storage/release', { owner }); } catch { /* Expiry remains the last resort after a network outage. */ }
  if(options){try{await rpc(isJob?'/storage/job-release':'/storage/collection-release',{owner});}catch{/* Separate jobs never retain the public writer lease. */}}
  jobContext=undefined;collectionScopes=undefined;lease = undefined; leaseUntil = 0; release();
 }
}
