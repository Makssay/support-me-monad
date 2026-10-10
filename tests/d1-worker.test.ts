import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { transformSync } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

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
