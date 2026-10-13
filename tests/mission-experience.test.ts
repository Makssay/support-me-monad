import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missionPhase,personalNextStep,rewardTerms,accessFailureKind,rewardsExhausted} from '../shared/mission-experience';
import {missionDefaults,type Mission,type Contribution} from '../shared/model';
import {readDraft,draftKey} from '../src/contribution-draft';
const mission:Mission={...missionDefaults,id:1,creator:'0xabc',mode:0,reward:'1',remaining:'1',deadline:100,reviewDeadline:200,recoveryAt:300,closed:false,automation:{enabled:true,pythReserve:'1',executionReserve:'1'}};

test('Last reward ends entry and review guidance before deadlines, without hiding payout claims',()=>{
 const paid={...mission,remaining:'0'};
 for(const now of [99,150,301])assert.equal(missionPhase(paid,now),'rewarded');
 for(const wallet of ['',mission.creator,'0xdef'])assert.match(personalNextStep(paid,[],wallet,99),/no longer accepting entries/);
 const entry={id:1,contributor:'0xdef',status:1,transferred:false} as Contribution;
 assert.match(personalNextStep(paid,[entry],'0xdef',99),/ready to claim/);
 assert.equal(missionPhase({...paid,closed:true},99),'closed');
 assert.equal(missionPhase({...paid,recovery:{active:true,scanned:false,eligible:0,processed:0}},301),'recovery');
 assert.equal(missionPhase({...paid,draw:{sequence:'1',provider:'',seed:'',requested:true,ready:true,settled:false}},99),'settling');
});

test('Remaining reward comparison preserves token base units and requires a positive reward',()=>{
 assert.equal(rewardsExhausted({...mission,reward:'1000000000.000000000000000001',remaining:'1000000000'}),true);
 assert.equal(rewardsExhausted({...mission,reward:'0.000000000000000001',remaining:'0.000000000000000001'}),false);
 assert.equal(rewardsExhausted({...mission,reward:'0',remaining:'0'}),false);
 assert.equal(missionPhase({...mission,remaining:'0.5'},99),'rewarded');
});
test('Creator missed review enters fallback, missing oracle enters recovery; timely seed still settles',()=>{
 assert.equal(missionPhase({...mission,mode:6,closed:true},301),'cancelled');assert.equal(missionPhase(mission,99),'open');assert.equal(missionPhase(mission,150),'review');assert.equal(missionPhase(mission,201),'fallback');
 assert.equal(missionPhase(mission,300),'recovery');
 assert.equal(missionPhase({...mission,draw:{sequence:'1',provider:'',seed:'',requested:true,ready:true,settled:false}},301),'settling');
 assert.equal(missionPhase({...mission,closed:true,recovery:{active:true,scanned:true,eligible:2,processed:2}},301),'refunded');
});
test('Legacy unprotected missions never promise oracle recovery or automatic payouts',()=>{
 const legacy={...mission,automation:undefined};assert.equal(missionPhase(legacy,301),'expired');assert.equal(rewardTerms(legacy).outage,undefined);
 assert.equal(rewardTerms({...legacy,mode:1}).timeout,'Unreviewed work does not automatically receive payment.');
 assert.equal(rewardTerms({...mission,mode:5}).outage,undefined);
});
test('Personal action distinguishes selection, accepted credit, creator and closed outage',()=>{
 const c={id:1,contributor:'0xdef',status:3} as Contribution;
 assert.match(personalNextStep(mission,[c],'0xDEF',101),/Wait for selection/);
 assert.match(personalNextStep(mission,[{...c,status:1,transferred:false}],'0xdef',101),/claim/);
 assert.match(personalNextStep(mission,[],'0xabc',150),/Review submissions/);
 assert.match(personalNextStep({...mission,closed:true,recovery:{active:true,scanned:true,eligible:1,processed:1}},[{...c,status:6}],'0xdef',301),/not judged/);
});
test('Provider outage and missing identity never masquerade as failed eligibility',()=>{
 assert.equal(accessFailureKind('Your NFT wallet does not meet the published requirement.'),'denied');
 assert.equal(accessFailureKind('Your linked X account does not have the required blue checkmark.'),'denied');
 assert.equal(accessFailureKind('Community verification is unavailable. No eligibility decision was made. Retry later.'),'unavailable');
 assert.equal(accessFailureKind('Connect Discord to verify this requirement.'),'action');
});
test('Drafts isolate account, chain, contract, mission and selected delivery',()=>{
 const key=draftKey(10143,'0xABC','0xDEF','1',false);assert.equal(key,draftKey(10143,'0xabc','0xdef','1',false));
 for(const other of [draftKey(143,'0xabc','0xdef','1',false),draftKey(10143,'0xaaa','0xdef','1',false),draftKey(10143,'0xabc','0xaaa','1',false),draftKey(10143,'0xabc','0xdef','2',false),draftKey(10143,'0xabc','0xdef','1',true)])assert.notEqual(key,other);
});
test('Draft recovery rejects malformed, expired and oversized local data',()=>{
 const now=Date.now(),draft={version:1,savedAt:now,name:'Name',text:'Report',url:'https://x.com/a/status/1',signature:'never restore',agreed:true};
 const read=(value:unknown)=>readDraft({getItem:()=>JSON.stringify(value)},'key',now);
 assert.deepEqual(read(draft),{name:draft.name,text:draft.text,url:draft.url});
 assert.equal(read({...draft,savedAt:now-31*86400000}),undefined);assert.equal(read({...draft,text:'a'.repeat(2601)}),undefined);assert.equal(read({}),undefined);
 assert.equal(readDraft({getItem:()=>{throw new Error('storage blocked');}},'key'),undefined);
});
