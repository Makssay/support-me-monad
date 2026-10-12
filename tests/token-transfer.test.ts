import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTokenTransfer, tokenTransferAbi } from '../src/token-transfer';
import { sendMissionTransaction } from '../src/mission-transaction';
import { Interface, type TransactionReceipt } from 'ethers';
import type { RewardAsset } from '../shared/rewards';

const asset: RewardAsset = { address: '0x0000000000000000000000000000000000000011', chainId: 10143, name: 'QA', symbol: 'QA', decimals: 6, source: 'test-fixture' };
const sender = '0x0000000000000000000000000000000000000022';
const recipient = '0x0000000000000000000000000000000000000033';
const validate = (amount: string, balance = 10000000n, to = recipient, token = asset, chain = 10143) => validateTokenTransfer(token, chain, sender, to, amount, balance);
test('ERC20 sends preserve exact six and eighteen decimal amounts', () => {
 assert.equal(validate('1.000001').units, 1000001n);
 assert.equal(validate('9007199254740993.000000000000000001', 9007199254740993000000000000000001n, recipient, {...asset, decimals:18}).units, 9007199254740993000000000000000001n);
});
test('zero, negative, scientific and over-precision amounts are rejected', () => {
 for (const amount of ['0', '-1', '1e3', '1.0000001', 'NaN', '']) assert.throws(() => validate(amount));
});
test('fresh balance is enforced, exact maximum is accepted', () => {
 assert.throws(() => validate('10.000001'));
 assert.equal(validate('10').units, 10000000n);
 assert.throws(() => validate('10', 9999999n));
});
test('invalid, zero, self and token-contract recipients are rejected', () => {
 for (const to of ['bad', '0x0000000000000000000000000000000000000000', sender, asset.address]) assert.throws(() => validate('1', 10000000n, to));
});
test('wrong chain, native token and invalid decimals cannot enter ERC20 sending', () => {
 assert.throws(() => validate('1', 10000000n, recipient, asset, 143));
 assert.throws(() => validate('1', 10000000n, recipient, {...asset, source:'native'}));
 for (const decimals of [-1, 256, 1.1]) assert.throws(() => validate('1', 10000000n, recipient, {...asset, decimals}));
});
test('token sends encode the token contract, recipient and exact units without native value', async () => {
 const hash = `0x${'ab'.repeat(32)}`;
 let sends = 0;
 await sendMissionTransaction({ contractAddress:asset.address, chainId:10143, method:'transfer', abi:tokenTransferAbi, args:[recipient,1000001n],
  sendSponsored:async tx => {
   sends++;
   assert.equal(tx.to,asset.address); assert.equal(tx.value,0n);
   const decoded = new Interface(tokenTransferAbi).decodeFunctionData('transfer',tx.data);
   assert.equal(decoded[0].toLowerCase(),recipient); assert.equal(decoded[1],1000001n);
   return hash;
  }, getSigner:async()=>{throw Error('No fallback');}, waitForReceipt:async()=>({hash,status:1} as TransactionReceipt), onSent:()=>{} });
 assert.equal(sends,1);
});
test('failed transfer preflight opens no signature request', async () => {
 let sends=0;
 await assert.rejects(sendMissionTransaction({contractAddress:asset.address,chainId:10143,method:'transfer',abi:tokenTransferAbi,args:[recipient,1n],
  preflight:async()=>{throw Error('Account changed');}, sendSponsored:async()=>{sends++;return '';}, getSigner:async()=>{sends++;throw Error('No fallback');}, waitForReceipt:async()=>null,onSent:()=>{}}),/Account changed/);
 assert.equal(sends,0);
});
