import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshAfterReceipt} from '../src/refresh-after-receipt';

test('a hung post-receipt refresh releases the completed wallet operation', async () => {
 let calls=0;
 await refreshAfterReceipt(()=>{calls++;return new Promise<void>(()=>{});},10);
 assert.equal(calls,1);
});
test('a failed refresh does not turn a mined receipt into transaction failure',async()=>{
 let calls=0;
 await refreshAfterReceipt(async()=>{calls++;throw Error('offline');},10);
 assert.equal(calls,1);
});
test('normal refresh completes without waiting for the deadline',async()=>{
 let complete=false;
 await refreshAfterReceipt(async()=>{complete=true;},60000);
 assert.equal(complete,true);
});
