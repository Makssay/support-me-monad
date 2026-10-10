import test from 'node:test';
import assert from 'node:assert/strict';
import {checkXBlue,parseXCheckmark} from '../server/x-checkmark';
import {validatePolicy,policyHash,tierForCommunity} from '../shared/community';
test('blue checkmark uses stable ID and the documented users-by-ids status, never guesses missing evidence',()=>{
 assert.equal(parseXCheckmark({id_str:'123',verified:true},'123'),'verified');
 assert.equal(parseXCheckmark({id_str:'123',verified:false},'123'),'not_verified');
 assert.equal(parseXCheckmark({id_str:'456',verified:true},'123'),'unavailable');
 assert.equal(parseXCheckmark({id:123,verified:true},'123'),'unavailable');
 assert.equal(parseXCheckmark({id_str:'123',verified:'true'},'123'),'unavailable');
 assert.equal(parseXCheckmark({id_str:'123'},'123'),'unavailable');
 assert.equal(parseXCheckmark({id_str:'123',verified:true,is_blue_verified:false},'123'),'not_verified');
 for(const verified_type of ['business','government','gold','gray'])assert.equal(parseXCheckmark({id_str:'123',verified:true,verified_type},'123'),'not_verified');
 // Live SocialData responses for @X and @NASA use verification_info.type.
 for(const type of ['Business','Government'])assert.equal(parseXCheckmark({id_str:'123',verified:true,verification_info:{type}},'123'),'not_verified');
 assert.equal(parseXCheckmark({id_str:'123',verified:true,verified_type:'unknown'},'123'),'unavailable');
});
test('profile lookup sends a single ID, accepts explicit blue evidence and fails closed on provider errors',async()=>{
 let calls=0;
 const transport=(async(url:any,init:any)=>{calls++;assert.equal(url,'https://api.socialdata.tools/twitter/users-by-ids');assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body),{ids:['123']});return new Response(JSON.stringify({users:[{id_str:'123',verified:true}]}));}) as typeof fetch;
 assert.equal((await checkXBlue('123','test-only',transport)).status,'verified');assert.equal(calls,1);
 assert.equal((await checkXBlue('bad','test-only',transport)).status,'unavailable');assert.equal(calls,1);
 for(const status of [401,402,429,500])assert.equal((await checkXBlue('123','test-only',(async()=>new Response('',{status})) as typeof fetch)).status,'unavailable');
 assert.equal((await checkXBlue('123','test-only',(async()=>{throw new Error('private transport details');}) as typeof fetch)).status,'unavailable');
 assert.equal((await checkXBlue('123','test-only',(async()=>new Response(JSON.stringify({users:[]}))) as typeof fetch)).status,'unavailable');
});
test('blue-only policies are canonical, immutable, paid at X tier and combine with other requirements',()=>{
 const p=validatePolicy({xBlue:true});assert.deepEqual(p,{xBlue:true});assert.equal(tierForCommunity(p),1);
 const nft={kind:'list',addresses:['0x'+'11'.repeat(20)]};assert.notEqual(policyHash(validatePolicy({nft})),policyHash(validatePolicy({nft,xBlue:true})));
 assert.deepEqual(validatePolicy({xBlue:true,nft}),{nft,xBlue:true});assert.throws(()=>validatePolicy({xBlue:'true'}));assert.throws(()=>validatePolicy({xBlue:false}));
});
