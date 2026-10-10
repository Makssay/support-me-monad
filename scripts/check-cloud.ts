import fs from 'node:fs';
import assert from 'node:assert/strict';
import { setDefaultResultOrder } from 'node:dns';
import deployment from '../deployment.json';
setDefaultResultOrder('ipv4first');
const env=JSON.parse(fs.readFileSync('.data/cloud-config.json','utf8'));
const origin=process.env.CLOUD_CHECK_ORIGIN||env.APP_ORIGIN;
async function request(path:string,init?:RequestInit){const r=await fetch(origin+path,{...init,signal:AbortSignal.timeout(120000)});const text=await r.text();let body:any;try{body=JSON.parse(text);}catch{throw new Error(`Cloud ${path} returned HTTP ${r.status} without JSON.`);}return {status:r.status,body};}
const config=await request('/api/config');assert.equal(config.status,200);assert.equal(config.body.chainId,10143);assert.equal(config.body.contractAddress.toLowerCase(),deployment.address.toLowerCase());assert.equal(config.body.local,false);
const scheduler=await fetch(origin+'/api/internal/tick',{method:'POST',signal:AbortSignal.timeout(15000)});assert.ok([401,404].includes(scheduler.status));
assert.equal((await request('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
const state=await request('/api/state');assert.equal(state.status,200);assert.ok(Array.isArray(state.body.missions));
const gateway=await fetch(env.D1_GATEWAY_URL+'/storage/acquire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:crypto.randomUUID()}),signal:AbortSignal.timeout(15000)});assert.equal(gateway.status,401);
const result={ok:true,chainId:config.body.chainId,contract:config.body.contractAddress,missions:state.body.missions.length,publicApi:true,unauthorizedSchedulerBlocked:true,unauthorizedStorageBlocked:true,unauthenticatedMembershipBlocked:true,checkedAt:new Date().toISOString()};
fs.writeFileSync('.data/cloud-smoke-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
