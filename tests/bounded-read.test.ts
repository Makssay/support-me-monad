import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedRead } from '../server/bounded-read';
test('bounded chain reads preserve order with at most three concurrent requests',async()=>{
 let active=0,max=0;const result=await boundedRead([1,2,3,4,5,6,7],async value=>{active++;max=Math.max(max,active);await new Promise<void>(resolve=>setImmediate(resolve));active--;return value*2;});
 assert.deepEqual(result,[2,4,6,8,10,12,14]);assert.equal(max,3);assert.equal(active,0);
});
test('bounded reads handle empty input and propagate failures without inventing data',async()=>{
 assert.deepEqual(await boundedRead([],async()=>{throw Error('Unexpected read');}),[]);
 await assert.rejects(boundedRead([1],async()=>{throw Error('RPC unavailable');}),/RPC unavailable/);
 await assert.rejects(boundedRead([1],async n=>n,0),/concurrency/);
});
