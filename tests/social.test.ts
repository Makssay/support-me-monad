import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifySocial } from '../server/social';
const url = 'https://x.com/alice/status/123';
test('Missing configuration never marks a post as verified', async () => { assert.equal((await verifySocial(url, '')).status, 'unavailable'); });
test('Non-social contribution supports manual review', async () => { assert.equal((await verifySocial('', '')).status, 'manual'); });
test('API confirmation exposes only selected evidence', async () => { const mock = (async () => new Response(JSON.stringify({ id_str: '123', full_text: 'My useful contribution', user: { screen_name: 'alice', secret: 'private' }, favorite_count: 4, retweet_count: 1 }))) as typeof fetch; const result = await verifySocial(url, 'test-key', mock); assert.equal(result.status, 'verified'); assert.equal(result.author, 'alice'); assert.equal(result.likes, 4); assert.equal(JSON.stringify(result).includes('private'), false); });
test('API errors and mismatched post IDs never verify', async () => { const missing = (async () => new Response('', { status: 404 })) as typeof fetch; assert.equal((await verifySocial(url, 'test-key', missing)).status, 'not_found'); const fail = (async () => { throw new Error('API key in provider error'); }) as typeof fetch; const result = await verifySocial(url, 'test-key', fail); assert.equal(result.status, 'unavailable'); assert.equal(result.note.includes('key'), false); const mismatch = (async () => new Response(JSON.stringify({ id_str: '456', user: { screen_name: 'alice' }, full_text: 'Post' }))) as typeof fetch; assert.equal((await verifySocial(url, 'test-key', mismatch)).status, 'unavailable'); });

import { replyEligibility } from '../server/social';
import {missionEvidence,missionDefaults} from '../shared/model';
test('Reply evidence is scoped to the requested thread independently of reward format',()=>{
 const meta={...missionDefaults,category:'Replies',targetPost:'https://x.com/creator/status/10'};
 const evidence={status:'verified' as const,checkedAt:'',note:'Public post',text:'Useful reply',replyTo:'10'};
 assert.equal(missionEvidence(meta,evidence).status,'verified');
 for(const replyTo of ['11',undefined])assert.equal(missionEvidence(meta,{...evidence,replyTo}).status,'unsupported');
 assert.equal(evidence.status,'verified'); // Do not contaminate the global provider cache.
 assert.equal(missionEvidence({...meta,category:'Memes'},{...evidence,replyTo:'11'}).status,'verified');
});
const target={status:'verified' as const,checkedAt:'',postUrl:'https://x.com/creator/status/10',authorId:'99',text:'Original'};
const reply={status:'verified' as const,checkedAt:'',postUrl:url,authorId:'1',replyTo:'10',text:'Useful response SM-code',postedAt:'2026-10-08T12:00:00Z',note:''};
const original={...target,note:''};
test('Reply eligibility validates direct parent, connected X identity and mission publication time',()=>{
 const start=Date.parse('2026-10-08T11:59:00Z')/1000;const end=start+3600;
 assert.equal(replyEligibility(reply,original,'1',start,end),undefined);
 for(const data of [{...reply,replyTo:'11'},{...reply,authorId:'2'},{...reply,authorId:'99'},{...reply,postedAt:'2026-10-08T10:00:00Z'},{...reply,postedAt:'bad'},{...reply,authorId:undefined}])assert.ok(replyEligibility(data,original,'1',start,end));
 assert.ok(replyEligibility(reply,original,'1',start,end,'1'));
 assert.equal(replyEligibility({...reply,text:'A useful reply without any code'},original,'1',start,end),undefined);
 assert.ok(replyEligibility(reply,original,'',start,end));
 assert.equal(replyEligibility({...reply,postedAt:new Date(start*1000).toISOString()},original,'1',start,end),undefined);
 assert.ok(replyEligibility({...reply,postedAt:new Date(end*1000).toISOString()},original,'1',start,end));
});
