import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForWalletModal} from '../src/wallet-modal';

test('next request waits through the open modal and its closing cleanup',async()=>{
 let time=1000;
 await waitForWalletModal(()=>({open:time<1200,closedAt:1200}),()=>time,async ms=>{time+=ms;});
 assert.equal(time,1550);
});
test('an already closed modal needs no delay',async()=>{
 await waitForWalletModal(()=>({open:false,closedAt:0}),()=>1000,async()=>{assert.fail('unexpected delay');});
});
test('a stuck modal prevents a new transaction instead of overlapping requests',async()=>{
 let time=0;
 await assert.rejects(waitForWalletModal(()=>({open:true,closedAt:0}),()=>time,async ms=>{time+=ms;}),{code:'WALLET_REQUEST_PENDING'});
 assert.equal(time,10000);
});
