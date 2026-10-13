import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coalesceStateRead} from '../cloudflare/state-read';
import {publicEntrance} from '../cloudflare/public-proxy';
test('100 public readers share one in-flight read; subsequent refresh and private operations are independent',async()=>{
 let calls=0,finish!:()=>void;const wait=new Promise<void>(r=>finish=r);
 const read=async()=>{calls++;await wait;return Response.json({missions:[1]},{headers:{'Content-Length':'1','Content-Encoding':'gzip'}});};
 const readers=Array.from({length:100},()=>coalesceStateRead(new Request('https://example.test/api/state'),read));finish();
 for(const r of await Promise.all(readers)){assert.equal(r.headers.has('content-length'),false);assert.equal(r.headers.has('content-encoding'),false);assert.deepEqual(await r.json(),{missions:[1]});}assert.equal(calls,1);
 await coalesceStateRead(new Request('https://example.test/api/state'),read);assert.equal(calls,2);
 await Promise.all(Array.from({length:2},()=>coalesceStateRead(new Request('https://example.test/api/auth/session',{method:'POST'}),read)));assert.equal(calls,4);
});
test('delayed state is returned before a separate background refresh completes',async()=>{
 const tasks:Promise<unknown>[]=[];let finish!:()=>void;const blocked=new Promise<void>(r=>finish=r);const paths:string[]=[];
 const send=async(input:RequestInfo|URL)=>{const req=input as Request;paths.push(new URL(req.url).pathname);if(new URL(req.url).pathname==='/api/snapshot-refresh'){await blocked;return Response.json({ok:true});}return Response.json({missions:[]},{headers:{'X-State-Refresh-Needed':'1'}});};
 const response=await publicEntrance(new Request('https://example.test/api/state'),send as typeof fetch,{waitUntil:p=>tasks.push(p)});
 assert.equal(response.status,200);assert.equal(tasks.length,1);assert.deepEqual(paths,['/api/state','/api/snapshot-refresh']);finish();await Promise.all(tasks);
});
