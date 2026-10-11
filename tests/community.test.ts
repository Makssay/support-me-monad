import test from 'node:test';import assert from 'node:assert/strict';
import {parseParticipantList,validatePolicy,policyHash,selectTopHolders} from '../shared/community';
import {seal,unseal} from '../server/community-store';
const a='0x'+'11'.repeat(20),b='0x'+'22'.repeat(20);

test('token rules commit the exact contract and decimal balance without floating point rounding',()=>{
 const p=validatePolicy({token:{contract:a,minimum:'1000.2500'}});assert.deepEqual(p.token,{contract:a,minimum:'1000.25'});
 assert.equal(policyHash(p),policyHash(validatePolicy({token:{contract:a,minimum:'1000.25'}})));
 assert.notEqual(policyHash(p),policyHash(validatePolicy({token:{contract:b,minimum:'1000.25'}})));
 for(const minimum of ['0','0.00','-1','1e18','NaN','1,000','0.'+'0'.repeat(36)+'1'])assert.throws(()=>validatePolicy({token:{contract:a,minimum}}));
 assert.throws(()=>validatePolicy({token:{contract:'0x'+'00'.repeat(20),minimum:'1'}}));
 assert.equal(validatePolicy({token:{contract:a,minimum:'0.000001'}}).token?.minimum,'0.000001');
});
test('participant imports preserve Discord precision and report errors without silently dropping rows',()=>{const id='18446744073709551615';const r=parseParticipantList('\uFEFFdiscord_id\r\n"'+id+'"\r\n'+id+'\r\n1e18\r\n18446744073709551616','discord');assert.deepEqual(r.values,[id]);assert.equal(r.duplicates,1);assert.deepEqual(r.invalid,[4,5]);});
test('wallet lists normalize, deduplicate and reject invalid mixed checksums/extra columns',()=>{const r=parseParticipantList('address\n'+a+'\n'+a+'\n'+b+',other','wallet');assert.deepEqual(r.values,[a]);assert.equal(r.duplicates,1);assert.deepEqual(r.invalid,[4]);});
test('policy commitments are canonical and cannot hide changes to the organizer list',()=>{const one=validatePolicy({nft:{kind:'list',addresses:[b,a,a]}}),two=validatePolicy({nft:{kind:'list',addresses:[a,b]}});assert.equal(policyHash(one),policyHash(two));assert.notEqual(policyHash(one),policyHash(validatePolicy({nft:{kind:'list',addresses:[a]}})));assert.throws(()=>validatePolicy({}));assert.throws(()=>validatePolicy({discord:{kind:'list',ids:['123']}}));});
test('combined gate preserves both conditions and NFT token identity',()=>{const p=validatePolicy({discord:{kind:'role',guildId:'123456789012345678',roleId:'223456789012345678'},nft:{kind:'hold',contract:a,standard:'1155',tokenId:'99999999999999999999',minimum:'2'}});assert.equal(p.discord?.roleId,'223456789012345678');assert.equal(p.nft?.tokenId,'99999999999999999999');assert.throws(()=>validatePolicy({nft:{kind:'hold',contract:a,standard:'721',minimum:'0'}}));});
test('strict top N requires randomness only at an actual cutoff tie',()=>{const h=[{address:a,quantity:3},{address:b,quantity:2},{address:'0x'+'33'.repeat(20),quantity:2}];const waiting=selectTopHolders(h,2);assert.deepEqual(waiting.selected,[a]);assert.equal(waiting.places,1);assert.equal(waiting.boundary.length,2);for(let i=0;i<20;i++){const r=selectTopHolders(h,2,'seed'+i);assert.equal(r.selected.length,2);assert.equal(new Set(r.selected).size,2);assert.equal(r.selected[0],a);assert.deepEqual(r,selectTopHolders(h,2,'seed'+i));}assert.equal(selectTopHolders(h,10).selected.length,3);assert.equal(selectTopHolders(h,1).boundary.length,0);});
test('Discord tokens are encrypted and authenticated at rest',()=>{const clear='test-only-oauth-token';const encrypted=seal(clear);assert.notEqual(encrypted,clear);assert.equal(unseal(encrypted),clear);const damaged=Buffer.from(encrypted,'base64');damaged[damaged.length-1]^=1;assert.throws(()=>unseal(damaged.toString('base64')));});
