import fs from 'node:fs';
import { Contract, ContractFactory } from 'ethers';
import { checkedProvider, deployer, safeFailure } from './env';
import { compileAI } from './compile-ai';
import { socialSigner } from '../server/social-signer';
try{
 const p=await checkedProvider();const d=JSON.parse(fs.readFileSync('deployment.json','utf8'));const c=compileAI();
 if(fs.existsSync('ai-deployment.json')&&JSON.parse(fs.readFileSync('ai-deployment.json','utf8')).ledger?.toLowerCase()!==d.address.toLowerCase()){const previous=JSON.parse(fs.readFileSync('ai-deployment.json','utf8'));fs.mkdirSync('deployment-history',{recursive:true});fs.writeFileSync(`deployment-history/ai-${previous.address}.json`,JSON.stringify(previous,null,2));}
 else if(fs.existsSync('ai-deployment.json')){const existing=JSON.parse(fs.readFileSync('ai-deployment.json','utf8'));const a=new Contract(existing.address,c.abi,p);if(existing.ledger?.toLowerCase()!==d.address.toLowerCase()||(await a.ledger()).toLowerCase()!==d.address.toLowerCase()||(await a.verifier()).toLowerCase()!==socialSigner().address.toLowerCase())throw new Error('Existing deployment mismatch');
 if(!process.argv.includes('--replace-unused')){console.log('Existing AI controller verified:',existing.address);p.destroy();process.exit(0);}
 const ledger=new Contract(d.address,['function missionCount() view returns(uint256)','function missions(uint256) view returns(address,uint256,uint256,uint64,bool,string)'],p);for(let i=1;i<=Number(await ledger.missionCount());i++)if((await ledger.missions(i))[0].toLowerCase()===existing.address.toLowerCase())throw new Error('Cannot replace a controller with existing missions');fs.writeFileSync('ai-unused-deployment.json',JSON.stringify(existing,null,2));}
 const a=await new ContractFactory(c.abi,`0x${c.evm.bytecode.object}`,deployer(p)).deploy(d.address,socialSigner().address);const receipt=await a.deploymentTransaction()!.wait();const address=await a.getAddress();
 const code=await p.getCode(address);if(code==='0x')throw new Error('Missing deployed code');
 const data={address,ledger:d.address,verifier:socialSigner().address,chainId:Number((await p.getNetwork()).chainId),block:receipt!.blockNumber,transactionHash:receipt!.hash};fs.writeFileSync('ai-deployment.json',JSON.stringify(data,null,2));console.log('AI controller deployed:',address);p.destroy();
}catch{safeFailure('AI controller deployment');}
