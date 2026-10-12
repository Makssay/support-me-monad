export const CHAIN_ID = 10143;
export const EXPLORER = 'https://testnet.monadscan.com';
export const PUBLIC_RPC = 'https://testnet-rpc.monad.xyz';
export const categories = ['All missions', 'Memes', 'Feedback', 'Social content', 'Replies', 'Bug hunting', 'NFT holders', 'Token holders', 'Wallet list'] as const;
export type Category = typeof categories[number];
export const paymentModes = ['Creator choice', 'Paid report slots', 'Selected contributor', 'Bug bounty', 'Raffle', 'AI judged contest', 'Raffle'] as const;
export function defaultMode(category: string) { return category === 'Replies' ? 4 : category === 'Feedback' ? 1 : category === 'Social content' ? 2 : category === 'Bug hunting' ? 3 : 0; }
// Display legacy immutable missions under the closest current category.
export function normalizeCategory(category: string) { return category === 'Testing' ? 'Feedback' : category === 'Launch support' ? 'Social content' : category; }
export const paymentRules = ['Only selected work is paid. The organizer chooses; hidden organizer accounts cannot be ruled out.', 'Reserve a paid place before working. Reports meeting the published checklist should be paid, including negative feedback and tests that find no bugs. Creator approval is required.', 'Send a short proposal first. Start full work only after selection reserves your reward. Payment requires acceptance of the agreed delivery.', 'Only reproducible, in-scope, confirmed bugs are paid. Duplicate issues are paid once; classification and earliest complete report are reviewed by the creator.', 'A verified direct reply enters a random draw, not a guaranteed payment. Pyth Entropy selects winners from the onchain list. Multiple-account abuse remains possible.'];
paymentRules.push('Only the highest-scoring eligible entries are paid. A fixed AI rubric ranks anonymous text after the deadline. The signing service is trusted; the creator cannot override winners. AI and multiple-account abuse remain limitations.');
paymentRules.push('Verify the published community requirement and enter. No work or reply is needed. Pyth randomly selects winners; entry does not guarantee payment.');
export const protectedPaymentRules:Record<number,string> = {"0":"The creator selects winners before review ends. Remaining prizes are randomly assigned to remaining submissions after timeout. Contest entries cannot be rejected. Hidden organizer accounts and spam remain possible.","1":"Reserve a paid place before working. Submit the agreed checklist on time. The creator can accept or decline with a public reason; delivered pending work is paid automatically after the review deadline.","2":"Send a proposal first. Work only after selection reserves a reward. Deliver on time; if the creator does not review before the deadline, your pending delivery is paid automatically."};
export function paymentRule(mode:number,protectedMode=false){return protectedMode?(protectedPaymentRules[mode]||paymentRules[mode]):paymentRules[mode];}
export interface MissionMeta { communityHash?: string; communitySummary?: string; title: string; description: string; category: string; creatorName: string; requirements: string; socialRequired: boolean; targetPost: string; aiReview?: boolean; aiModel?: string; aiVersion?: string; aiRubric?: string; }
export interface ContributionMeta { name: string; text: string; socialUrl: string; }
// X work must be assessed from fetched publication text, never a participant's description.
export function requiresXEvidence(meta: Pick<MissionMeta, 'category' | 'socialRequired'>, socialUrl = '') {
 return meta.socialRequired || ['Replies', 'Social content'].includes(meta.category) || !!socialPostId(socialUrl);
}
export interface Verification { status: 'verified' | 'unavailable' | 'not_found' | 'unsupported' | 'manual'; checkedAt: string; author?: string; authorId?: string; replyTo?: string; postedAt?: string; text?: string; likes?: number; reposts?: number; postUrl?: string; note: string; }
// A verified publication is not necessarily a reply to the requested post.
// Apply mission context after the provider cache, which is shared across missions.
export function missionEvidence(meta: Pick<MissionMeta,'category'|'targetPost'>, evidence: Verification): Verification {
 if(meta.category!=='Replies'||!meta.targetPost||evidence.status!=='verified')return evidence;
 if(!socialPostId(meta.targetPost)||evidence.replyTo!==socialPostId(meta.targetPost))return {...evidence,status:'unsupported',note:'This must be a direct reply to the requested post. Quotes and replies to other comments do not qualify.'};
 return evidence;
}
export interface Mission extends MissionMeta { closedTx?:string; refundRaw?:string; refundTransferred?:boolean; recoveryAt?: number; recovery?: {active:boolean; scanned:boolean; eligible:number; processed:number}; creationFee?: { tier:number; amount:string }; rewardAsset?: import('./rewards').RewardAsset; automation?: { enabled:boolean; pythReserve:string; executionReserve:string }; id: number; creator: string; reward: string; remaining: string; deadline: number; closed: boolean; createdTx?: string; mode?: number; reviewDeadline?: number; workWindow?: number; reserved?: number; pending?: number; slots?: number; entries?: number[]; slotHolds?: {wallet:string;expires:number}[]; draw?: { sequence: string; provider: string; seed: string; requested: boolean; ready: boolean; settled: boolean; requestTx?: string; resultTx?: string; }; }
export interface Contribution extends ContributionMeta { rewardAsset?: import('./rewards').RewardAsset; randomReward?:boolean; id: number; missionId: number; contributor: string; status: number; paid: string; verification?: Verification; submittedTx?: string; payoutTx?: string; transferred?: boolean; reason?: string; deliveryDeadline?: number; xUser?: string; postId?: string; proposal?: ContributionMeta; aiReview?: import('./ai').AIReview; }
export interface Profile { controllerCredits?: string; tokenRewards?: { asset: import('./rewards').RewardAsset; earned: string; credits: string; controllerCredits?: string }[]; xId?: string; username?: string; avatarUrl?: string; address: string; name: string; submitted: number; accepted: number; earned: string; completed: number; acceptanceRate: number; score: number; credits: string; }
export interface AppConfig { authProvider?: 'privy' | 'dynamic'; dynamicEnvironmentId?: string; dynamicGasSponsorship?: boolean; communityGate?: string; creationFees?: string; publicRpc?: string; chainId: number; contractAddress: string; explorer: string; socialConfigured: boolean; local: boolean; privyAppId?: string; gasSponsorship?: boolean; version?: number; legacyAddress?: string; aiController?: string; aiConfigured?: boolean; automationConfigured?: boolean; }
export interface Snapshot { config: AppConfig; missions: Mission[]; contributions: Contribution[]; profiles: Profile[]; updatedAt: string; chainTime?: number; stale?: boolean; }
export const sameAddress = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const shortAddress = (s: string) => s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '';
export const verificationMessage = (id: number, address: string, chainId: number, timestamp: number) => `Support Me\nVerify contribution ${id}\nContract ${address.toLowerCase()}\nChain ${chainId}\nTime ${timestamp}`;
export function safeJson<T>(value: string, defaults: T): T { try { const parsed = JSON.parse(value); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults; return Object.fromEntries(Object.entries(defaults as Record<string, unknown>).map(([k, v]) => [k, typeof parsed[k] === typeof v ? parsed[k] : v])) as T; } catch { return defaults; } }
export const missionDefaults: MissionMeta = { title: 'Untitled mission', description: '', category: 'Feedback', creatorName: '', requirements: '', socialRequired: false, targetPost: '', communityHash: '', communitySummary: '', aiReview: false, aiModel: '', aiVersion: '', aiRubric: '' };
export const replyMessage = (purpose: string, id: number, contract: string, chain: number, wallet: string, timestamp: number, url = '') => `Support Me\n${purpose}\nMission ${id}\nContract ${contract.toLowerCase()}\nChain ${chain}\nWallet ${wallet.toLowerCase()}\nTime ${timestamp}\nPost ${url}`;
export const contributionDefaults: ContributionMeta = { name: '', text: '', socialUrl: '' };
export function socialPostId(value: string): string | null {
  try { const url = new URL(value); if (url.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname) || url.username || url.password) return null; return url.pathname.match(/^\/(?:[A-Za-z0-9_]+|i\/web)\/status\/(\d{1,25})\/?$/)?.[1] ?? null; } catch { return null; }
}
export function safeLink(value: string): string | undefined { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; } }
export function scoreFor(accepted: number, completed: number) { return accepted * 10 + completed * 5; }

export function profilePath(address: string, profiles: Profile[] = []) {
 const profile = profiles.find(p => sameAddress(p.address, address));
 return `/profile/${profile?.xId ? `x-${profile.xId}` : address}`;
}
