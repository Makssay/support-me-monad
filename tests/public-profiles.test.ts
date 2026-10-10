import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifiedIdentity } from '../server/public-profiles';
import { profilePath } from '../shared/model';
import type { IdentityUser, Member } from '../server/account-policy';
const address='0x1111111111111111111111111111111111111111';
const member:Member={userId:'test',xId:'123',username:'alice',joinedAt:1};
const wallet={type:'wallet',address,chain_type:'ethereum',wallet_client_type:'privy',connector_type:'embedded',verified_at:1};
test('Public X identity only maps verified embedded wallets and approved X pictures',()=>{
 const user:IdentityUser={id:'test',linked_accounts:[wallet,{...wallet,address:'0x2222222222222222222222222222222222222222',wallet_client_type:'metamask'},{type:'twitter_oauth',subject:'123',verified_at:1,name:'Alice',profile_picture_url:'https://pbs.twimg.com/profile_images/alice.jpg'}]};
 const identity=verifiedIdentity(user,member);
 assert.deepEqual(identity.wallets,[address]); assert.equal(identity.name,'Alice'); assert.equal(identity.avatarUrl,'https://pbs.twimg.com/profile_images/alice.jpg');
 user.linked_accounts[2].profile_picture_url='https://attacker.example/pixel';
 assert.equal(verifiedIdentity(user,member).avatarUrl,undefined);
});
test('Backup email login preserves X identity and payout history',()=>{
 const previous=verifiedIdentity({id:'test',linked_accounts:[wallet]},member);
 assert.deepEqual(verifiedIdentity({id:'test',linked_accounts:[]},member,previous),previous);
});
test('Profile links use immutable X ID and preserve old wallet fallback',()=>{
 assert.equal(profilePath(address,[{address,xId:'123'} as any]),'/profile/x-123');
 assert.equal(profilePath(address),`/profile/${address}`);
});
