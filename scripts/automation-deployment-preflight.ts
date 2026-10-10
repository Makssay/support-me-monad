import { checkedProvider, deployer, safeFailure } from './env';
import { formatEther,ContractFactory } from 'ethers';
import artifact from '../artifacts/SupportMe.json';
import { socialSigner } from '../server/social-signer';
try{const p=await checkedProvider();const w=deployer(p);const balance=await p.getBalance(w.address);const fees=await p.getFeeData();const tx=await new ContractFactory(artifact.abi,artifact.bytecode,w).getDeployTransaction('0x825c0390f379C631f3Cf11A82a37D20BddF93c07',socialSigner().address);const gas=await p.estimateGas({...tx,from:w.address});console.log(JSON.stringify({wallet:w.address,balanceMON:formatEther(balance),estimatedDeploymentGas:gas.toString(),estimatedDeploymentFeeMON:formatEther(gas*(fees.maxFeePerGas||fees.gasPrice||0n))}));p.destroy();}catch{safeFailure('Automation deployment preflight');}
