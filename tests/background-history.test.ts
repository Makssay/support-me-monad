import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundHistory } from '../server/background-history';
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('slow transaction-history indexing runs independently and deduplicates concurrent refreshes',async()=>{
 let finish!:()=>void,calls=0,updates=0;const wait=new Promise<void>(resolve=>{finish=resolve;});
 const refresh=backgroundHistory(async()=>{calls++;await wait;},()=>{updates++;});
 assert.equal(refresh(),undefined);refresh();await tick();assert.equal(calls,1);assert.equal(updates,0);
 finish();await tick();assert.equal(updates,1);refresh();await tick();assert.equal(calls,2);
});
test('history failure does not invalidate valid state and can retry on the next refresh',async()=>{
 let calls=0,updates=0;const refresh=backgroundHistory(async()=>{if(++calls===1)throw Error('RPC unavailable');},()=>{updates++;});
 refresh();await tick();assert.equal(updates,0);refresh();await tick();assert.equal(calls,2);assert.equal(updates,1);
});
