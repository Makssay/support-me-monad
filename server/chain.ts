import { communityStore } from './community-store';
import { jsonStore, checkpoint, cloudStorage } from './persistence';
import 'dotenv/config';
import { erc20Abi, type RewardAsset } from '../shared/rewards';
import { publicIdentities } from './public-profiles';
import fs from 'node:fs';
import { boundedRead } from './bounded-read';
import { ResilientRpcProvider, rpcEndpoints } from './rpc-provider';
import { backgroundHistory } from './background-history';
import { Contract, JsonRpcProvider, formatEther, formatUnits, ZeroAddress } from 'ethers';
import { CHAIN_ID, EXPLORER, PUBLIC_RPC, safeJson, normalizeCategory, missionDefaults, contributionDefaults, scoreFor, type Snapshot, type Verification } from '../shared/model';
import artifact from '../artifacts/SupportMe.json';
import { cachedSocial } from './social';
import aiAbi from '../shared/ai-abi.json';
import gateAbi from '../shared/community-abi.json';
import { linkedReview, aiConfigured } from './ai';
const requestedChain=Number(process.env.MONAD_CHAIN_ID||10143);
if(![10143,143].includes(requestedChain))throw new Error('Unsupported Monad chain.');
export const rpcUrl = process.env.MONAD_RPC_URL || (requestedChain===143?'https://rpc.monad.xyz':PUBLIC_RPC);
export const local = process.env.LOCAL_E2E === '1' && ['127.0.0.1', 'localhost'].includes(new URL(rpcUrl).hostname);
const deploymentPath = local ? '.data/local-deployment.json' : requestedChain===143?'mainnet-deployment.json':'deployment.json';
const deployment = fs.existsSync(deploymentPath) ? JSON.parse(fs.readFileSync(deploymentPath, 'utf8')) : {};
export const version = deployment.version || 1;
export const contractAddress: string = process.env.CONTRACT_ADDRESS || deployment.address || '';
export const startBlock = Number(process.env.DEPLOYMENT_BLOCK || deployment.block || 0);
export const chainId:number = local ? 31337 : requestedChain;
if(deployment.address&&deployment.chainId!==chainId)throw new Error('Deployment network mismatch.');
export const publicRpc=chainId===143?'https://rpc.monad.xyz':PUBLIC_RPC;
export const explorer=chainId===143?'https://monadscan.com':EXPLORER;
export const provider = local ? new JsonRpcProvider(rpcUrl,chainId,{staticNetwork:true,batchMaxCount:1}) : new ResilientRpcProvider(rpcEndpoints(rpcUrl,process.env.MONAD_RPC_FALLBACK_URLS,chainId),chainId);
export const contract = contractAddress ? new Contract(contractAddress, artifact.abi, provider) : undefined;
const aiPath=local?'.data/local-ai-deployment.json':requestedChain===143?'mainnet-ai-deployment.json':'ai-deployment.json';
const aiDeployment=fs.existsSync(aiPath)?JSON.parse(fs.readFileSync(aiPath,'utf8')):{};
export const aiControllerAddress:string=aiDeployment.ledger?.toLowerCase()===contractAddress.toLowerCase()?aiDeployment.address:'';
export const aiController=aiControllerAddress?new Contract(aiControllerAddress,aiAbi,provider):undefined;
// App ID is public. Never return the app secret or secret RPC URL.
export const creationFeesAddress:string=deployment.creationFees||'';
export const creationFees=creationFeesAddress?new Contract(creationFeesAddress,['function paid(address,uint256) view returns(uint256)','function tiers(address,uint256) view returns(uint8)'],provider):undefined;
export const config = { walletAuthEnabled: process.env.WALLET_AUTH_ENABLED === '1' && !!process.env.WALLET_AUTH_X_POST && !!process.env.SOCIAL_DATA_API_KEY, authProvider: process.env.AUTH_PROVIDER === 'dynamic' ? 'dynamic' as const : 'privy' as const, dynamicEnvironmentId: local ? '' : (process.env.DYNAMIC_ENVIRONMENT_ID || '').trim(), dynamicGasSponsorship: !local && process.env.DYNAMIC_GAS_SPONSORSHIP === '1', communityGate:deployment.communityGate||'', creationFees:creationFeesAddress, chainId, contractAddress, explorer, publicRpc, socialConfigured: !!process.env.SOCIAL_DATA_API_KEY, local, privyAppId: local ? '' : (process.env.PRIVY_APP_ID || '').trim(), gasSponsorship: chainId===10143 && !local && !!process.env.PRIVY_APP_ID && process.env.PRIVY_GAS_SPONSORSHIP === '1', version, legacyAddress: deployment.legacyAddress || '' };
export function publicConfig(){return {...config,aiController:aiControllerAddress,aiConfigured:aiConfigured(),automationConfigured:version>=3&&!!(chainId===143?(process.env.MONAD_PRIVATE_KEY_MAINNET||process.env.MAINNET_PRIVATE_KEY):process.env.MONAD_PRIVATE_KEY)};}
const verificationFile=local?'.data/local-verifications.json':'.data/verifications.json';
const verificationStore=jsonStore<Record<string,Verification>>(verificationFile,{});export const verifications=verificationStore.data;
export function saveVerification(id: number, result: Verification) { verifications[`${chainId}:${contractAddress.toLowerCase()}:${id}`] = result; verificationStore.save(); }
export const verificationFor = (id: number) => verifications[`${chainId}:${contractAddress.toLowerCase()}:${id}`];
let cache: Snapshot | undefined; let cacheTime = 0; let pending: Promise<Snapshot> | undefined;
const snapshotStore=jsonStore<{value?:Snapshot;time:number}>('.data/public-snapshot.json',{time:0});
const indexFile = `.data/events-${chainId}-${contractAddress.toLowerCase()}.json`;
const indexStore=jsonStore(indexFile,{events:{} as Record<string,any>,lastEventBlock:startBlock-1});const savedIndex=indexStore.data;
const events: Record<string, { closedTx?:string; refundRaw?:string; refundTransferred?:boolean; submittedTx?: string; payoutTx?: string; transferred?: boolean; createdTx?: string; requestTx?: string; resultTx?: string }> = savedIndex.events || {};

