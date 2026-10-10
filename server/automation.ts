import { jsonStore, checkpoint, cloudStorage } from './persistence';
import { Wallet, Contract, HDNodeWallet, keccak256, type TransactionRequest } from 'ethers';
import { contract, contractAddress, provider, chainId, version, invalidate, local, aiController } from './chain';
// One serialized executor per API process. A durable pending hash prevents resending after restart.
function createAutomation(){
 const executorKey=chainId===143?process.env.MAINNET_PRIVATE_KEY:process.env.MONAD_PRIVATE_KEY;
 const qa=local&&process.env.AUTOMATION_QA==='1';
 if(version<3||!contract||(!qa&&!executorKey)||(local&&!qa))return;
 const wallet=qa?HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,"m/44'/60'/0'/0/8").connect(provider):new Wallet(executorKey!,provider);const escrow=new Contract(contractAddress,contract.interface,wallet);
 const file=`.data/automation-${chainId}-${contractAddress.toLowerCase()}.json`;
 const store=jsonStore<{pending?:string;raw?:string;lastAction?:string;status:string;cursor:number}>(file,{status:'idle',cursor:1});const state=store.data;
 const communityRetries=new Map<number,{at:number;failures:number}>();
 let busy=false;
 const save=store.save;
 async function broadcast(request:TransactionRequest,label:string){
  const populated=await wallet.populateTransaction({...request,nonce:await provider.getTransactionCount(wallet.address,'pending')});
  const raw=await wallet.signTransaction(populated);
  // Write-ahead journal: after a timeout/restart we resend these exact bytes,
  // never build another transaction for the same pending action.
  state.raw=raw;state.pending=keccak256(raw);state.lastAction=label;state.status='pending';save();await checkpoint();
  await provider.broadcastTransaction(raw);
 }
 async function send(method:string,id:number,target=escrow){
  const action=target.getFunction(method);const gas=await action.estimateGas(id);const fees=await provider.getFeeData();const price=fees.gasPrice;if(!price)throw new Error('Fee unavailable');
  const limit=gas*120n/100n;if(limit*price>150000000000000000n)throw new Error('Execution quote exceeds reimbursement cap');
  if(await provider.getBalance(wallet.address)<limit*price)throw new Error('Executor needs testnet gas');
  // Only valid onchain state can reimburse the executor. Never use prize funds for gas.
  await broadcast(await action.populateTransaction(id,{gasLimit:limit,gasPrice:price}),`${method}:${id}`);
 }
 async function tick(){if(busy)return;busy=true;try{
  if(Number((await provider.getNetwork()).chainId)!==chainId)throw new Error('Wrong chain');
  if(state.pending){const receipt=await provider.getTransactionReceipt(state.pending);if(!receipt){if(state.raw&&!await provider.getTransaction(state.pending)){await checkpoint();await provider.broadcastTransaction(state.raw);}return;}state.status=receipt.status===1?'confirmed':'transaction_failed';delete state.pending;delete state.raw;save();invalidate();return;}
  const now=Number((await provider.getBlock('latest'))?.timestamp);const count=Number(await escrow.missionCount());
  const started=Date.now();const first=cloudStorage?Math.min(Math.max(1,state.cursor),Math.max(1,count)):1;
  for(let offset=0;offset<count;offset++){const id=(first-1+offset)%count+1;if(cloudStorage&&(offset>=30||Date.now()-started>180000))break;state.cursor=id%Math.max(1,count)+1;try{
   const a=await escrow.automation(id);const m=await escrow.missions(id);if(m.closed)continue;const p=await escrow.policies(id);const mode=Number(p.mode);
   if(version>=7&&aiController&&m.creator.toLowerCase()===String(aiController.target).toLowerCase()&&now>Number(p.reviewDeadline)){await send('cancelOrRefund',id,aiController.connect(wallet) as Contract);return;}
   if(!a.enabled)continue;
   if(version>=6&&(mode===4||mode===5)){const gateAddress=await escrow.communityGate();const gate=new Contract(gateAddress,(await import('../shared/community-abi.json')).default,wallet);const policy=await gate.policies(id);if(policy.recheck&&now>=Number(m.deadline)){if(await gate.refundable(id)){await send('closeMission',id);return;}if(!policy.finalized){
     if((communityRetries.get(id)?.at||0)>Date.now())continue;
     try{const ticket=await(await import('./community')).communityFinalTicket(id);if(ticket&&!ticket.expired){const gas=(await gate.finalize.estimateGas(...ticket.args))*120n/100n;const price=(await provider.getFeeData()).gasPrice;if(!price||gas*price>150000000000000000n||await provider.getBalance(wallet.address)<gas*price)throw new Error('Community executor gas unavailable');await broadcast(await gate.finalize.populateTransaction(...ticket.args,{gasLimit:gas,gasPrice:price}),`community-finalize:${id}`);communityRetries.delete(id);return;}}
     catch{if(state.pending){state.status='pending';save();return;}const failures=(communityRetries.get(id)?.failures||0)+1;communityRetries.set(id,{failures,at:Date.now()+Math.min(300000,15000*2**Math.min(failures-1,5))});state.status='community_checks_paused';save();}
     continue;}}}
   if(mode===0||mode===4||mode===5){const d=await escrow.draws(id);
    if(d.ready&&!d.settled){await send('settleDraw',id);return;}
    if(version>=7&&!d.ready&&now>=Number(await escrow.recoveryAt(id))){await send('recoverUnavailableDraw',id);return;}
    if(!d.requested&&now>=((mode===4||mode===5)?Number(m.deadline):Number(p.reviewDeadline)+1)&&m.remaining>=m.reward){
     let eligible=false;for(const cid of await escrow.raffleEntries(id))if(Number((await escrow.contributions(cid)).status)===0){eligible=true;break;}
     if(eligible){if(a.pythReserve<await escrow.drawFee()){state.status='pyth_reserve_needs_topup';save();continue;}await send('requestDraw',id);return;}
    }
   }
   if((mode===1||mode===2)&&now>Number(p.reviewDeadline)){await send('settleOverdueWork',id);return;}
   if(m.remaining===0n||(now>Number(p.reviewDeadline)&&p.pending===0n&&p.reserved===0n)){await send('closeMission',id);return;}
  }catch{state.status=state.pending?'pending':'retry_needed_or_executor_unfunded';save();if(state.pending)return;continue;}
  }
  state.status='idle';save();
 }catch{state.status='retry_needed_or_executor_unfunded';save();}finally{busy=false;}}
 return {tick,qa};
}
const automation=createAutomation();
export async function runAutomationTick(){if(!automation)throw new Error('Executor is not configured.');await automation.tick();}
export function startAutomation(){if(cloudStorage||process.env.AUTOMATION_DISABLED==='1'||!automation)return;const timer=setInterval(()=>void automation.tick(),automation.qa?1000:15000);timer.unref();void automation.tick();}
