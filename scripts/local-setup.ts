import {compileFees} from './compile-fees';
import fs from 'node:fs';
import { ContractFactory, JsonRpcProvider, HDNodeWallet, NonceManager } from 'ethers';
import solc from 'solc';
import artifact from '../artifacts/SupportMe.json';
import { socialSigner } from '../server/social-signer';
import { compileAI } from './compile-ai';
const p=new JsonRpcProvider(process.env.QA_RPC_URL||'http://127.0.0.1:8545',31337,{batchMaxCount:1});
if(fs.existsSync('.data/local-ai-cache.json'))fs.unlinkSync('.data/local-ai-cache.json');
if(fs.existsSync('.data/local-verifications.json'))fs.unlinkSync('.data/local-verifications.json');
const w=new NonceManager(HDNodeWallet.fromPhrase('test test test test test test test test test test test junk').connect(p));
const input={language:'Solidity',sources:{'MockEntropy.sol':{content:fs.readFileSync('contract-test/MockEntropy.sol','utf8')}},settings:{evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const mock=JSON.parse(solc.compile(JSON.stringify(input))).contracts['MockEntropy.sol'].MockEntropy;
const entropy=await new ContractFactory(mock.abi,mock.evm.bytecode.object,w).deploy();await entropy.waitForDeployment();
const f=compileFees();const fees=await new ContractFactory(f.abi,f.evm.bytecode.object,w).deploy(await w.getAddress());await fees.waitForDeployment();
const c=await new ContractFactory(artifact.abi,artifact.bytecode,w).deploy(await entropy.getAddress(),socialSigner().address,await fees.getAddress());const r=await c.deploymentTransaction()!.wait();
fs.mkdirSync('.data',{recursive:true});fs.writeFileSync('.data/local-deployment.json',JSON.stringify({version:8,communityGate:await c.getFunction('communityGate')(),creationFees:await fees.getAddress(),address:await c.getAddress(),entropy:await entropy.getAddress(),block:r!.blockNumber,chainId:31337}));
const compiled=compileAI();const ai=await new ContractFactory(compiled.abi,compiled.evm.bytecode.object,w).deploy(await c.getAddress(),socialSigner().address);await ai.waitForDeployment();fs.writeFileSync('.data/local-ai-deployment.json',JSON.stringify({ledger:await c.getAddress(),address:await ai.getAddress()}));
const executorState=`.data/automation-31337-${(await c.getAddress()).toLowerCase()}.json`;if(fs.existsSync(executorState))fs.unlinkSync(executorState);
console.log('Local QA escrow, AI controller and mock Entropy deployed.');

if(process.env.TOKEN_FIXTURES==='1'){
 const tokenInput={language:'Solidity',sources:{'MockRewardToken.sol':{content:fs.readFileSync('contract-test/MockRewardToken.sol','utf8')}},settings:{evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
 const tokenArtifact=JSON.parse(solc.compile(JSON.stringify(tokenInput))).contracts['MockRewardToken.sol'].MockRewardToken;
 const token=await new ContractFactory(tokenArtifact.abi,tokenArtifact.evm.bytecode.object,w).deploy();await token.waitForDeployment();
 for(const i of [0,2]){const who=HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,`m/44'/60'/0'/0/${i}`);await(await token.getFunction('mint')(who.address,1000000000000n)).wait();}
 fs.writeFileSync('.data/local-reward-token.json',JSON.stringify({address:await token.getAddress(),fixture:true}));
}

if(process.env.COMMUNITY_FIXTURES==='1'){
 const source=fs.readFileSync('contract-test/MockCommunityNFT.sol','utf8');const input={language:'Solidity',sources:{'MockCommunityNFT.sol':{content:source}},settings:{evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};const artifact=JSON.parse(solc.compile(JSON.stringify(input))).contracts['MockCommunityNFT.sol'].MockCommunityNFT;
 const nft=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,w).deploy();const receipt=await nft.deploymentTransaction()!.wait();
 for(const [id,i] of [[1,11],[2,11],[3,12],[4,13]]){const who=HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,`m/44'/60'/0'/0/${i}`);await(await nft.getFunction('mint')(who.address,id)).wait();}await p.send('evm_mine',[]);await p.send('evm_mine',[]);
 fs.writeFileSync('.data/local-community-nft.json',JSON.stringify({address:await nft.getAddress(),block:receipt!.blockNumber}));
}
p.destroy();
