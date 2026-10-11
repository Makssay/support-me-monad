export interface IdentityUser {
 id: string;
 linked_accounts: Array<{ type: string; subject?: string; username?: string | null; name?: string | null; profile_picture_url?: string | null; address?: string; chain_type?: string; wallet_client_type?: string; connector_type?: string; verified_at?: number }>;
}
export interface Member { userId: string; xId: string; username: string; joinedAt: number; }
export class AccountError extends Error {
 constructor(public code: string, message: string, public status = 403) { super(message); }
}
// Input is an authoritative Privy user, never a browser-supplied profile.
export function enroll(user: IdentityUser, members: Record<string, Member>): Member {
 const twitter = user.linked_accounts.find(a => a.type === 'twitter_oauth' && /^\d+$/.test(a.subject || '') && typeof a.verified_at === 'number');
 const existing = members[user.id];
 if (existing) {
  if (twitter && twitter.subject !== existing.xId) throw new AccountError('X_CHANGED', 'Use the X account originally linked to Support Me.');
  if (!twitter && !user.linked_accounts.some(a => a.type === 'email' && typeof a.verified_at === 'number')) throw new AccountError('LOGIN_REQUIRED', 'Sign in with X or your verified backup email.');
  return { ...existing, username: twitter?.username || existing.username };
 }
 if (!twitter) throw new AccountError('X_REQUIRED', 'Link X to join Support Me. Email is only a backup login.');
 if (Object.values(members).some(m => m.xId === twitter.subject)) throw new AccountError('X_IN_USE', 'This X account already belongs to a Support Me account. Sign in to that account.');
 return { userId: user.id, xId: twitter.subject!, username: twitter.username || '', joinedAt: Date.now() };
}
export function isSupportWallet(a: IdentityUser['linked_accounts'][number]): boolean {
 return a.type === 'wallet' && a.chain_type === 'ethereum' && (a.wallet_client_type === 'privy' || a.wallet_client_type === 'dynamic') && a.connector_type === 'embedded' && typeof a.verified_at === 'number';
}
export function ownsWallet(user: IdentityUser, wallet: string): boolean {
 return /^0x[\da-f]{40}$/i.test(wallet) && user.linked_accounts.some(a => isSupportWallet(a) && a.address?.toLowerCase() === wallet.toLowerCase());
}
