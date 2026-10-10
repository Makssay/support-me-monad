import { getAddress, keccak256, toUtf8Bytes } from 'ethers';
export type DiscordRule={kind:'member'|'role'|'list';guildId?:string;roleId?:string;ids?:string[]};
export type NFTRule={kind:'hold'|'list'|'top';contract?:string;standard?:'721'|'1155';tokenId?:string;minimum?:string;addresses?:string[];top?:number;snapshotId?:string};
export interface CommunityPolicy {discord?:DiscordRule;nft?:NFTRule;xBlue?:true;}
export interface CommunitySummary {hash:string;xBlue?:true;finalized?:boolean;eligibleCount?:number;discord?:{kind:DiscordRule['kind'];guildId?:string;roleId?:string;count?:number};nft?:{kind:NFTRule['kind'];contract?:string;standard?:'721'|'1155';tokenId?:string;minimum?:string;count?:number;top?:number;block?:number;timestamp?:number};recheck:boolean;recoveryWindow:number;}
export const communityMessage=(purpose:string,chainId:number,ledger:string,wallet:string,timestamp:number,id:number|string='')=>`Support Me\n${purpose}\nChain ${chainId}\nLedger ${ledger.toLowerCase()}\nWallet ${wallet.toLowerCase()}\nMission ${id}\nTime ${timestamp}`;
export function parseParticipantList(input:string,kind:'wallet'|'discord'){
 if(new TextEncoder().encode(input).length>512000)throw new Error('Participant file exceeds 500 KB.');
 const lines=input.replace(/^\uFEFF/,'').split(/\r?\n/);const values:string[]=[];const invalid:number[]=[];let duplicates=0;const seen=new Set<string>();
 for(let i=0;i<lines.length;i++){let v=lines[i].trim();if(!v)continue;if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);if(i===0&&['address','wallet','discord_id','discord id'].includes(v.toLowerCase()))continue;
  try{if(kind==='wallet')v=getAddress(v).toLowerCase();else if(!/^\d{17,20}$/.test(v)||BigInt(v)>18446744073709551615n)throw new Error();}catch{invalid.push(i+1);continue;}
  if(seen.has(v)){duplicates++;continue;}seen.add(v);values.push(v);
 }
 if(values.length>10000)throw new Error('Maximum 10,000 unique identities per list.');
 return {values:values.sort(),duplicates,invalid};
}
export const policyHash=(policy:CommunityPolicy)=>keccak256(toUtf8Bytes(JSON.stringify(policy)));
export function validatePolicy(input:any):CommunityPolicy {
 if(!input||typeof input!=='object')throw new Error('Choose a community requirement.');const p:CommunityPolicy={};
 if(input.discord){const d=input.discord;if(!['member','role','list'].includes(d.kind))throw new Error('Invalid Discord rule.');
  if(d.kind==='list'){if(!Array.isArray(d.ids))throw new Error('Upload Discord IDs.');const parsed=parseParticipantList(d.ids.join('\n'),'discord');if(parsed.invalid.length||!parsed.values.length)throw new Error('Correct the Discord list before publishing.');p.discord={kind:'list',ids:parsed.values};}
  else{if(!/^\d{17,20}$/.test(d.guildId||'')||d.kind==='role'&&!/^\d{17,20}$/.test(d.roleId||''))throw new Error('Enter valid Discord server and role IDs.');p.discord={kind:d.kind,guildId:d.guildId,...(d.kind==='role'?{roleId:d.roleId}:{})};}}
 if(input.nft){const n=input.nft;if(!['hold','list','top'].includes(n.kind))throw new Error('Invalid NFT rule.');
  if(n.kind==='list'){if(!Array.isArray(n.addresses))throw new Error('Upload wallet addresses.');const parsed=parseParticipantList(n.addresses.join('\n'),'wallet');if(parsed.invalid.length||!parsed.values.length)throw new Error('Correct the wallet list before publishing.');p.nft={kind:'list',addresses:parsed.values};}
  else {let contract:string;try{contract=getAddress(n.contract).toLowerCase();}catch{throw new Error('Enter a valid NFT contract address.');}if(contract==='0x'+'0'.repeat(40))throw new Error('Enter a valid NFT contract address.');
   if(n.kind==='top'){if(!Number.isInteger(n.top)||n.top<1||n.top>1000||!/^0x[a-f0-9]{64}$/.test(n.snapshotId||''))throw new Error('Prepare a verified holder snapshot first.');p.nft={kind:'top',contract,top:n.top,snapshotId:n.snapshotId};}
   else{if(!['721','1155'].includes(n.standard))throw new Error('Choose an NFT standard.');const minimum=String(n.minimum||'1');if(!/^\d{1,78}$/.test(minimum)||BigInt(minimum)<1n||BigInt(minimum)>2n**256n-1n)throw new Error('Invalid minimum NFT balance.');let tokenId=String(n.tokenId||'0');if(!/^\d{1,78}$/.test(tokenId)||BigInt(tokenId)>2n**256n-1n)throw new Error('Invalid NFT token ID.');p.nft={kind:'hold',contract,standard:n.standard,minimum,...(n.standard==='1155'?{tokenId}:{})};}}
 }
 if(input.xBlue!==undefined){if(input.xBlue!==true)throw new Error('Invalid X checkmark requirement.');p.xBlue=true;}
 if(!p.discord&&!p.nft&&!p.xBlue)throw new Error('Choose a community requirement.');return p;
}
export function tierForCommunity(policy?:CommunityPolicy){return policy?.xBlue||policy?.nft?.kind==='top'?1:0;}
export function selectTopHolders(holders:{address:string;quantity:number}[],top:number,seed?:string){
 const sorted=[...holders].sort((a,b)=>b.quantity-a.quantity||a.address.localeCompare(b.address));if(sorted.length<=top)return {selected:sorted.map(h=>h.address),boundary:[],places:0};
 const threshold=sorted[top-1].quantity;const above=sorted.filter(h=>h.quantity>threshold).map(h=>h.address);const boundary=sorted.filter(h=>h.quantity===threshold).map(h=>h.address).sort();const places=top-above.length;
 if(boundary.length<=places)return {selected:[...above,...boundary],boundary:[],places:0};
 if(!seed)return {selected:above,boundary,places};
 // Uniform shuffle with rejection sampling; same committed candidates and seed always produce the same list.
 const remaining=[...boundary];for(let i=0;i<places;i++){const range=BigInt(remaining.length-i);const max=2n**256n;const bound=max-max%range;let attempt=0;let random:bigint;do{random=BigInt(keccak256(toUtf8Bytes(`${seed}:${i}:${attempt++}`)));}while(random>=bound);const j=i+Number(random%range);[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}
 return {selected:[...above,...remaining.slice(0,places)],boundary,places};
}
