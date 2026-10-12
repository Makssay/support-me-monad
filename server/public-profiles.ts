import { jsonStore, checkpoint, cloudStorage } from './persistence';
import fs from 'node:fs';
import { isSupportWallet, type IdentityUser, type Member } from './account-policy';
export interface PublicIdentity { xId: string; username: string; name: string; avatarUrl?: string; wallets: string[]; }
const file = '.data/public-x-profiles.json';
const appId = process.env.PRIVY_APP_ID || '';
const store=jsonStore<Record<string,Record<string,PublicIdentity>>>(file,{[appId]:{}});const stored=store.data;
const records = stored[appId] || (stored[appId] = {});
export function publicIdentities() { return Object.values(records); }
export function verifiedIdentity(user: IdentityUser, member: Member, previous?: PublicIdentity): PublicIdentity {
 const x = user.linked_accounts.find(a => a.type === 'twitter_oauth' && a.subject === member.xId && typeof a.verified_at === 'number');
 const wallets = user.linked_accounts.filter(a => isSupportWallet(a) && /^0x[\da-f]{40}$/i.test(a.address || '')).map(a => a.address!.toLowerCase());
 const username = /^[A-Za-z0-9_]{1,15}$/.test(member.username) ? member.username : '';
 let avatarUrl = previous?.avatarUrl;
 if (x?.profile_picture_url) {
  try { const url = new URL(x.profile_picture_url); if (url.protocol === 'https:' && url.hostname === 'pbs.twimg.com' && !url.username && !url.password) avatarUrl = url.href; } catch { /* Ignore malformed upstream pictures. */ }
 }
 return { xId: member.xId, username, name: x?.name || previous?.name || username, avatarUrl, wallets: [...new Set([...(previous?.wallets || []), ...wallets])] };
}
export function recordPublicIdentity(user: IdentityUser, member: Member) {
 const next = verifiedIdentity(user, member, records[member.xId]);
 if (JSON.stringify(records[member.xId]) === JSON.stringify(next)) return;
 records[member.xId] = next;
 store.save();
}
export function recordExternalIdentity(member: Member, wallet: string) {
 const previous = records[member.xId];
 const next = { xId: member.xId, username: member.username, name: previous?.name || member.username, avatarUrl: previous?.avatarUrl, wallets: [...new Set([...(previous?.wallets || []), wallet.toLowerCase()])] };
 if (JSON.stringify(previous) !== JSON.stringify(next)) { records[member.xId] = next; store.save(); }
}
