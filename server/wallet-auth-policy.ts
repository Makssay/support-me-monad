import { createHash, randomBytes } from 'node:crypto';
import { getAddress, verifyMessage } from 'ethers';
import { walletLoginMessage, type WalletLoginChallenge } from '../shared/wallet-auth';
import { socialPostId, type Verification } from '../shared/model';
export interface WalletBinding { wallet: string; xId: string; username: string; joinedAt: number; }
interface LinkProof { wallet: string; code: string; anchor: string; issued: number; expires: number; }
export interface WalletAuthData {
 challenges: Record<string, WalletLoginChallenge>;
 links: Record<string, LinkProof>;
 bindings: Record<string, WalletBinding>;
 sessions: Record<string, { wallet: string; expires: number }>;
}
export const emptyWalletAuth = (): WalletAuthData => ({ challenges: {}, links: {}, bindings: {}, sessions: {} });
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const secret = () => randomBytes(32).toString('hex');
export class WalletAuthPolicy {
 constructor(readonly data: WalletAuthData, readonly origin: string, readonly chainId: number, readonly anchor: string, readonly save: () => void, readonly now = Date.now) {}
 prune() {
  for (const map of [this.data.challenges, this.data.links, this.data.sessions]) for (const [id, value] of Object.entries(map)) if (value.expires <= this.now()) delete map[id];
 }
 challenge(wallet: string) {
  const normalized = getAddress(wallet).toLowerCase();
  this.prune();
  if (Object.keys(this.data.challenges).length >= 10000) throw new Error('Wallet sign-in is busy. Try again shortly.');
  const c = { id: secret(), wallet: normalized, origin: this.origin, chainId: this.chainId, issued: this.now(), expires: this.now() + 300000 };
  this.data.challenges[c.id] = c; this.save();
  return { id: c.id, message: walletLoginMessage(c), expires: c.expires };
 }
 login(id: string, signature: string) {
  if (!/^[a-f0-9]{64}$/.test(id) || !/^0x[\da-f]{130}$/i.test(signature)) throw new Error('Wallet signature did not match.');
  const c = this.data.challenges[id];
  if (!c || c.expires <= this.now() || c.origin !== this.origin || c.chainId !== this.chainId) throw new Error('Wallet sign-in expired. Connect again.');
  if (verifyMessage(walletLoginMessage(c), signature).toLowerCase() !== c.wallet) throw new Error('Wallet signature did not match.');
  delete this.data.challenges[id];
  const binding = this.data.bindings[c.wallet];
  if (binding) return this.issue(binding);
  if (!socialPostId(this.anchor)) { this.save(); throw new Error('Wallet sign-in is not configured yet. Use Privy for now.'); }
  const linkToken = secret();
  for (const [key, proof] of Object.entries(this.data.links)) if (proof.wallet === c.wallet) delete this.data.links[key];
  const proof = { wallet: c.wallet, code: `SM-${randomBytes(16).toString('hex')}`, anchor: this.anchor, issued: this.now(), expires: this.now() + 1800000 };
  this.data.links[tokenHash(linkToken)] = proof; this.save();
  return { linkToken, ...proof };
 }
 pending(token: string) {
  const p = this.data.links[tokenHash(token)];
  if (!p || p.expires <= this.now()) throw new Error('X verification expired. Connect your wallet again.');
  return p;
 }
 link(token: string, reply: Verification) {
  const p = this.pending(token);
  const posted = Date.parse(reply.postedAt || '');
  if (reply.status !== 'verified' || !/^\d{1,20}$/.test(reply.authorId || '') || !/^[A-Za-z0-9_]{1,15}$/.test(reply.author || '')) throw new Error('Could not verify the public reply. Please retry.');
  if (reply.replyTo !== socialPostId(p.anchor)) throw new Error('Reply directly to the Support Me verification post.');
  if (!reply.text?.split(/\s+/).includes(p.code)) throw new Error('The reply must contain your verification code as a separate word.');
  if (!Number.isFinite(posted) || posted < Math.floor(p.issued / 1000) * 1000 || posted >= p.expires || posted > this.now() + 30000) throw new Error('Publish a new reply after connecting your wallet.');
  const previous = this.data.bindings[p.wallet];
  if (previous && previous.xId !== reply.authorId) throw new Error('Use the X account already linked to this wallet.');
  if (Object.values(this.data.bindings).some(b => b.xId === reply.authorId && b.wallet !== p.wallet)) throw new Error('This X account is already linked to another external wallet.');
  const binding = previous || { wallet: p.wallet, xId: reply.authorId!, username: reply.author!, joinedAt: this.now() };
  this.data.bindings[p.wallet] = binding;
  delete this.data.links[tokenHash(token)];
  return this.issue(binding);
 }
 issue(binding: WalletBinding) {
  this.prune();
  for (const [key, session] of Object.entries(this.data.sessions)) if (session.wallet === binding.wallet) delete this.data.sessions[key];
  const token = secret(), expires = this.now() + 86400000;
  this.data.sessions[tokenHash(token)] = { wallet: binding.wallet, expires }; this.save();
  return { token, expires, wallet: binding.wallet, xId: binding.xId, username: binding.username, backupEmail: false };
 }
 identify(token: string) {
  const session = this.data.sessions[tokenHash(token)];
  const binding = session && session.expires > this.now() ? this.data.bindings[session.wallet] : undefined;
  if (!binding) throw new Error('Your wallet sign-in expired. Connect again.');
  return binding;
 }
 logout(token: string) { delete this.data.sessions[tokenHash(token)]; this.save(); }
}
