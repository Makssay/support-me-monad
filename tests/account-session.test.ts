import test from 'node:test';
import assert from 'node:assert/strict';
import { accountSession } from '../src/account-session';

test('temporary storage contention and connection errors recover without logging out', async () => {
 const delays: number[] = []; let calls = 0;
 const result = await accountSession(async () => {
  calls++;
  if (calls === 1) return new Response(null, {status:503});
  if (calls === 2) throw new TypeError('Failed to fetch');
  return new Response('{"username":"tester"}', {status:200});
 }, () => true, async ms => { delays.push(ms); });
 assert.equal(result.status,200);assert.equal(calls,3);assert.deepEqual(delays,[500,1500]);
});

test('invalid credentials are returned immediately and storage retries are bounded', async () => {
 let calls=0;
 const unauthorized=await accountSession(async()=>{calls++;return new Response(null,{status:401});},()=>true,async()=>{});
 assert.equal(unauthorized.status,401);assert.equal(calls,1);
 calls=0;
 const unavailable=await accountSession(async()=>{calls++;return new Response(null,{status:503});},()=>true,async()=>{});
 assert.equal(unavailable.status,503);assert.equal(calls,4);
});

test('account changes cancel queued retries', async () => {
 let active=true;let calls=0;
 await assert.rejects(accountSession(async()=>{calls++;return new Response(null,{status:503});},()=>active,async()=>{active=false;}),{name:'AbortError'});
 assert.equal(calls,1);
});
