import { isAddress, getAddress } from 'ethers';
export interface RewardAsset { address: string; chainId: number; name: string; symbol: string; decimals: number; source: 'nad.fun' | 'native' | 'test-fixture'; url?: string; }
export const nativeReward:RewardAsset={address:'0x0000000000000000000000000000000000000000',chainId:10143,name:'Monad',symbol:'MON',decimals:18,source:'native'};
export const erc20Abi=['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function decimals() view returns(uint8)','function name() view returns(string)','function symbol() view returns(string)'];
export function rewardTokenAddress(input:string):string {
 const value=input.trim();if(isAddress(value))return getAddress(value);
 try{const u=new URL(value);if(u.protocol!=='https:'||!['nad.fun','testnet.nad.fun'].includes(u.hostname)||u.username||u.password)throw new Error();const m=u.pathname.match(/^\/tokens\/(0x[0-9a-fA-F]{40})\/?$/);if(m)return getAddress(m[1]);}catch{}
 throw new Error('Use a token contract address or a nad.fun token URL.');
}
