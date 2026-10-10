import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifySocial } from '../server/social';
const url = 'https://x.com/alice/status/123';
test('Missing configuration never marks a post as verified', async () => { assert.equal((await verifySocial(url, '')).status, 'unavailable'); });
test('Non-social contribution supports manual review', async () => { assert.equal((await verifySocial('', '')).status, 'manual'); });
test('API confirmation exposes only selected evidence', async () => { const mock = (async () => new Response(JSON.stringify({ id_str: '123', full_text: 'My useful contribution', user: { screen_name: 'alice', secret: 'private' }, favorite_count: 4, retweet_count: 1 }))) as typeof fetch; const result = await verifySocial(url, 'test-key', mock); assert.equal(result.status, 'verified'); assert.equal(result.author, 'alice'); assert.equal(result.likes, 4); assert.equal(JSON.stringify(result).includes('private'), false); });
test('API errors and mismatched post IDs never verify', async () => { const missing = (async () => new Response('', { status: 404 })) as typeof fetch; assert.equal((await verifySocial(url, 'test-key', missing)).status, 'not_found'); const fail = (async () => { throw new Error('API key in provider error'); }) as typeof fetch; const result = await verifySocial(url, 'test-key', fail); assert.equal(result.status, 'unavailable'); assert.equal(result.note.includes('key'), false); const mismatch = (async () => new Response(JSON.stringify({ id_str: '456', user: { screen_name: 'alice' }, full_text: 'Post' }))) as typeof fetch; assert.equal((await verifySocial(url, 'test-key', mismatch)).status, 'unavailable'); });

import { replyEligibility } from '../server/social';
const target={status:'verified' as const,checkedAt:'',postUrl:'https://x.com/creator/status/10',authorId:'99',text:'Original'};
const reply={status:'verified' as const,checkedAt:'',postUrl:url,authorId:'1',replyTo:'10',text:'Useful response SM-code',postedAt:'2026-10-08T12:00:00Z',note:''};
const original={...target,note:''};
test('Reply eligibility validates direct parent, ownership code, author and time',()=>{
 const start=Date.parse('2026-10-08T11:59:00Z')/1000;const end=start+3600;
 assert.equal(replyEligibility(reply,original,'SM-code',start,end),undefined);
 for(const data of [{...reply,replyTo:'11'},{...reply,text:'Stolen reply'},{...reply,authorId:'99'},{...reply,postedAt:'2026-10-08T10:00:00Z'},{...reply,postedAt:'bad'},{...reply,authorId:undefined}])assert.ok(replyEligibility(data,original,'SM-code',start,end));
 assert.ok(replyEligibility(reply,original,'SM-code',start,end,'1'));
 assert.ok(replyEligibility({...reply,text:'NotSM-code'},original,'SM-code',start,end));
});
