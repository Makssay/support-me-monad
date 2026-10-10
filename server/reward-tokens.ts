import { Router } from 'express';
import { Contract, AbiCoder, keccak256, getBytes, formatUnits } from 'ethers';
import { provider, chainId, contractAddress, aiControllerAddress, local, version } from './chain';
import { rewardTokenAddress, erc20Abi, type RewardAsset } from '../shared/rewards';
import { socialSigner } from './social-signer';
const cache=new Map<string,{asset:RewardAsset;time:number}>();
let nextLookup=0;
export async function nadRewardToken(input:string):Promise<RewardAsset>{
 const address=rewardTokenAddress(input);const key=address.toLowerCase();const cached=cache.get(key);if(cached&&Date.now()-cached.time<3600000)return cached.asset;
 if(![10143,143].includes(chainId)&&!local)throw new Error('Unsupported reward network.');
 const token=new Contract(address,erc20Abi,provider);
 if(await provider.getCode(address)==='0x')throw new Error('Token is not deployed on the active network.');
 let name='',symbol='',source:RewardAsset['source']='nad.fun';
 if(local&&process.env.TOKEN_FIXTURES==='1'){name=await token.name();symbol=await token.symbol();source='test-fixture';}
 else {
  if(Date.now()<nextLookup)throw new Error('Wait a few seconds before checking another token.');nextLookup=Date.now()+6500;
  const base=chainId===143?'https://api.nad.fun':'https://dev-api.nadapp.net';
  const response=await fetch(`${base}/token/${address}`,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(response.status===404?'Token was not found on nad.fun for this network.':'nad.fun token lookup is unavailable. Try again later.');
  const info=(await response.json()).token_info;
  if(!info||String(info.token_id).toLowerCase()!==key)throw new Error('nad.fun did not confirm this token.');
  name=await token.name();symbol=await token.symbol();
 }
 const decimals=Number(await token.decimals());if(!Number.isInteger(decimals)||decimals<0||decimals>18||name.length>100||symbol.length>32)throw new Error('Unsupported token metadata.');
 const asset:RewardAsset={address,chainId,name,symbol,decimals,source,url:`https://${chainId===143?'':'testnet.'}nad.fun/tokens/${address}`};
 if(cache.size>200)cache.clear();cache.set(key,{asset,time:Date.now()});return asset;
}
const router=Router();
router.get('/reward-tokens/lookup',async(req,res)=>{try{
 if(version<4)throw new Error('Token rewards require the upgraded escrow contract.');
 const input=typeof req.query.token==='string'?req.query.token:'';if(input.length>300)throw new Error('Invalid token input.');
 const asset=await nadRewardToken(input);
 const validUntil=Number((await provider.getBlock('latest'))!.timestamp)+600;
 const digest=keccak256(AbiCoder.defaultAbiCoder().encode(['string','uint256','address','address','uint64'],['Support Me reward token',chainId,contractAddress,asset.address,validUntil]));
 const signature=await socialSigner().signMessage(getBytes(digest));
 let balance:string|undefined;let allowance:string|undefined;const wallet=typeof req.query.wallet==='string'?req.query.wallet:'';
 if(/^0x[0-9a-fA-F]{40}$/.test(wallet)){const c=new Contract(asset.address,erc20Abi,provider);balance=formatUnits(await c.balanceOf(wallet),asset.decimals);allowance=(await c.allowance(wallet,req.query.ai==='1'?aiControllerAddress||contractAddress:contractAddress)).toString();}
 res.set('Cache-Control','no-store').json({asset,validUntil,signature,balance,allowance});
 }catch(e){res.status(400).json({error:e instanceof Error&&e.message.length<150&&!/https?:|0x|key|rpc/i.test(e.message)?e.message:'Token could not be verified on the active network.'});}});
export default router;
