import test from 'node:test';
import assert from 'node:assert/strict';
import {publicSnapshot} from '../server/public-snapshot';
import {coalesceLoad} from '../src/coalesce-load';
const data={time:20000,value:{config:{chainId:10143,contractAddress:'0xABC'},missions:[],contributions:[],profiles:[],updatedAt:'2026-10-13T00:00:00Z'}};
test('persisted display snapshots retain timestamp and mark delayed data explicitly',()=>{
 assert.equal(publicSnapshot(data,10143,'0xabc',30000)?.stale,false);
 const stale=publicSnapshot(data,10143,'0xabc',40000);
 assert.equal(stale?.stale,true);assert.equal(stale?.updatedAt,data.value.updatedAt);
 assert.equal(publicSnapshot({...data,time:0},10143,'0xabc',40000)?.stale,true);
});
test('cached state cannot cross chain or deployment and malformed data is discarded',()=>{
 assert.equal(publicSnapshot(data,143,'0xabc',30000),undefined);
 assert.equal(publicSnapshot(data,10143,'0xdef',30000),undefined);
 assert.equal(publicSnapshot({...data,time:50000},10143,'0xabc',30000),undefined);
 assert.equal(publicSnapshot({value:{}},10143,'0xabc',30000),undefined);
});
test('overlapping read requests share a single result and allow a fresh follow-up',async()=>{
 let calls=0;let resolve!:(value:number)=>void;
 const read=coalesceLoad(()=>{calls++;return new Promise<number>(r=>{resolve=r;});});
 const a=read(),b=read();await Promise.resolve();assert.equal(calls,1);assert.equal(a,b);
 resolve(7);assert.equal(await a,7);
 const c=read();await Promise.resolve();assert.equal(calls,2);resolve(8);assert.equal(await c,8);
});
test('failed reads release the request slot for recovery',async()=>{
 let calls=0;const read=coalesceLoad(async()=>{if(++calls===1)throw Error('offline');return 1;});
 await assert.rejects(read(),/offline/);assert.equal(await read(),1);assert.equal(calls,2);
});
