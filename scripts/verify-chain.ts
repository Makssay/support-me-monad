import fs from 'node:fs';
import { Contract, Interface, parseEther, formatEther } from 'ethers';
import { checkedProvider, safeFailure } from './env';
import artifact from '../artifacts/SupportMe.json';
let provider: Awaited<ReturnType<typeof checkedProvider>> | undefined;
try {
 const d=JSON.parse(fs.readFileSync('deployment.json','utf8'));const proof=JSON.parse(fs.readFileSync('v2-demo-proof.json','utf8'));
 provider=await checkedProvider();const p=provider;const c=new Contract(d.address,artifact.abi,p);const iface=new Interface(artifact.abi);
 if(proof.contract!==d.address||await p.getCode(d.address)!==artifact.deployedBytecode)throw new Error('Deployment mismatch');
 const receipts:Record<string,{hash:string;status:number;block:number}>={};
 for(const [name,hash] of Object.entries({deployment:d.transactionHash,...proof.receipts}) as [string,string][]){const r=await p.getTransactionReceipt(hash);if(!r||r.status!==1)throw new Error('Receipt failed');receipts[name]={hash,status:r.status,block:r.blockNumber};}
 for(const name of ['reportPayout','randomnessPayout']){const r=await p.getTransactionReceipt(proof.receipts[name]);const e=r!.logs.map(l=>{try{return iface.parseLog(l);}catch{return null;}}).find(l=>l?.name==='ContributionAccepted');if(!e?.args.transferred||e.args.amount!==parseEther('0.005')||e.args.contributor.toLowerCase()!==proof.contributor.toLowerCase())throw new Error('Wrong payout');}
 const draw=await c.draws(proof.raffle);const r=await c.reputation(proof.contributor);
 if(!draw.ready||!draw.settled||draw.seed!==proof.randomSeed||r.accepted<2n||r.earned<parseEther('0.01'))throw new Error('State mismatch');
 const report={passed:true,contract:d.address,exactRuntimeMatch:true,successfulTransactions:receipts,reportPayoutMON:proof.reportPayoutMON,rafflePayoutMON:proof.rafflePayoutMON,pythCallbackConfirmed:true,seed:draw.seed,sequence:draw.sequence.toString(),accepted:Number(r.accepted),earnedMON:formatEther(r.earned),socialEligibility:proof.socialEligibility,checkedAt:new Date().toISOString()};
 fs.writeFileSync('chain-verification-v2.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,successfulReceipts:Object.keys(receipts).length,exactRuntimeMatch:true,pythCallbackConfirmed:true}));
}catch{safeFailure('V2 chain verification');}finally{provider?.destroy();}
