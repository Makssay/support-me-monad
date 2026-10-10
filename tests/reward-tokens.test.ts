import {test} from 'node:test';import assert from 'node:assert/strict';import {rewardTokenAddress} from '../shared/rewards';import {parseUnits,formatUnits} from 'ethers';
const token='0x1111111111111111111111111111111111111111';
test('nad.fun URLs resolve only exact token pages and never fetch arbitrary hosts',()=>{assert.equal(rewardTokenAddress(token),token);assert.equal(rewardTokenAddress(`https://nad.fun/tokens/${token}`),token);assert.equal(rewardTokenAddress(`https://testnet.nad.fun/tokens/${token}`),token);for(const value of [`https://evil.example/tokens/${token}`,`https://nad.fun@evil.example/tokens/${token}`,`http://nad.fun/tokens/${token}`,`https://nad.fun/tokens/${token}/extra`,'MON'])assert.throws(()=>rewardTokenAddress(value));});
test('Six-decimal token budgets retain exact units without MON conversions',()=>{const reward=parseUnits('0.123456',6);assert.equal(reward*3n,370368n);assert.equal(formatUnits(reward*3n,6),'0.370368');assert.throws(()=>parseUnits('0.1234567',6));});

import {number,setLocale} from '../src/i18n';
test('Token display preserves all eighteen decimal places in both languages',()=>{setLocale('en');assert.equal(number('1.123456789012345678'),'1.123456789012345678');setLocale('ru');assert.equal(number('1.123456789012345678'),'1,123456789012345678');setLocale('en');});
