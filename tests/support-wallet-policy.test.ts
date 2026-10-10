import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embeddedAddress, legacyWalletsToUnlink } from '../src/support-wallet-policy';
const main = { type: 'wallet', chainType: 'ethereum', connectorType: 'injected', walletClientType: 'metamask', address: '0x1111111111111111111111111111111111111111' };
const embedded = { type: 'wallet', chainType: 'ethereum', connectorType: 'embedded', walletClientType: 'privy', address: '0x2222222222222222222222222222222222222222' };
const x = { type: 'twitter_oauth' };
test('An external main wallet never satisfies the embedded-wallet requirement', () => {
 assert.equal(embeddedAddress([main, x]), undefined);
 assert.equal(embeddedAddress([main, x, embedded]), embedded.address);
});
test('A legacy wallet is only unlinked after admission, embedded creation and another login', () => {
 assert.deepEqual(legacyWalletsToUnlink([main, x], true), []);
 assert.deepEqual(legacyWalletsToUnlink([main, embedded], true), []);
 assert.deepEqual(legacyWalletsToUnlink([main, x, embedded], false), []);
 assert.deepEqual(legacyWalletsToUnlink([main, x, embedded], true), [main.address]);
});
test('Verified-member backup recovery can also retire the legacy external link', () => {
 assert.deepEqual(legacyWalletsToUnlink([main, { type: 'email' }, embedded], true), [main.address]);
});
test('Migration never unlinks an embedded wallet or a non-Ethereum wallet', () => {
 assert.deepEqual(legacyWalletsToUnlink([x, embedded, { ...main, chainType: 'solana' }], true), []);
});
