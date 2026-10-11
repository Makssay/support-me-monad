import {test,expect} from '@playwright/test';
import {HDNodeWallet,JsonRpcProvider,Contract} from 'ethers';
import fs from 'node:fs';
import {communityMessage,policyHash,validatePolicy} from '../shared/community';
const abi=JSON.parse(fs.readFileSync('shared/abi.json','utf8')),gateAbi=JSON.parse(fs.readFileSync('shared/community-abi.json','utf8'));
const provider=new JsonRpcProvider(process.env.QA_RPC_URL||'http://127.0.0.1:8546',31337,{batchMaxCount:1,cacheTimeout:-1});
const wallet=(i:number)=>HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,`m/44'/60'/0'/0/${i}`).connect(provider);
const creator=wallet(9),participant=wallet(10),holder=wallet(11),other=wallet(12);
test.afterAll(()=>provider.destroy());
test('Token gate rejects wrong contracts, precision, insufficient balance and wallet reuse; final check removes sold holdings and pauses on RPC failure',async({request})=>{
 for(const w of [creator,participant,holder,other])await provider.send('anvil_setBalance',[w.address,'0x56bc75e2d63100000']);
 const cfg=await(await request.get('/api/config')).json(),fixture=JSON.parse(fs.readFileSync('.data/local-reward-token.json','utf8'));
 const escrow=new Contract(cfg.contractAddress,abi,creator),gate=new Contract(cfg.communityGate,gateAbi,creator),token=new Contract(fixture.address,['function mint(address,uint256)','function transfer(address,uint256) returns(bool)'],holder);
 async function signed(w:HDNodeWallet,purpose:string,id:number|string){const timestamp=Date.now();return {wallet:w.address,timestamp,signature:await w.signMessage(communityMessage(purpose,31337,cfg.contractAddress,w.address,timestamp,id))};}
 async function post(path:string,data:any,ok=true){const r=await request.post('/api/community/'+path,{data});const v=await r.json();expect(r.ok(),JSON.stringify(v)).toBe(ok);return v;}
 async function prepare(policy:any,ok=true){return post('prepare',{...await signed(creator,'Prepare community policy',policyHash(policy)),policy,mode:6,quick:true},ok);}
 const policy=validatePolicy({token:{contract:fixture.address,minimum:'2.25'}});
 await prepare(validatePolicy({token:{contract:participant.address,minimum:'1'}}),false);
 expect((await prepare(validatePolicy({token:{contract:fixture.address,minimum:'0.0000001'}}),false)).error).toContain('precision');
 const summary=await prepare(policy);expect(summary.recheck).toBe(true);
 const deadline=Number((await provider.getBlock('latest'))!.timestamp)+300;
 await(await escrow.createGatedMission({token:'0x'+'0'.repeat(40),reward:10000000000000000n,slots:1,deadline,reviewWindow:300,mode:5,workWindow:300,protectedMode:true,pythReserve:200000000000000n,executionReserve:300000000000000000n,feeTier:0},JSON.stringify({title:'Token eligibility safety',category:'Token holders',communityHash:summary.hash,communitySummary:JSON.stringify(summary)}),summary.hash,true,300,0,'0x',{value:510200000000000000n})).wait();
 const id=Number(await escrow.missionCount());await request.post('/api/refresh');
 async function ticket(w:HDNodeWallet,ok=true){const c=await post('challenge',{...await signed(w,'Verify community',id),id});return post('ticket',{...await signed(w,'Verify community',id),id,nonce:c.nonce,nftSignature:await holder.signMessage(c.message)},ok);}
 const initial=BigInt(await new Contract(fixture.address,['function balanceOf(address) view returns(uint256)'],holder).balanceOf(holder.address));if(initial)await(await token.transfer(other.address,initial)).wait();
 expect((await ticket(participant,false)).error).toContain('minimum token balance');
 await(await token.mint(holder.address,2250000n)).wait();const t=await ticket(participant);await(await gate.authorize(id,participant.address,t.identities,t.validUntil,t.signature)).wait();await(await escrow.connect(participant).getFunction('enterCommunity')(id,'entry')).wait();
 expect((await ticket(other,false)).error).toContain('already entered');
 await(await token.transfer(other.address,1n)).wait();await provider.send('evm_setNextBlockTimestamp',[deadline+1]);await provider.send('evm_mine',[]);await request.post('/api/refresh');
 const code=await provider.getCode(fixture.address);await provider.send('anvil_setCode',[fixture.address,'0x']);
 try{await post('finalize',{...await signed(creator,'Finalize community',id),id},false);expect((await gate.policies(id)).finalized).toBe(false);}finally{await provider.send('anvil_setCode',[fixture.address,code]);}
 const final=await post('finalize',{...await signed(creator,'Finalize community',id),id});expect(final.args[1]).toEqual([Number((await escrow.raffleEntries(id))[0])]);await(await gate.finalize(...final.args)).wait();expect((await gate.policies(id)).eligibleCount).toBe(0n);
});