async function eventHistory() {
  if (!contract) return;
  const started=Date.now();
  const tip = await provider.getBlockNumber();
  if(local&&savedIndex.lastEventBlock>tip){savedIndex.lastEventBlock=startBlock-1;for(const key of Object.keys(events))delete events[key];}
  if (savedIndex.lastEventBlock >= tip) return;
  // Small batches fit public RPC limits. Events are indexed incrementally.
  for (let from = Math.max(startBlock, savedIndex.lastEventBlock + 1); from <= tip; from += 100) {
    const to = Math.min(from + 99, tip);
    const logs = await provider.getLogs({ address: contractAddress, fromBlock: from, toBlock: to });
    for (const log of logs) { const e = contract.interface.parseLog(log); if (!e) continue;
      if (e.name === 'MissionCreated') events[`m${e.args.missionId}`] = { createdTx: log.transactionHash };
      if (e.name === 'ContributionSubmitted') events[`c${e.args.contributionId}`] = { submittedTx: log.transactionHash };
      if (e.name === 'ContributionAccepted') events[`c${e.args.contributionId}`] = { ...events[`c${e.args.contributionId}`], payoutTx: log.transactionHash, transferred: e.args.transferred };
      if (e.name === 'MissionClosed') events[`m${e.args.missionId}`] = { ...events[`m${e.args.missionId}`], closedTx:log.transactionHash, refundRaw:e.args.refund.toString(), refundTransferred:e.args.transferred };
      if (e.name === 'DrawRequested') events[`d${e.args.missionId}`] = { ...events[`d${e.args.missionId}`], requestTx: log.transactionHash };
      if (e.name === 'RandomnessReceived') events[`d${e.args.missionId}`] = { ...events[`d${e.args.missionId}`], resultTx: log.transactionHash };
    }
    savedIndex.lastEventBlock = to;
  indexStore.save();
  if(cloudStorage&&Date.now()-started>4000)break;
  }

}
const refreshHistory = backgroundHistory(eventHistory, () => { cacheTime = 0; });
async function collect(): Promise<Snapshot> {
  if (!contract) return { config:publicConfig(), missions: [], contributions: [], profiles: [], updatedAt: new Date().toISOString() };
  const actual = await provider.send('eth_chainId', []); if (Number(actual) !== chainId) throw new Error('Wrong chain');
  const [mc, cc] = await Promise.all([contract.missionCount(), contract.contributionCount()]);
  if (Number(mc) > 1000 || Number(cc) > 5000) throw new Error('Indexer capacity reached');

  // Three read workers avoid long sequential waits while bounding RPC load.
  const tokenMetadata = new Map<string,RewardAsset>();
  async function assetFor(id:number):Promise<RewardAsset|undefined>{
   if(version<4)return undefined;const token=await contract!.rewardToken(id);if(token===ZeroAddress)return undefined;
   if(tokenMetadata.has(token))return tokenMetadata.get(token);
   const c=new Contract(token,erc20Abi,provider);const [name,symbol,decimals]=await Promise.all([c.name(),c.symbol(),c.decimals()]);
   const asset:RewardAsset={address:token,chainId,name:String(name),symbol:String(symbol),decimals:Number(decimals),source:local?'test-fixture':'nad.fun',url:`https://${chainId===143?'':'testnet.'}nad.fun/tokens/${token}`};tokenMetadata.set(token,asset);return asset;
  }
  const missions: Snapshot['missions'] = await boundedRead(Array.from({length:Number(mc)},(_,i)=>i+1), async id => { const m = await contract!.missions(id); const asset=await assetFor(id); return { ...safeJson(m.metadata, missionDefaults), category: normalizeCategory(safeJson(m.metadata, missionDefaults).category), id, creator: m.creator, rewardAsset:asset, reward: formatUnits(m.reward,asset?.decimals??18), remaining: formatUnits(m.remaining,asset?.decimals??18), deadline: Number(m.deadline), closed: m.closed }; });
  if(version>=6){const gate=new Contract(deployment.communityGate,gateAbi,provider);const policies=communityStore(local,chainId).data.policies;await boundedRead(missions,async m=>{const p=await gate.policies(m.id);if(p.hash==='0x'+'0'.repeat(64)){m.communityHash='';m.communitySummary='';}else{m.communityHash=p.hash;const summary=policies[p.hash.toLowerCase()]?.summary;m.communitySummary=JSON.stringify(summary?{...summary,recheck:p.recheck,recoveryWindow:Number(p.recoveryWindow),finalized:p.finalized,eligibleCount:Number(p.eligibleCount)}:{hash:p.hash,recheck:p.recheck,recoveryWindow:Number(p.recoveryWindow),unavailable:true});}});}
  const contributions: Snapshot['contributions'] = await boundedRead(Array.from({length:Number(cc)},(_,i)=>i+1), async id => { const c = await contract!.contributions(id); const asset=missions.find(m=>m.id===Number(c.missionId))?.rewardAsset; return { ...safeJson(c.metadata, contributionDefaults), id, missionId: Number(c.missionId), contributor: c.contributor, status: Number(c.status), rewardAsset:asset, paid: formatUnits(c.paid,asset?.decimals??18), verification: verificationFor(id) }; });
  if (version >= 2) {
    await boundedRead(missions, async m => { const p = await contract!.policies(m.id); Object.assign(m, { mode:Number(p.mode)===5?6:Number(p.mode),reviewDeadline:Number(p.reviewDeadline),workWindow:Number(p.workWindow),slots:Number(p.slots),reserved:Number(p.reserved),pending:Number(p.pending) });
      if(aiController&&m.creator.toLowerCase()===aiControllerAddress.toLowerCase()){m.mode=5;m.creator=await aiController.organizers(m.id);m.entries=(await contract!.raffleEntries(m.id)).map(Number);}
      if(version>=5&&creationFees)m.creationFee={tier:Number(await creationFees.tiers(contractAddress,m.id)),amount:formatEther(await creationFees.paid(contractAddress,m.id))};
      if(version>=3){const a=await contract!.automation(m.id);m.automation={enabled:a.enabled,pythReserve:formatEther(a.pythReserve),executionReserve:formatEther(a.executionReserve)};}
      if (m.mode === 4 || m.mode===6 || (m.mode===0&&m.automation?.enabled)) { const d=await contract!.draws(m.id); m.entries=(await contract!.raffleEntries(m.id)).map(Number); m.draw={sequence:d.sequence.toString(),provider:d.provider,seed:d.seed,requested:d.requested,ready:d.ready,settled:d.settled}; }
      if(version>=7){m.recoveryAt=Number(await contract!.recoveryAt(m.id));const r=await contract!.recoveries(m.id);m.recovery={active:r.active,scanned:r.scanned,eligible:Number(r.eligible),processed:Number(r.payoutCursor)};}
      if(m.mode===1){m.slotHolds=[];for(const wallet of await contract!.reservationHolders(m.id)){const r=await contract!.reservations(m.id,wallet);if(r.active)m.slotHolds.push({wallet,expires:Number(r.expires)});}}
    });
    await boundedRead(contributions, async c => { c.reason=await contract!.rejectionReasons(c.id); c.deliveryDeadline=Number(await contract!.deliveryDeadline(c.id)); const mode=missions.find(m=>m.id===c.missionId)?.mode;
      if(version>=3)c.randomReward=await contract!.randomReward(c.id);
      if(mode===2)c.proposal=safeJson(await contract!.proposalMetadata(c.id),contributionDefaults);
      if(mode===4){c.xUser=(await contract!.entryXUser(c.id)).toString();c.postId=(await contract!.entryPost(c.id)).toString();c.socialUrl=`https://x.com/i/web/status/${c.postId}`;c.verification=cachedSocial(c.postId!);}
    });
  }
  if (local||cloudStorage) await eventHistory(); else refreshHistory();
  for (const m of missions) Object.assign(m, events[`m${m.id}`]);
  for (const c of contributions) Object.assign(c, events[`c${c.id}`]);
  for (const c of contributions)if(missions.find(m=>m.id===c.missionId)?.aiReview)c.aiReview=linkedReview(`${chainId}:${contractAddress.toLowerCase()}:${c.id}`);
  for (const m of missions) if(m.draw) Object.assign(m.draw,events[`d${m.id}`]);
  const identities = publicIdentities();
  const addresses = [...new Set([...identities.flatMap(p => p.wallets), ...missions.map(m => m.creator), ...contributions.map(c => c.contributor)].map(s => s.toLowerCase()))];
  const profiles: Snapshot['profiles'] = await boundedRead(addresses, async address => {
    const r = await contract!.reputation(address); const credit = await contract!.credits(address);
    const accepted = Number(r.accepted); const submitted = Number(r.submitted); const own = contributions.filter(c => c.contributor.toLowerCase() === address);
    const completed = new Set(own.filter(c => c.status === 1).map(c => c.missionId)).size;
    const name = [...own].reverse().find(c => c.name)?.name || missions.find(m => m.creator.toLowerCase() === address)?.creatorName || '';
    const work=own.filter(c=>!c.randomReward&&missions.find(m=>m.id===c.missionId)?.mode!==4&&missions.find(m=>m.id===c.missionId)?.mode!==6);const rewarded=work.filter(c=>c.status===1);const workCompleted=new Set(rewarded.map(c=>c.missionId)).size;
    const workSubmitted=submitted-own.filter(c=>c.randomReward||missions.find(m=>m.id===c.missionId)?.mode===4||missions.find(m=>m.id===c.missionId)?.mode===6).length;
    const tokenRewards=version>=4?await Promise.all([...tokenMetadata.values()].map(async asset=>({asset,earned:formatUnits(await contract!.tokenEarned(address,asset.address),asset.decimals),credits:formatUnits(await contract!.tokenCredits(address,asset.address),asset.decimals),controllerCredits:aiController?formatUnits(await aiController.tokenCredits(address,asset.address),asset.decimals):'0'}))):[];
    const identity = identities.find(p => p.wallets.includes(address));
    return { address, tokenRewards, controllerCredits:aiController?formatEther(await aiController.credits(address)):'0', name: identity?.name || identity?.username || name, xId: identity?.xId, username: identity?.username, avatarUrl: identity?.avatarUrl, submitted, accepted, earned: formatEther(r.earned), completed, acceptanceRate: workSubmitted ? Math.round(rewarded.length / workSubmitted * 100) : 0, score: scoreFor(rewarded.length, workCompleted), credits: formatEther(credit) };
  });
  for (const m of missions) { const p = profiles.find(p => p.address === m.creator.toLowerCase()); if (p?.xId) m.creatorName = p.name || p.username || m.creatorName; }
  for (const c of contributions) { const p = profiles.find(p => p.address === c.contributor.toLowerCase()); if (p?.xId) c.name = p.name || p.username || c.name; }
  return { config:publicConfig(), missions: missions.reverse(), contributions: contributions.reverse(), profiles, updatedAt: new Date().toISOString(),chainTime:Number((await provider.getBlock('latest'))?.timestamp) };
}
export async function snapshot() { if(cloudStorage&&snapshotStore.data.value&&Date.now()-snapshotStore.data.time<15000)return {...snapshotStore.data.value,config:publicConfig()};if (cache && Date.now() - cacheTime < 3000) return cache; if (pending) return pending; pending = collect().then(s => { cache = s; cacheTime = Date.now();if(cloudStorage){snapshotStore.data.value=s;snapshotStore.data.time=cacheTime;snapshotStore.save();}return s; }).finally(() => { pending = undefined; }); return pending; }
export function resetProcessCache(){cache=undefined;cacheTime=0;}
export function invalidate() { cacheTime = 0;if(cloudStorage){snapshotStore.data.time=0;snapshotStore.save();} }

