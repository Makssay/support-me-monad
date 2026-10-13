import { formatUnits, parseUnits } from 'ethers';
import { sameAddress, scoreFor, type Profile, type Snapshot } from './model';

export type IdentityProfile = Profile & { wallets: string[] };

// X IDs come from verified sign-in records. Names and handles are never merge keys.
export function identityWallets(address: string | undefined, profiles: Profile[] = []): string[] {
 if (!address) return [];
 const member = profiles.find(p => sameAddress(p.address, address));
 return member?.xId ? profiles.filter(p => p.xId === member.xId).map(p => p.address) : [address];
}

export function identityProfiles(state: Pick<Snapshot, 'profiles' | 'contributions' | 'missions'>): IdentityProfile[] {
 const groups = new Map<string, Profile[]>();
 const seen = new Set<string>();
 for (const p of state.profiles) {
  const wallet = p.address.toLowerCase();
  if (seen.has(wallet)) continue;
  seen.add(wallet);
  const key = p.xId ? `x:${p.xId}` : `wallet:${wallet}`;
  groups.set(key, [...(groups.get(key) || []), p]);
 }
 return [...groups.values()].map(members => {
  const first = members[0];
  const wallets = members.map(p => p.address);
  const own = state.contributions.filter(c => wallets.some(a => sameAddress(a, c.contributor)));
  const work = own.filter(c => !c.randomReward && ![4, 6].includes(state.missions.find(m => m.id === c.missionId)?.mode || 0));
  const rewarded = work.filter(c => c.status === 1);
  const completedWork = new Set(rewarded.map(c => c.missionId)).size;
  const workSubmitted = members.reduce((n, p) => n + p.submitted, 0) - (own.length - work.length);
  const tokens = new Map<string, NonNullable<Profile['tokenRewards']>[number]>();
  for (const p of members) for (const r of p.tokenRewards || []) {
   const key = r.asset.address.toLowerCase(), previous = tokens.get(key);
   tokens.set(key, { ...r, earned: formatUnits(parseUnits(previous?.earned || '0', r.asset.decimals) + parseUnits(r.earned, r.asset.decimals), r.asset.decimals), credits: '0', controllerCredits: '0' });
  }
  return {
   ...first, wallets,
   submitted: members.reduce((n, p) => n + p.submitted, 0),
   accepted: members.reduce((n, p) => n + p.accepted, 0),
   earned: formatUnits(members.reduce((n, p) => n + parseUnits(p.earned, 18), 0n), 18),
   completed: new Set(own.filter(c => c.status === 1).map(c => c.missionId)).size,
   score: scoreFor(rewarded.length, completedWork),
   acceptanceRate: workSubmitted > 0 ? Math.round(rewarded.length / workSubmitted * 100) : 0,
   tokenRewards: [...tokens.values()],
   // Claimable balances belong to individual signing wallets, never to the group.
   credits: '0', controllerCredits: '0'
  };
 });
}

export function identityProfile(state: Pick<Snapshot, 'profiles' | 'contributions' | 'missions'>, reference: string, activeWallet?: string): IdentityProfile | undefined {
 const group = identityProfiles(state).find(p => reference === `x-${p.xId}` || p.wallets.some(a => sameAddress(a, reference)) || !!p.username && p.username.toLowerCase() === reference.toLowerCase());
 if (!group) return;
 const wallet = state.profiles.find(p => group.wallets.some(a => sameAddress(a, p.address)) && sameAddress(p.address, activeWallet)) || state.profiles.find(p => sameAddress(p.address, reference)) || state.profiles.find(p => sameAddress(p.address, group.address))!;
 const tokenRewards = group.tokenRewards?.map(r => {
  const balance = wallet.tokenRewards?.find(b => sameAddress(b.asset.address, r.asset.address));
  return { ...r, credits: balance?.credits || '0', controllerCredits: balance?.controllerCredits || '0' };
 });
 return { ...group, address: wallet.address, credits: wallet.credits, controllerCredits: wallet.controllerCredits, tokenRewards };
}
