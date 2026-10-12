import test from 'node:test';
import assert from 'node:assert/strict';
import { isMissingChunk, recoverMissingChunk, registerRecoveryDraft, setWalletOperationPending } from '../src/deployment-recovery';

test('deployment recovery saves the draft and reloads once, but never interrupts wallet confirmation', () => {
 const original = Object.fromEntries(['sessionStorage','location','__APP_BUILD_ID__'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis,key)]));
 const values = new Map<string,string>(); let reloads=0; let saved=0;
 Object.defineProperties(globalThis, {
  __APP_BUILD_ID__: {value:'test-build',configurable:true},
  sessionStorage: {value:{getItem:(key:string)=>values.get(key),setItem:(key:string,value:string)=>values.set(key,value)},configurable:true},
  location: {value:{reload:()=>{reloads++;}},configurable:true}
 });
 const unregister=registerRecoveryDraft(()=>{saved++;});
 const chunk=new TypeError('Failed to fetch dynamically imported module: /assets/wallet-old.js');
 try {
  setWalletOperationPending(true);
  assert.equal(recoverMissingChunk(chunk),false);
  assert.equal(reloads,0);assert.equal(saved,0);
  setWalletOperationPending(false);
  assert.equal(recoverMissingChunk(new Error('User rejected the request')),false);
  assert.equal(recoverMissingChunk(chunk),true);
  assert.equal(saved,1);assert.equal(reloads,1);
  assert.equal(recoverMissingChunk(chunk),false);
  assert.equal(reloads,1);
 } finally {
  unregister();setWalletOperationPending(false);
  for (const [key,descriptor] of Object.entries(original)) { if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key); }
 }
});
test('only dynamic module failures trigger deployment recovery',()=>{
 assert.equal(isMissingChunk(new Error('Importing a module script failed.')),true);
 assert.equal(isMissingChunk(new Error('Loading chunk wallet failed')),true);
 assert.equal(isMissingChunk(new Error('Failed to fetch')),false);
 assert.equal(isMissingChunk({code:'ACTION_REJECTED'}),false);
});
