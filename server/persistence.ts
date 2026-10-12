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
  if (cloudStorage) { assertLease(); item!.dirty = true; return; }
  fs.mkdirSync('.data', { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(data), { mode: 0o600 }); fs.renameSync(file + '.tmp', file);
 } };
}
export function assertLease() {
 if (cloudStorage && (!lease || Date.now() >= leaseUntil - 5000)) throw new Error('Durable storage is temporarily unavailable. Retry shortly.');
}
async function rpc(path: string, body: unknown) {
 const origin = process.env.D1_GATEWAY_URL; const secret = process.env.D1_GATEWAY_SECRET;
 if (!origin || !secret || !origin.startsWith('https://') && !origin.startsWith('http://127.0.0.1:')) throw new Error('Durable storage is not configured.');
 const response = await fetch(origin + path, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
 if (!response.ok) throw new Error(response.status === 409 ? 'Another operation is in progress. Retry shortly.' : 'Durable storage is temporarily unavailable. Retry shortly.');
 return response.json() as Promise<any>;
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
 const next=commitTail.then(commitCheckpoint);commitTail=next.catch(()=>{});return next;
}
export async function readPublicSnapshot() {
 const result = await rpc('/storage/public-snapshot', {});
 return { data:decodeStores(result.rows).get('.data/public-snapshot.json'), busy:result.busy===true };
}
export async function durableOperation<T>(operation: () => Promise<T>): Promise<T> {
 if (!cloudStorage) return operation();
 const before = localTail; let release!: () => void; localTail = new Promise<void>(r => { release = r; });
 await before;
 const owner = randomUUID();
 try {
  const opened = await rpc('/storage/acquire', { owner }); lease = owner; leaseUntil = opened.expires;
  const loaded = decodeStores(opened.rows); previous = new Map(opened.rows.map((r: any) => [r.key, r.value]));
  for (const [key, s] of stores) { const next = { ...structuredClone(s.defaults), ...loaded.get(key) }; reconcile(s.data, next); s.dirty = false; }
  try { const result = await operation(); await checkpoint(); return result; }
  catch (e) { await checkpoint(); throw e; }
 } finally {
  if (lease === owner) { try { await rpc('/storage/release', { owner }); } catch { /* Expiring lease is safe; never unlock another owner. */ } }
  lease = undefined; leaseUntil = 0; release();
 }
}
