import 'dotenv/config';
import fs from 'node:fs';
import { Contract, ContractFactory, JsonRpcProvider, Wallet, formatEther, getAddress, getCreateAddress, keccak256, parseEther, type TransactionRequest } from 'ethers';
import { compile } from './compile';
import { compileFees } from './compile-fees';
import { socialSigner } from '../server/social-signer';

// Mainnet has its own manifest and key. Planning never broadcasts a transaction.
const manifest = 'mainnet-deployment.json';
const journalPath = '.data/mainnet-deployment-journal.json';
const entropy = '0xD458261E832415CFd3BAE5E416FdF3230ce6F134';
const p = new JsonRpcProvider(process.env.MONAD_MAINNET_RPC_URL || 'https://rpc.monad.xyz', undefined, { batchMaxCount: 1 });
try {
 if (Number((await p.getNetwork()).chainId) !== 143) throw new Error('Mainnet RPC must return chain 143.');
 if (!process.env.MONAD_PRIVATE_KEY_MAINNET) throw new Error('MONAD_PRIVATE_KEY_MAINNET is missing.');
 const w = new Wallet(process.env.MONAD_PRIVATE_KEY_MAINNET,p);
 const verifier = socialSigner().address;
 const treasury = getAddress(process.env.PLATFORM_TREASURY_MAINNET || w.address);
 const exempt: string[] = JSON.parse(fs.readFileSync('fee-exemptions.json','utf8')).map(getAddress);
 if (treasury !== w.address && exempt.length) throw new Error('The treasury must sign the published fee exemptions.');
 if (fs.existsSync(manifest)) {
  const d=JSON.parse(fs.readFileSync(manifest,'utf8'));
  if(d.chainId!==143||await p.getCode(d.address)==='0x')throw new Error('Existing mainnet manifest does not match deployed code.');
  console.log(JSON.stringify({existingMainnetPreserved:true,address:d.address}));
 } else {
  const c=compile(), f=compileFees();
  const rng=new Contract(entropy,['function getFeeV2() view returns(uint128)','function getDefaultProvider() view returns(address)'],p);
  if(await p.getCode(entropy)==='0x')throw new Error('Official mainnet Entropy contract has no code.');
  const oracleFee=await rng.getFeeV2();
  const journal:any=fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath,'utf8')):{chainId:143,deployer:w.address,verifier,treasury,nonce:await p.getTransactionCount(w.address,'pending'),transactions:[]};
  if(journal.chainId!==143||journal.deployer!==w.address||journal.verifier!==verifier||journal.treasury!==treasury)throw new Error('Deployment journal configuration changed.');
  const feesAddress=getCreateAddress({from:w.address,nonce:journal.nonce});
  const escrowAddress=getCreateAddress({from:w.address,nonce:journal.nonce+1+exempt.length});
  const feeTx=await new ContractFactory(f.abi,f.evm.bytecode.object,w).getDeployTransaction(treasury);
  const escrowTx=await new ContractFactory(c.abi,c.evm.bytecode.object,w).getDeployTransaction(entropy,verifier,feesAddress);
  const price=(await p.getFeeData()).gasPrice;
  if(!price)throw new Error('Gas quote unavailable.');
  const feeGas=(await p.estimateGas({...feeTx,from:w.address}))*110n/100n;
  const escrowGas=(await p.estimateGas({...escrowTx,from:w.address}))*110n/100n;
  const limit=parseEther(process.env.MAINNET_DEPLOY_MAX_MON||'1.2');
  const maximumCost=(feeGas+escrowGas+150000n*BigInt(exempt.length))*price;
  const balance=await p.getBalance(w.address);
  if(maximumCost>limit||balance<maximumCost)throw new Error('Deployment exceeds its gas budget or wallet balance.');
  const plan={chainId:143,deployer:w.address,treasury,verifier,entropy,entropyProvider:await rng.getDefaultProvider(),oracleFeeMON:formatEther(oracleFee),balanceMON:formatEther(balance),maximumDeploymentGasMON:formatEther(maximumCost),spendingCapMON:formatEther(limit),feesAddress,escrowAddress,feeExemptWallets:exempt};
  fs.writeFileSync('.data/mainnet-deployment-plan.json',JSON.stringify(plan,null,2));console.log(JSON.stringify(plan,null,2));
  if(process.argv.includes('--execute')) {
   const save=()=>fs.writeFileSync(journalPath,JSON.stringify(journal,null,2),{mode:0o600});
   save();
   async function send(label:string,tx:TransactionRequest,gasLimit:bigint){
    let entry=journal.transactions.find((t:any)=>t.label===label);
    if(!entry){
     const nonce=journal.nonce+journal.transactions.length;
     if(await p.getTransactionCount(w.address,'pending')!==nonce)throw new Error('Wallet nonce changed; refusing concurrent deployment transactions.');
     const raw=await w.signTransaction({...tx,chainId:143,nonce,gasLimit,gasPrice:price});
     entry={label,hash:keccak256(raw),raw};journal.transactions.push(entry);save();
    }
    let receipt=await p.getTransactionReceipt(entry.hash);
    if(!receipt){if(!await p.getTransaction(entry.hash))await p.broadcastTransaction(entry.raw);receipt=await p.waitForTransaction(entry.hash,1,120000);}
    if(!receipt||receipt.status!==1)throw new Error(`Mainnet ${label} did not confirm successfully; journal retained.`);
    entry.block=receipt.blockNumber;entry.costMON=formatEther(receipt.fee);save();console.log(JSON.stringify({confirmed:label,hash:receipt.hash,costMON:entry.costMON}));return receipt;
   }
   const feesReceipt=await send('fees',feeTx,feeGas);
   const fees=new Contract(feesAddress,f.abi,w);
   for(const wallet of exempt)await send(`exempt:${wallet}`,await fees.setExempt.populateTransaction(wallet,true),150000n);
   const receipt=await send('escrow',escrowTx,escrowGas);
   const ledger=new Contract(escrowAddress,c.abi,p);
   if(await p.getCode(escrowAddress)!==`0x${c.evm.deployedBytecode.object}`||await ledger.entropy()!==entropy||await ledger.verifier()!==verifier||await ledger.creationFees()!==feesAddress||await fees.treasury()!==treasury)throw new Error('Deployed mainnet contract verification failed.');
   for(const wallet of exempt)if(!await fees.exempt(wallet)||await fees.quoteFor(wallet,0)!==0n)throw new Error('Mainnet fee exemption verification failed.');
   const info={version:9,address:escrowAddress,chainId:143,communityGate:await ledger.communityGate(),settlementEngine:await ledger.settlementEngine(),creationFees:feesAddress,feeDeploymentTx:feesReceipt.hash,platformTreasury:treasury,feeExemptWallets:exempt,entropy,verifier,block:receipt.blockNumber,transactionHash:receipt.hash,deployer:w.address,compiler:'0.8.28',evmVersion:'paris',runtimeVerified:true,explorer:'https://monadscan.com',gasCostMON:formatEther(journal.transactions.reduce((sum:bigint,t:any)=>sum+parseEther(t.costMON),0n))};
   fs.writeFileSync(manifest,JSON.stringify(info,null,2));console.log(JSON.stringify(info,null,2));
  }
 }
} catch(e) {
 console.error(e instanceof Error&&(!/https?:|private.?key|0x[\da-f]{64}/i.test(e.message))?e.message:'Mainnet deployment check failed. Private provider details suppressed.');process.exitCode=1;
} finally {p.destroy();}
