import test from 'node:test';
import assert from 'node:assert/strict';
import {WalletRequest} from '../src/wallet-request';
import {setImmediate} from 'node:timers/promises';
test('SDK success event resolves once before its modal promise finishes',async()=>{
 const wallet=new WalletRequest();let finish!:(v:{hash:string})=>void;
 const result=wallet.run(()=>new Promise(resolve=>{finish=resolve;}));
 await Promise.resolve();wallet.success('0xfirst');assert.equal(await result,'0xfirst');
 await assert.rejects(wallet.run(async()=>({hash:'0xduplicate'})),{code:'WALLET_REQUEST_PENDING'});
 finish({hash:'0xfirst'});await setImmediate();
 assert.equal(await wallet.run(async()=>({hash:'0xnext'})),'0xnext');
});
test('SDK cancellation event releases the UI but does not resend an unresolved payment',async()=>{
 const wallet=new WalletRequest();let fail!:(e:unknown)=>void;let calls=0;
 const cancelled=wallet.run(()=>{calls++;return new Promise((_,reject)=>{fail=reject;});});
 const expected=assert.rejects(cancelled,{code:'ACTION_REJECTED'});await Promise.resolve();
 wallet.failure({code:'ACTION_REJECTED'});await expected;
 await assert.rejects(wallet.run(async()=>{calls++;return{hash:'0xduplicate'};}),{code:'WALLET_REQUEST_PENDING'});assert.equal(calls,1);
 fail({code:'ACTION_REJECTED'});await setImmediate();
 assert.equal(await wallet.run(async()=>({hash:'0xnew'})),'0xnew');
});
test('Promise failures allow a fresh manual request and never trigger automatic fallback',async()=>{
 const wallet=new WalletRequest();let calls=0;
 await assert.rejects(wallet.run(async()=>{calls++;throw new Error('SDK failed');}),/SDK failed/);
 assert.equal(calls,1);assert.equal(await wallet.run(async()=>({hash:'0xmanual'})),'0xmanual');
});
