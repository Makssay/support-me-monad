import {Contract,keccak256,toUtf8Bytes,ZeroAddress} from 'ethers';
import {provider,chainId} from './chain';
import {selectTopHolders} from '../shared/community';
import type {HolderSnapshot} from './community-store';
const transfer=keccak256(toUtf8Bytes('Transfer(address,address,uint256)'));
const consecutiveTransfer=keccak256(toUtf8Bytes('ConsecutiveTransfer(uint256,uint256,address,address)'));
export class SnapshotError extends Error {}
export async function collectHolderSnapshot(address:string,top:number,owner:string):Promise<HolderSnapshot>{
 const tip=Number(BigInt(await provider.send("eth_blockNumber",[])));const block=Math.max(0,tip-2);const header=await provider.getBlock(block);if(!header?.hash)throw new Error('Snapshot block unavailable.');
 const nft=new Contract(address,['function supportsInterface(bytes4) view returns(bool)'],provider);if(!await nft.supportsInterface('0x80ac58cd',{blockTag:block}))throw new Error('Top holders currently supports ERC-721 collections.');
 // Discover deployment instead of trusting a creator-supplied starting block.
 let low=0,high=block;while(low<high){const mid=Math.floor((low+high)/2);if(await provider.getCode(address,mid)==='0x')low=mid+1;else high=mid;}
 const start=low;const configured=Number(process.env.HOLDER_SNAPSHOT_MAX_RANGES||2000);const limit=Number.isSafeInteger(configured)&&configured>0?Math.min(configured,2000):2000;const ranges=Math.ceil((block-start+1)/100);if(ranges>limit)throw new SnapshotError('Collection history exceeds the MVP snapshot limit. Use an organizer list.');
 const owners=new Map<string,string>();let total=0;
 for(let from=start;from<=block;from+=100){const logs=await provider.getLogs({address,topics:[[transfer,consecutiveTransfer]],fromBlock:from,toBlock:Math.min(block,from+99)});total+=logs.length;if(total>50000)throw new SnapshotError('Collection history exceeds the MVP snapshot limit.');for(const log of logs){if(log.topics[0]===consecutiveTransfer)throw new SnapshotError('Batch-minted collections need an organizer holder list for this MVP.');if(log.topics.length!==4)throw new SnapshotError('Unsupported NFT transfer format.');const to='0x'+log.topics[2].slice(-40).toLowerCase();if(to===ZeroAddress)owners.delete(log.topics[3]);else owners.set(log.topics[3],to);}}
 const balances=new Map<string,number>();for(const who of owners.values())balances.set(who,(balances.get(who)||0)+1);if(balances.size>10000)throw new Error('Collection exceeds 10,000 holder snapshot limit.');
 const holders=[...balances].map(([address,quantity])=>({address,quantity})).sort((a,b)=>b.quantity-a.quantity||a.address.localeCompare(b.address));if(!holders.length)throw new Error('No indexed NFT holders. This collection needs a supported snapshot source.');
 const confirm=await provider.getBlock(block);if(confirm?.hash!==header.hash)throw new Error('Snapshot block changed. Retry.');
 const selection=selectTopHolders(holders,top);const base={owner:owner.toLowerCase(),contract:address.toLowerCase(),chainId,block,blockHash:header.hash,timestamp:header.timestamp,top,holders};const id=keccak256(toUtf8Bytes(JSON.stringify(base)));
 return {...base,id,selected:selection.boundary.length?undefined:selection.selected,boundary:selection.boundary,places:selection.places};
}
