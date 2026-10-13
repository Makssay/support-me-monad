import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startSnapshotPolling} from '../src/snapshot-polling';
test('background tabs stop polling; returning refreshes immediately and active polling halves request rate',async()=>{
 let visibility='visible',listener=()=>{},pending:(()=>void)|undefined,delay=0,calls=0;
 const page={get visibilityState(){return visibility;},addEventListener(_t:string,l:()=>void){listener=l;},removeEventListener(){listener=()=>{};}};
 const timers={set(cb:()=>void,ms:number){pending=cb;delay=ms;return cb;},clear(){pending=undefined;}};
 const stop=startSnapshotPolling(async()=>{calls++;},()=>true,page,timers);
 assert.equal(delay,30000);assert.equal(calls,0);
 pending!();await Promise.resolve();await Promise.resolve();assert.equal(calls,1);
 visibility='hidden';listener();assert.equal(pending,undefined);
 visibility='visible';listener();await Promise.resolve();await Promise.resolve();assert.equal(calls,2);assert.equal(delay,30000);
 stop();assert.equal(pending,undefined);
});
test('polling neither overlaps slow reads nor runs during wallet operations; failures remain recoverable',async()=>{
 let listener=()=>{},pending:(()=>void)|undefined,busy=true,calls=0,release!:()=>void;
 const page={visibilityState:'visible',addEventListener(_t:string,l:()=>void){listener=l;},removeEventListener(){}};
 const timers={set(cb:()=>void){pending=cb;return cb;},clear(){pending=undefined;}};
 const stop=startSnapshotPolling(async()=>{calls++;await new Promise<void>(r=>release=r);throw Error('offline');},()=>!busy,page,timers);
 pending!();await Promise.resolve();await Promise.resolve();assert.equal(calls,0);
 busy=false;pending!();listener();assert.equal(calls,1);
 release();await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.ok(pending);
 stop();
});
