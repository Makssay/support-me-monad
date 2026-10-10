import fs from 'node:fs';
import {Contract,Interface,parseEther,formatEther} from 'ethers';
import {checkedProvider,deployer,safeFailure} from './env';
import abi from '../shared/abi.json';
// Testnet-only protocol QA. Journals contain public addresses and transaction hashes only.
const file='.data/safety-live.json';
const p=await checkedProvider();
try{
 const d=JSON.parse(fs.readFileSync('deployment.json','utf8'));if(d.version!==7)throw new Error('V7 required');
 const w=deployer(p),c=new Contract(d.address,abi,w),iface=new Interface(abi);
 const qa=JSON.parse(fs.readFileSync('.data/gas-sponsorship-qa.json','utf8'));
 const j:any=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{contract:d.address,contributor:qa.wallet.address,transactions:[]};
 if(j.contract!==d.address||!qa.wallet.id||qa.wallet.address.toLowerCase()===w.address.toLowerCase())throw new Error('QA identity mismatch');
 const save=()=>fs.writeFileSync(file,JSON.stringify(j,null,2));
 async function receipt(tx:any){j.transactions.push(tx.hash);save();const r=await tx.wait();if(r.status!==1)throw new Error('Receipt failed');return r;}
 async function sponsored(method:string,id:number,key:string){
  if(j[key])return;
  async function reconcile(){if(!await c.hasSubmitted(id,j.contributor))return false;const tip=await p.getBlockNumber();const start=(await p.getTransactionReceipt(j.transactions[0]))!.blockNumber;for(let from=start;from<=tip;from+=100){for(const log of await c.queryFilter(c.filters.ContributionSubmitted(null,id),from,Math.min(tip,from+99))){const event=iface.parseLog(log);if(event?.args.contributor.toLowerCase()===j.contributor.toLowerCase()){j[key]=log.transactionHash;if(!j.transactions.includes(log.transactionHash))j.transactions.push(log.transactionHash);save();return true;}}}return false;}
  if(await reconcile())return;if(j[key+'Requested'])throw new Error('Ambiguous sponsored request');j[key+'Requested']=true;save();
  const r=await fetch(`https://api.privy.io/v1/wallets/${qa.wallet.id}/rpc`,{method:'POST',headers:{'Content-Type':'application/json','privy-app-id':process.env.PRIVY_APP_ID!,Authorization:`Basic ${Buffer.from(`${process.env.PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`).toString('base64')}`},signal:AbortSignal.timeout(45000),body:JSON.stringify({method:'eth_sendTransaction',caip2:'eip155:10143',sponsor:true,params:{transaction:{to:d.address,chain_id:10143,value:'0x0',data:iface.encodeFunctionData(method,[id,JSON.stringify({name:'Safety QA participant',text:'Synthetic protocol test; not a real customer contribution.',socialUrl:''})])}}})});
  if(!r.ok){if(await reconcile())return;console.log('Privy QA response HTTP',r.status);throw new Error('Sponsored submission unavailable');}const result=await r.json();const hash=result.data?.hash||result.data?.transaction_hash||result.hash;
  if(!hash){for(let attempt=0;attempt<20;attempt++){await new Promise(resolve=>setTimeout(resolve,1000));if(await reconcile())return;}throw new Error('Ambiguous submission');}
  j[key]=hash;j.transactions.push(hash);save();const mined=await p.waitForTransaction(hash,1,60000);if(mined?.status!==1)throw new Error('Submission failed');
 }
 if(!j.work){const fee=await c.creationFee(0);const now=Number((await p.getBlock('latest'))!.timestamp);const r=await receipt(await c.createMissionPaid(parseEther('.001'),now+3600,300,0,300,JSON.stringify({title:'Safety QA: direct payout and refund',description:'Synthetic test of the V7 escrow, not a real task.',category:'Memes'}),0,{value:parseEther('.002')+fee}));j.work=Number(r.logs.map((l:any)=>{try{return iface.parseLog(l);}catch{return null;}}).find((e:any)=>e?.name==='MissionCreated').args.missionId);save();}
 await sponsored('submitContribution',j.work,'workEntry');
 if(!j.workPaid){const entries=await c.raffleEntries(j.work);await receipt(await c.approveContribution(entries[0]));await receipt(await c.closeMission(j.work));j.workPaid=true;save();}
 if(!j.raffle){const fee=await c.creationFee(0),entropyFee=await c.drawFee();const now=Number((await p.getBlock('latest'))!.timestamp);const r=await receipt(await c.createMissionV3(parseEther('.001'),1,now+90,300,5,300,JSON.stringify({title:'Safety QA: real Pyth payout',description:'Synthetic test of bounded settlement with real Pyth Entropy.',category:'Memes'}),entropyFee*2n,parseEther('.3'),0,{value:parseEther('.301')+entropyFee*2n+fee}));j.raffle=Number(r.logs.map((l:any)=>{try{return iface.parseLog(l);}catch{return null;}}).find((e:any)=>e?.name==='MissionCreated').args.missionId);save();}
 await sponsored('enterCommunity',j.raffle,'raffleEntry');
 let m=await c.missions(j.raffle),draw=await c.draws(j.raffle);const now=Number((await p.getBlock('latest'))!.timestamp);
 if(!m.closed&&now>=Number(m.deadline)&&!draw.requested)await receipt(await c.requestDraw(j.raffle,{gasLimit:(await c.requestDraw.estimateGas(j.raffle))*125n/100n+30000n}));
 draw=await c.draws(j.raffle);if(!m.closed&&draw.ready)await receipt(await c.settleDraw(j.raffle,{gasLimit:(await c.settleDraw.estimateGas(j.raffle))*125n/100n+30000n}));
 m=await c.missions(j.raffle);draw=await c.draws(j.raffle);
 const failedAttempts:string[]=[];for(const hash of j.transactions){const r=await p.getTransactionReceipt(hash);if(!r)throw new Error('Unconfirmed proof receipt');if(r.status!==1)failedAttempts.push(hash);}
 const workEntry=(await c.raffleEntries(j.work))[0],raffleEntry=(await c.raffleEntries(j.raffle))[0];
 const result={chainId:10143,contract:d.address,contributor:j.contributor,workMission:j.work,workClosed:(await c.missions(j.work)).closed,workPaidMON:formatEther((await c.contributions(workEntry)).paid),raffleMission:j.raffle,raffleDeadline:Number(m.deadline),raffleRequested:draw.requested,realRandomnessReceived:draw.ready,raffleClosed:m.closed,rafflePaidMON:formatEther((await c.contributions(raffleEntry)).paid),transactions:j.transactions.filter((hash:string)=>!failedAttempts.includes(hash)),failedAttempts};
 fs.writeFileSync('safety-live-proof.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch{safeFailure('Safety live QA');}finally{p.destroy();}
