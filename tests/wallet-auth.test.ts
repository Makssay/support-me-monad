import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { emptyWalletAuth, tokenHash, WalletAuthPolicy } from '../server/wallet-auth-policy';
import type { Verification } from '../shared/model';
const anchor = 'https://x.com/Makssay_eth/status/2109778998876119439';
function setup() {
 let now = 1800000000000;
 const data = emptyWalletAuth();
 const policy = new WalletAuthPolicy(data, 'https://support-me.example', 10143, anchor, () => {}, () => now);
 const wallet = Wallet.createRandom();
 async function login(w = wallet) { const c = policy.challenge(w.address); return policy.login(c.id, await w.signMessage(c.message)); }
 function reply(proof: any, changes: Partial<Verification> = {}): Verification { return { status: 'verified', checkedAt: new Date(now).toISOString(), postUrl: 'https://x.com/test/status/2109778998876119440', author: 'tester', authorId: '123456789', replyTo: '2109778998876119439', text: proof.code, postedAt: new Date(now).toISOString(), note: '', ...changes }; }
 return { policy, data, wallet, login, reply, advance: (ms: number) => { now += ms; } };
}
test('Wallet alone never grants membership; a valid direct X reply issues an opaque session', async () => {
 const s = setup(), proof = await s.login(); assert.ok('linkToken' in proof); assert.equal(Object.keys(s.data.sessions).length, 0);
 const session = s.policy.link((proof as any).linkToken, s.reply(proof));
 assert.equal(s.policy.identify(session.token).wallet, s.wallet.address.toLowerCase());
 assert.ok(s.data.sessions[tokenHash(session.token)]); assert.equal(s.data.sessions[session.token], undefined);
});
test('Wrong wallet, replayed nonce, wrong domain and expired nonce cannot sign in', async () => {
 const s = setup(), c = s.policy.challenge(s.wallet.address), other = Wallet.createRandom();
 assert.throws(() => s.policy.login(c.id, other.signingKey.sign('0x' + '00'.repeat(32)).serialized), /match/);
 const signature = await s.wallet.signMessage(c.message); s.policy.login(c.id, signature); assert.throws(() => s.policy.login(c.id, signature), /expired/);
 const fresh = s.policy.challenge(s.wallet.address); const crossDomain = new WalletAuthPolicy(s.data, 'https://attacker.example', 10143, anchor, () => {}, () => 1800000000000);
 assert.throws(() => crossDomain.login(fresh.id, signature), /expired/);
 const expired = s.policy.challenge(s.wallet.address); s.advance(300001); assert.throws(() => s.policy.login(expired.id, signature), /expired/);
});
test('Quote, nested reply, missing code, partial code, missing stable ID and unavailable evidence fail closed', async () => {
 const s = setup(), p: any = await s.login();
 for (const changes of [{ replyTo: undefined }, { replyTo: '999' }, { text: 'hi' }, { text: `${p.code}-extra` }, { authorId: undefined }, { status: 'unavailable' as const }]) assert.throws(() => s.policy.link(p.linkToken, s.reply(p, changes)));
 assert.equal(Object.keys(s.data.sessions).length, 0); assert.equal(Object.keys(s.data.bindings).length, 0);
});
test('Old and future posts cannot establish ownership; expired proof cannot be used', async () => {
 const s = setup(), p: any = await s.login();
 for (const postedAt of [new Date(1799999900000).toISOString(), new Date(1800000600000).toISOString(), 'bad']) assert.throws(() => s.policy.link(p.linkToken, s.reply(p, { postedAt })));
 s.advance(1800001); assert.throws(() => s.policy.link(p.linkToken, s.reply(p)), /expired/);
});
test('X identity cannot bind a second external wallet and wallet cannot switch X identity', async () => {
 const s = setup(), p: any = await s.login(); s.policy.link(p.linkToken, s.reply(p));
 const second: any = await s.login(Wallet.createRandom()); assert.throws(() => s.policy.link(second.linkToken, s.reply(second)), /another external/);
 const p2: any = await s.login(Wallet.createRandom());
 s.data.bindings[p2.wallet] = { wallet: p2.wallet, xId: '999', username: 'old', joinedAt: 1 };
 assert.throws(() => s.policy.link(p2.linkToken, s.reply(p2)), /already linked/);
});
test('Proof is single-use; future sign-in needs only a fresh wallet signature', async () => {
 const s = setup(), p: any = await s.login(); const first = s.policy.link(p.linkToken, s.reply(p));
 assert.throws(() => s.policy.link(p.linkToken, s.reply(p)), /expired/);
 const second: any = await s.login(); assert.ok(second.token); assert.equal(second.xId, first.xId);
 assert.throws(() => s.policy.identify(first.token), /expired/);
 s.policy.logout(second.token); assert.throws(() => s.policy.identify(second.token), /expired/);
});
test('Session expiry and forged tokens cannot recover membership', async () => {
 const s = setup(), p: any = await s.login(), session = s.policy.link(p.linkToken, s.reply(p));
 assert.throws(() => s.policy.identify('0'.repeat(64)), /expired/);
 s.advance(86400001); assert.throws(() => s.policy.identify(session.token), /expired/);
});
test('Durable records restore across process restarts without a signing secret', async () => {
 const s = setup(), p: any = await s.login(), session = s.policy.link(p.linkToken, s.reply(p));
 const restored = new WalletAuthPolicy(JSON.parse(JSON.stringify(s.data)), s.policy.origin, 10143, anchor, () => {}, () => 1800000000000);
 assert.equal(restored.identify(session.token).xId, '123456789');
});
