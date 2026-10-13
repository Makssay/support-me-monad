import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import {spawn} from 'node:child_process';
import { promisify } from 'node:util';
import { transformSync } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('100 mixed clients keep writing during slow display collection; stale collectors cannot overwrite updates', {timeout:60000},async()=>{
 const script=transformSync(fs.readFileSync('cloudflare/worker.ts','utf8'),{loader:'ts',format:'esm'}).code;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-10-10',d1Databases:['DB'],bindings:{D1_GATEWAY_SECRET:'qa-only-gateway'}}));
 try{
  const db=await mf.getD1Database('DB');for(const sql of fs.readFileSync('cloudflare/schema.sql','utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
  const url=(await mf.ready).origin,env={...process.env,STORAGE_MODE:'d1',D1_GATEWAY_URL:url,D1_GATEWAY_SECRET:'qa-only-gateway'};
  const run=(code:string)=>promisify(execFile)(process.execPath,['--import','tsx','--input-type=module','-e',code],{env,windowsHide:true});
  const call=(path:string,body:unknown)=>fetch(url+path,{method:'POST',headers:{Authorization:'Bearer qa-only-gateway','Content-Type':'application/json'},body:JSON.stringify(body)});
  await run("import {jsonStore,durableOperation} from './server/persistence.ts';const s=jsonStore('.data/mixed-counter.json',{count:0});await durableOperation(async()=>{s.save()});");
  const collector=(conflict=false)=>{
   const code=`import {jsonStore,durableOperation} from './server/persistence.ts';const s=jsonStore('.data/mixed-display.json',{value:0});try{await durableOperation(async()=>{console.log('collecting');await new Promise(r=>setTimeout(r,4000));s.data.value++;s.save();},{collectionScopes:['.data/mixed-display.json']});console.log('collected');}catch(e){console.log(e.message);process.exitCode=${conflict?0:1};}`;
   const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',code],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
   const ready=new Promise<void>((resolve,reject)=>{child.stdout.on('data',d=>{output+=d;if(output.includes('collecting'))resolve();});child.on('error',reject);});
   const done=new Promise<string>((resolve,reject)=>{child.on('exit',c=>c===0?resolve(output):reject(new Error(output)));child.on('error',reject);});return {ready,done};
  };
  const slow=collector();await slow.ready;
  const held=await db.prepare('SELECT expires FROM app_lease WHERE id=1').first<{expires:number}>();assert.equal(held?.expires,0,'RPC collection holds no global lease');
  assert.equal((await call('/storage/collection-acquire',{owner:randomUUID()})).status,409,'only one collector may read Monad at a time');
  await call('/storage/collection-release',{owner:randomUUID()});
  assert.equal((await (await call('/storage/public-snapshot',{})).json() as any).busy,true,'a stale owner cannot release the collector; display reads know refresh is running');
  const started=Date.now();const timings:number[]=[];
  const writer="import {jsonStore,durableOperation} from './server/persistence.ts';const s=jsonStore('.data/mixed-counter.json',{count:0});for(let i=0;i<4;i++)await durableOperation(async()=>{s.data.count++;await new Promise(r=>setTimeout(r,15));s.save();});";
  await Promise.all([...Array.from({length:5},()=>run(writer)),...Array.from({length:95},async()=>{for(let i=0;i<3;i++){const t=Date.now();const response=await call('/storage/public-snapshot',{});assert.equal(response.status,200);await response.json();timings.push(Date.now()-t);}})]);
  assert.match(await slow.done,/collected/);
  const count=await db.prepare('SELECT value FROM app_records WHERE key=?').bind(JSON.stringify(['.data/mixed-counter.json','count'])).first<{value:string}>();assert.equal(count?.value,'20','all five independent writers persisted all updates');
  timings.sort((a,b)=>a-b);console.log(JSON.stringify({mixedClients:100,reads:285,writes:20,elapsedMs:Date.now()-started,readP95Ms:timings[Math.floor(timings.length*.95)]}));
  const stale=collector(true);await stale.ready;
  const owner=randomUUID();assert.equal((await call('/storage/acquire',{owner})).status,200);
  const key=JSON.stringify(['.data/mixed-display.json','value']);assert.equal((await call('/storage/commit',{owner,changes:[{key,value:'99'}]})).status,200);await call('/storage/release',{owner});
  assert.match(await stale.done,/Snapshot changed during collection/);assert.equal((await db.prepare('SELECT value FROM app_records WHERE key=?').bind(key).first<{value:string}>())?.value,'99');
  const denied=await run("import {jsonStore,durableOperation,checkpoint} from './server/persistence.ts';const s=jsonStore('.data/private-denied.json',{});await durableOperation(async()=>{try{s.save();throw Error('unsafe-save');}catch(e){if(!e.message.includes('private state'))throw e;}try{await checkpoint();throw Error('unsafe-checkpoint');}catch(e){if(!e.message.includes('forbidden'))throw e;}},{collectionScopes:['.data/mixed-display.json']});console.log('denied');");assert.match(denied.stdout,/denied/);
 }finally{await mf.dispose();}
});

test('indexed public reads stay small under 100 readers; paged snapshots exceed 3 MB without losing lease isolation', {timeout:60000},async()=>{
 const script=transformSync(fs.readFileSync('cloudflare/worker.ts','utf8'),{loader:'ts',format:'esm'}).code;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-10-10',d1Databases:['DB'],bindings:{D1_GATEWAY_SECRET:'qa-only-gateway'}}));
 try {
  const db=await mf.getD1Database('DB');for(const sql of fs.readFileSync('cloudflare/schema.sql','utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
  const insert=db.prepare('INSERT INTO app_records(key,value) VALUES(?,?)');
  for(let i=0;i<2000;i+=100)await db.batch(Array.from({length:100},(_,j)=>insert.bind(JSON.stringify(['.data/private.json','items',String(i+j)]),'0')));
  for(let i=0;i<20;i++)await insert.bind(JSON.stringify(['.data/large.json','items',String(i)]),JSON.stringify('x'.repeat(200000))).run();
  const publicKey=JSON.stringify(['.data/public-snapshot.json','time']);await insert.bind(publicKey,'123').run();
  const sql="SELECT key,value FROM app_records WHERE json_extract(key,'$[0]')='.data/public-snapshot.json'";
  const plan=await db.prepare('EXPLAIN QUERY PLAN '+sql).all<{detail:string}>();assert.match(JSON.stringify(plan.results),/app_records_scope_idx/);
  const measured=await db.prepare(sql).all();assert.ok(measured.meta.rows_read<50,'public lookup does not scan 2,021 records');
  const url=(await mf.ready).origin;
  const call=(path:string,body:unknown)=>fetch(url+path,{method:'POST',headers:{Authorization:'Bearer qa-only-gateway','Content-Type':'application/json'},body:JSON.stringify(body)});
  const owner=randomUUID();let page=await (await call('/storage/acquire',{owner,paginated:true})).json() as any;
  const keys=new Set<string>();let bytes=0,pages=0;
  for(;;){pages++;const size=Buffer.byteLength(JSON.stringify(page.rows));bytes+=size;assert.ok(size<600000);
   for(const row of page.rows){assert.ok(!keys.has(row.key));keys.add(row.key);}
   if(!page.cursor)break;
   page=await (await call('/storage/page',{owner,after:page.cursor})).json();
  }
  assert.equal(keys.size,2021);assert.ok(bytes>3000000);assert.ok(pages>1);
  const readers=await Promise.all(Array.from({length:100},async()=>{const r=await call('/storage/public-snapshot',{});assert.equal(r.status,200);return r.json() as Promise<any>;}));
  for(const result of readers){assert.equal(result.busy,true);assert.deepEqual(result.rows,[{key:publicKey,value:'123'}]);}
  assert.equal((await call('/storage/acquire',{owner:randomUUID(),paginated:true})).status,409);
  await call('/storage/release',{owner});assert.equal((await call('/storage/page',{owner,after:''})).status,409);
  const code="import {jsonStore,durableOperation} from './server/persistence.ts';const s=jsonStore('.data/large.json',{items:{}});await durableOperation(async()=>{if(Object.keys(s.data.items).length!==20||Object.values(s.data.items).some(v=>v.length!==200000))throw Error('Paged hydration lost data');s.data.items.extra='saved';s.save();console.log('paged-hydration-ok');});";
  const child=await promisify(execFile)(process.execPath,['--import','tsx','--input-type=module','-e',code],{env:{...process.env,STORAGE_MODE:'d1',D1_GATEWAY_URL:url,D1_GATEWAY_SECRET:'qa-only-gateway'},windowsHide:true});
  assert.match(child.stdout,/paged-hydration-ok/);
  const saved=await db.prepare('SELECT value FROM app_records WHERE key=?').bind(JSON.stringify(['.data/large.json','items','extra'])).first<{value:string}>();assert.equal(saved?.value,'"saved"');
 } finally {await mf.dispose();}
});

test('D1 gateway fences writers, persists across cold starts and fails closed without spending', {timeout:60000}, async()=>{
 const script=transformSync(fs.readFileSync('cloudflare/worker.ts','utf8'),{loader:'ts',format:'esm'}).code;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-10-10',d1Databases:['DB'],bindings:{D1_GATEWAY_SECRET:'qa-only-gateway',SCHEDULER_SECRET:'qa-only-scheduler',APP_ORIGIN:'https://example.invalid'}}));
 try{
  const db=await mf.getD1Database('DB');for(const sql of fs.readFileSync('cloudflare/schema.sql','utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
  const url=(await mf.ready).origin;
  const call=async(path:string,body:unknown,key='qa-only-gateway')=>fetch(url+path,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await call('/storage/acquire',{owner:randomUUID()},'wrong')).status,401);
  const first=randomUUID(),second=randomUUID();assert.equal((await call('/storage/acquire',{owner:first})).status,200);
  assert.equal((await call('/storage/acquire',{owner:second})).status,409);
  const publicRecord=JSON.stringify(['.data/public-snapshot.json','value','updatedAt']);
  assert.equal((await call('/storage/commit',{owner:first,changes:[{key:publicRecord,value:'"qa-snapshot"'}]})).status,200);
  const readOnly=await call('/storage/public-snapshot',{});
  assert.equal(readOnly.status,200);
  const view=await readOnly.json() as {rows:{key:string;value:string}[];busy:boolean};
  assert.equal(view.busy,true);assert.deepEqual(view.rows,[{key:publicRecord,value:'"qa-snapshot"'}]);
  assert.equal((await call('/storage/public-snapshot',{},'wrong')).status,401);
  assert.equal((await call('/storage/acquire',{owner:second})).status,409,'read-only snapshot does not release or acquire the writer lease');
  const record=JSON.stringify(['.data/qa-cloud.json','nested','saved']);
  assert.equal((await call('/storage/commit',{owner:first,changes:[{key:record,value:'7'}]})).status,200);
  await db.prepare('UPDATE app_lease SET expires=0 WHERE id=1').run();
  assert.equal((await call('/storage/acquire',{owner:second})).status,200);
  assert.equal((await call('/storage/commit',{owner:first,changes:[{key:record,value:'999'}]})).status,409);
  await call('/storage/release',{owner:first});
  assert.equal((await call('/storage/acquire',{owner:randomUUID()})).status,409,'stale owner cannot release a newer lease');
  await call('/storage/release',{owner:second});
  process.env.STORAGE_MODE='d1';process.env.D1_GATEWAY_URL=url;process.env.D1_GATEWAY_SECRET='qa-only-gateway';
  const {jsonStore,durableOperation,checkpoint}=await import('../server/persistence');
  const store=jsonStore('.data/qa-cloud.json',{nested:{saved:0},count:0,reserved:0});const nested=store.data.nested;
  await durableOperation(async()=>{assert.equal(nested.saved,7);store.data.count++;store.save();});
  await Promise.all(Array.from({length:6},()=>durableOperation(async()=>{const value=store.data.count;await new Promise(r=>setTimeout(r,4));store.data.count=value+1;store.save();})));
  assert.equal(store.data.count,7,'concurrent invocations do not lose increments');
  await assert.rejects(durableOperation(async()=>{store.data.reserved++;store.save();await checkpoint();throw new Error('Provider failed');}),/Provider failed/);
  await durableOperation(async()=>assert.equal(store.data.reserved,1,'provider failure does not restore the spent allowance'));
  const code="import {jsonStore,durableOperation} from './server/persistence.ts';const s=jsonStore('.data/qa-cloud.json',{nested:{saved:0},count:0,reserved:0});await durableOperation(async()=>{if(s.data.count!==7||s.data.reserved!==1)throw new Error('Cold start lost state');console.log('cold-start-ok')});";
  const child=await promisify(execFile)(process.execPath,['--import','tsx','--input-type=module','-e',code],{env:{...process.env},windowsHide:true});assert.match(child.stdout,/cold-start-ok/);
  let issued=false;await assert.rejects(durableOperation(async()=>{await db.prepare('UPDATE app_lease SET expires=0 WHERE id=1').run();await checkpoint();issued=true;}));assert.equal(issued,false,'no paid request or signature follows a rejected durable reservation');
  assert.equal(JSON.parse((await db.prepare('SELECT value FROM app_records WHERE key=?').bind(record).first<{value:string}>())!.value),7);
 }finally{await mf.dispose();}
});
