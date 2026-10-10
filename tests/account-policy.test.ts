import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyAccessToken } from '@privy-io/node';
import { enroll, ownsWallet, type IdentityUser, type Member } from '../server/account-policy';
const wallet = '0x1111111111111111111111111111111111111111';
const x = (subject = '123456789') => ({ type: 'twitter_oauth', subject, username: 'creator', verified_at: 1 });
const email = { type: 'email', address: 'backup@example.com', verified_at: 2 };
function user(accounts: IdentityUser['linked_accounts'], id = 'did:privy:one'): IdentityUser { return { id, linked_accounts: accounts }; }
test('New email-only and wallet-only identities cannot join Support Me', () => {
 for (const accounts of [[email], [{ type: 'wallet', address: wallet, verified_at: 1 }]]) assert.throws(() => enroll(user(accounts), {}), /Link X/);
});
test('Only verified numeric X IDs can enroll', () => {
 for (const account of [{ type: 'twitter_oauth', subject: '123' }, x('creator')]) assert.throws(() => enroll(user([account]), {}), /Link X/);
 assert.equal(enroll(user([x()]), {}).xId, '123456789');
});
test('Backup login preserves original identity, join date and X ID even without X linked', () => {
 const original = enroll(user([x()]), {}); const records = { [original.userId]: original };
 assert.deepEqual(enroll(user([email]), records), original);
 assert.deepEqual(enroll(user([email, x()]), records), original);
});
test('Changing X cannot reset membership or obtain another raffle identity', () => {
 const original = enroll(user([x()]), {});
 assert.throws(() => enroll(user([email, x('999')]), { [original.userId]: original }), /originally linked/);
});
test('Same X cannot enroll a second Privy account', () => {
 const original = enroll(user([x()]), {});
 assert.throws(() => enroll(user([x()], 'did:privy:two'), { [original.userId]: original }), /already belongs/);
});
test('A backup email must still be verified and membership must already exist', () => {
 const original = enroll(user([x()]), {}); const records: Record<string, Member> = { [original.userId]: original };
 assert.throws(() => enroll(user([{ type: 'email', address: email.address }]), records), /verified backup/);
 assert.throws(() => enroll(user([email], 'did:privy:other'), records), /Link X/);
});
test('Wallet signatures must also belong to a verified linked Ethereum wallet', () => {
 assert.equal(ownsWallet(user([{ type: 'wallet', chain_type: 'ethereum', wallet_client_type: 'privy', connector_type: 'embedded', address: wallet, verified_at: 1 }]), wallet.toUpperCase().replace('0X', '0x')), true);
 for (const accounts of [[email], [{ type: 'wallet', chain_type: 'solana', address: wallet, verified_at: 1 }], [{ type: 'wallet', chain_type: 'ethereum', address: wallet }], [{ type: 'wallet', chain_type: 'ethereum', wallet_client_type: 'metamask', connector_type: 'injected', address: wallet, verified_at: 1 }]]) assert.equal(ownsWallet(user(accounts), wallet), false);
});
test('Official Privy verifier rejects forged, expired and wrong-app tokens', async () => {
 const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
 const key = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
 const now = Math.floor(Date.now() / 1000);
 function token(overrides: Record<string, unknown> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'privy.io', aud: 'test-app', sub: 'did:privy:one', sid: 'session', iat: now, exp: now + 300, ...overrides })).toString('base64url');
  const data = `${header}.${payload}`;
  return `${data}.${sign('sha256', Buffer.from(data), { key: pair.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
 }
 const check = (access_token: string) => verifyAccessToken({ access_token, app_id: 'test-app', verification_key: key });
 assert.equal((await check(token())).user_id, 'did:privy:one');
 for (const bad of [token({ aud: 'other-app' }), token({ exp: now - 600 }), token({ iss: 'attacker' }), `${token().split('.').slice(0, 2).join('.')}.${'AA'.repeat(64)}`]) await assert.rejects(check(bad));
});
