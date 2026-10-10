import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Interface, type TransactionReceipt } from 'ethers';
import { sendMissionTransaction, type MissionTransactionDependencies } from '../src/mission-transaction';
import abi from '../shared/abi.json';
import { CHAIN_ID } from '../shared/model';

const hash = `0x${'ab'.repeat(32)}`;
const receipt = { hash, status: 1 } as TransactionReceipt;
function request(overrides: Partial<MissionTransactionDependencies> = {}): MissionTransactionDependencies {
  return { contractAddress: '0x52A1660F907221afbc6c29c02249FD5c0a7f661b', chainId: CHAIN_ID,
    method: 'submitContribution', args: [1, '{"description":"Useful feedback"}'],
    getSigner: async () => { throw new Error('Unfunded user must not pay gas'); },
    sendSponsored: async () => hash, waitForReceipt: async () => receipt, onSent: () => {}, ...overrides };
}
test('An unfunded contributor sends the exact contribution and waits for its onchain receipt', async () => {
  let sent = ''; const d = request({ onSent: h => { sent = h; }, sendSponsored: async tx => {
    assert.equal(tx.to, d.contractAddress); assert.equal(tx.chainId, CHAIN_ID); assert.equal(tx.value, 0n);
    const decoded = new Interface(abi).decodeFunctionData('submitContribution', tx.data);
    assert.equal(decoded[0], 1n); assert.equal(decoded[1], d.args[1]); return hash;
  }, waitForReceipt: async h => { assert.equal(sent, hash); assert.equal(h, hash); return receipt; } });
  assert.equal(await sendMissionTransaction(d), receipt);
});
test('Sponsorship preserves creator funding rather than treating gas as the reward budget', async () => {
  const value = 20000000000000000n;
  await sendMissionTransaction(request({ method: 'createMissionPaid', args: [value, 2000000000, 259200, 0, 86400, '{}', 0], value,
    sendSponsored: async tx => { assert.equal(tx.value, value); return hash; } }));
});
test('Sponsor refusal never falls back to a user-paid transaction', async () => {
  let signerCalls = 0;
  await assert.rejects(sendMissionTransaction(request({ sendSponsored: async () => { throw new Error('Sponsor unavailable'); },
    getSigner: async () => { signerCalls++; throw new Error('Unexpected fallback'); } })), /Sponsor unavailable/);
  assert.equal(signerCalls, 0);
});
test('Receipt timeout does not resubmit and keeps the submitted hash available', async () => {
  let sends = 0; let submitted = '';
  await assert.rejects(sendMissionTransaction(request({ sendSponsored: async () => { sends++; return hash; },
    onSent: h => { submitted = h; }, waitForReceipt: async () => null })), /not confirmed/);
  assert.equal(sends, 1); assert.equal(submitted, hash);
});
test('A reverted sponsored transaction cannot count as successful work', async () => {
  await assert.rejects(sendMissionTransaction(request({ waitForReceipt: async () => ({ hash, status: 0 } as TransactionReceipt) })), /not confirmed/);
});
test('Mainnet and local-chain requests never reach the sponsor', async () => {
  for (const chainId of [1, 143, 31337]) {
    let sends = 0;
    await assert.rejects(sendMissionTransaction(request({ chainId, sendSponsored: async () => { sends++; return hash; } })), /Monad Testnet/);
    assert.equal(sends, 0);
  }
});
