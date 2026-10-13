import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityProfiles, identityProfile, identityWallets } from '../shared/identity-profiles';
import type { Profile, Contribution, Mission } from '../shared/model';
const a='0x1111111111111111111111111111111111111111', b='0x2222222222222222222222222222222222222222', other='0x3333333333333333333333333333333333333333';
const profile=(address:string,extra:Partial<Profile>={}):Profile=>({address,name:'Alice',username:'alice',xId:'123',submitted:1,accepted:1,earned:'0.01',completed:1,acceptanceRate:100,score:15,credits:'0',...extra});
const contribution=(id:number,contributor:string,missionId:number):Contribution=>({id,contributor,missionId,status:1,name:'Alice',text:'work',socialUrl:'',paid:'0.01'});
function fixture(){return {profiles:[profile(a),profile(b),profile(other,{xId:'456'})],contributions:[contribution(1,a,1),contribution(2,b,2),contribution(3,other,3)],missions:[{id:1,mode:0},{id:2,mode:0},{id:3,mode:0}] as Mission[]};}
test('Privy and external wallets with the same verified X ID have one ranking and combined history statistics',()=>{
 const state=fixture(), groups=identityProfiles(state), alice=groups.find(p=>p.xId==='123')!;
 assert.equal(groups.length,2);assert.deepEqual(alice.wallets,[a,b]);assert.equal(alice.accepted,2);assert.equal(alice.earned,'0.02');assert.equal(alice.completed,2);assert.equal(alice.score,30);
 assert.deepEqual(identityWallets(b,state.profiles),[a,b]);
});
test('The same handle on another verified X ID, or unverified wallet, never merges accounts',()=>{
 const state=fixture();state.profiles.push(profile('0x4444444444444444444444444444444444444444',{xId:undefined}));
 assert.equal(identityProfiles(state).length,3);assert.deepEqual(identityWallets(other,state.profiles),[other]);
});
test('Completed mission bonuses are counted once across wallets and random wins do not add Signal',()=>{
 const state=fixture();state.contributions[1].missionId=1;state.contributions.push({...contribution(4,b,4),randomReward:true});state.missions.push({id:4,mode:6} as Mission);state.profiles[1].submitted=2;state.profiles[1].accepted=2;
 const alice=identityProfiles(state).find(p=>p.xId==='123')!;assert.equal(alice.completed,2);assert.equal(alice.score,25);assert.equal(alice.acceptanceRate,100);
});
test('Shared profile selects the active member wallet and exposes only its claimable balances',()=>{
 const state=fixture();state.profiles[0].credits='3';state.profiles[1].credits='7';state.profiles[0].controllerCredits='2';state.profiles[1].controllerCredits='4';
 const asset={address:other,symbol:'QA',name:'QA',decimals:6,url:'https://example.com'} as any;
 state.profiles[0].tokenRewards=[{asset,earned:'1.000001',credits:'2'}];state.profiles[1].tokenRewards=[{asset,earned:'2',credits:'5'}];
 const external=identityProfile(state,'x-123',b)!;assert.equal(external.address,b);assert.equal(external.credits,'7');assert.equal(external.controllerCredits,'4');assert.equal(external.tokenRewards![0].earned,'3.000001');assert.equal(external.tokenRewards![0].credits,'5');
 assert.equal(identityProfile(state,b,a)!.address,a);assert.equal(identityProfile(state,'x-123',other)!.address,a);
 const publicGroup=identityProfiles(state).find(p=>p.xId==='123')!;assert.equal(publicGroup.credits,'0');assert.equal(publicGroup.tokenRewards![0].credits,'0');
});
test('Native reward totals preserve base-unit precision',()=>{
 const state=fixture();state.profiles[0].earned='0.000000000000000001';state.profiles[1].earned='9007199254740993.000000000000000001';
 assert.equal(identityProfiles(state).find(p=>p.xId==='123')!.earned,'9007199254740993.000000000000000002');
});
