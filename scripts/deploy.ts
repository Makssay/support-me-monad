import {compileFees} from './compile-fees';
import fs from 'node:fs';
import { ContractFactory, formatEther, getAddress } from 'ethers';
import { compile } from './compile';
import { checkedProvider, deployer, safeFailure } from './env';
import { EXPLORER } from '../shared/model';
import { socialSigner } from '../server/social-signer';
try {
  const p = await checkedProvider(); const w = deployer(p); const chainId = Number((await p.getNetwork()).chainId);
  const file = chainId === 31337 ? '.data/local-deployment.json' : 'deployment.json';
  if (fs.existsSync(file) && !process.argv.includes('--new')) { console.log('Existing deployment preserved. Use --new for a new contract.'); p.destroy(); }
  else { const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : undefined; const c = compile(); const entropy='0x825c0390f379C631f3Cf11A82a37D20BddF93c07'; const verifier=socialSigner().address;
    const exemptWallets:string[]=JSON.parse(fs.readFileSync('fee-exemptions.json','utf8')).map((value:string)=>getAddress(value));
    if(exemptWallets.length&&getAddress(process.env.PLATFORM_TREASURY||w.address)!==getAddress(w.address))throw new Error('Exemptions require the treasury signer before deployment.');
    const f=compileFees();const fees=await new ContractFactory(f.abi,f.evm.bytecode.object,w).deploy(process.env.PLATFORM_TREASURY||w.address);const feeReceipt=await fees.deploymentTransaction()!.wait();
    for(const wallet of exemptWallets){const receipt=await (await fees.getFunction('setExempt')(wallet,true)).wait();if(receipt?.status!==1||!(await fees.getFunction('exempt')(wallet)))throw new Error('Fee exemption confirmation failed.');}
    const contract = await new ContractFactory(c.abi, c.evm.bytecode.object, w).deploy(entropy,verifier,await fees.getAddress()); const receipt = await contract.deploymentTransaction()!.wait(); if (!receipt || receipt.status !== 1) throw new Error('Deploy receipt failed'); const address = await contract.getAddress();
    const runtime = await p.getCode(address); if (runtime !== `0x${c.evm.deployedBytecode.object}`) throw new Error('Bytecode mismatch');
    if(previous){fs.mkdirSync("deployment-history",{recursive:true});fs.writeFileSync(`deployment-history/escrow-${previous.address}.json`,JSON.stringify(previous,null,2));}
    const info = { version:9, feeExemptWallets:exemptWallets, communityGate:await contract.getFunction('communityGate')(), creationFees:await fees.getAddress(), feeDeploymentTx:feeReceipt!.hash, platformTreasury:await fees.getFunction('treasury')(), legacyAddress:previous?.address, entropy, verifier, address, chainId, block: receipt.blockNumber, transactionHash: receipt.hash, deployer: w.address, compiler: '0.8.28', evmVersion: 'paris', runtimeVerified: true, explorer: EXPLORER, gasCostMON: formatEther(receipt.gasUsed * receipt.gasPrice) };
    fs.mkdirSync('.data', { recursive: true }); fs.writeFileSync(file, JSON.stringify(info, null, 2)); console.log(JSON.stringify(info, null, 2)); p.destroy();
  }
} catch { safeFailure('Deployment'); }

