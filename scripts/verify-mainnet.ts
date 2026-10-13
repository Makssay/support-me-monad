import fs from 'node:fs';
import { Contract, JsonRpcProvider, formatEther, parseEther } from 'ethers';

const d=JSON.parse(fs.readFileSync('mainnet-deployment.json','utf8'));
const artifact=JSON.parse(fs.readFileSync('artifacts/SupportMe.json','utf8'));
const feesArtifact=JSON.parse(fs.readFileSync('artifacts/CreationFees.json','utf8'));
const p=new JsonRpcProvider('https://rpc.monad.xyz',undefined,{batchMaxCount:1});
try {
 if(d.chainId!==143||Number((await p.getNetwork()).chainId)!==143)throw new Error('Wrong verification network.');
 const ledger=new Contract(d.address,artifact.abi,p),fees=new Contract(d.creationFees,feesArtifact.abi,p);
 if(await p.getCode(d.address)!==artifact.deployedBytecode)throw new Error('Escrow runtime mismatch.');
 let actual=(await p.getCode(d.creationFees)).slice(2),expected=feesArtifact.evm.deployedBytecode.object;
 for(const refs of Object.values(feesArtifact.evm.deployedBytecode.immutableReferences) as any[])for(const r of refs){actual=actual.slice(0,r.start*2)+'0'.repeat(r.length*2)+actual.slice((r.start+r.length)*2);expected=expected.slice(0,r.start*2)+'0'.repeat(r.length*2)+expected.slice((r.start+r.length)*2);}
 if(actual!==expected||await fees.treasury()!==d.platformTreasury)throw new Error('Fee runtime or treasury mismatch.');
 if(await ledger.entropy()!==d.entropy||await ledger.verifier()!==d.verifier||await ledger.communityGate()!==d.communityGate||await ledger.settlementEngine()!==d.settlementEngine||await ledger.creationFees()!==d.creationFees)throw new Error('Mainnet contract configuration mismatch.');
 const gate=new Contract(d.communityGate,['function ledger() view returns(address)','function verifier() view returns(address)'],p);
 if(await gate.ledger()!==d.address||await gate.verifier()!==d.verifier||await p.getCode(d.settlementEngine)==='0x')throw new Error('Nested contract mismatch.');
 for(const wallet of d.feeExemptWallets)for(const tier of [0,1,2])if(await ledger.creationFeeFor(wallet,tier)!==0n)throw new Error('Fee exemption mismatch.');
 for(const [tier,amount] of ['20','50','200'].entries())if(await fees.quote(tier)!==parseEther(amount))throw new Error('Mainnet fee schedule mismatch.');
 const receipts=await Promise.all([d.transactionHash,d.feeDeploymentTx].map(hash=>p.getTransactionReceipt(hash)));
 if(receipts.some(r=>r?.status!==1))throw new Error('Deployment receipt mismatch.');
 const proof={passed:true,chainId:143,address:d.address,exactEscrowRuntime:true,feeRuntimeAndTreasury:true,nestedContracts:true,feeExemptWallets:d.feeExemptWallets,missionCount:Number(await ledger.missionCount()),contributionCount:Number(await ledger.contributionCount()),pythFeeMON:formatEther(await ledger.drawFee()),deploymentGasMON:d.gasCostMON,checkedAt:new Date().toISOString()};
 fs.writeFileSync('mainnet-chain-verification.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
 const specs=[
  {name:'escrow',address:d.address,identifier:'SupportMe.sol:SupportMe',input:'artifacts/standard-input.json',tx:d.transactionHash},
  {name:'fees',address:d.creationFees,identifier:'CreationFees.sol:CreationFees',input:'artifacts/fees-standard-input.json',tx:d.feeDeploymentTx},
  {name:'community',address:d.communityGate,identifier:'CommunityGate.sol:CommunityGate',input:'artifacts/standard-input.json',tx:d.transactionHash},
  {name:'settlement',address:d.settlementEngine,identifier:'SettlementEngine.sol:SettlementEngine',input:'artifacts/standard-input.json',tx:d.transactionHash}
 ];
 const jobs=await Promise.all(specs.map(async spec=>{
  try {
   const response=await fetch(`https://sourcify.dev/server/v2/verify/143/${spec.address}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stdJsonInput:JSON.parse(fs.readFileSync(spec.input,'utf8')),compilerVersion:JSON.parse(artifact.metadata).compiler.version,contractIdentifier:spec.identifier,creationTransactionHash:spec.tx}),signal:AbortSignal.timeout(30000)});
   const body=await response.json();return {...spec,status:response.status,verificationId:body.verificationId,errorCode:body.customCode};
  }catch{return {...spec,status:'unavailable',verificationId:undefined,errorCode:undefined};}
 }));
 fs.writeFileSync('mainnet-source-jobs.json',JSON.stringify(jobs,null,2));console.log(JSON.stringify(jobs.map(({name,status,verificationId,errorCode})=>({name,status,verificationId,errorCode})),null,2));
}catch(e){console.error(e instanceof Error?e.message:'Mainnet verification failed.');process.exitCode=1;}finally{p.destroy();}
