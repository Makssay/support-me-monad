import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeWalletChoice} from '../src/wallet-choices';
test('Legacy and EIP-6963 duplicate wallet names share one choice using the announced provider',()=>{
 const legacy={},announced={},backpack={},backpackProxy={};
 let list=mergeWalletChoice([],legacy,'Rabby');list=mergeWalletChoice(list,announced,'Rabby Wallet');
 list=mergeWalletChoice(list,backpack,'Backpack');list=mergeWalletChoice(list,backpackProxy,'Backpack');
 assert.deepEqual(list,[{name:'Rabby',provider:announced},{name:'Backpack',provider:backpackProxy}]);
});
test('Different wallets remain independently selectable and repeat announcements stay stable',()=>{
 const rabby={},metamask={};const list=mergeWalletChoice(mergeWalletChoice([],rabby,'Rabby'),metamask,'MetaMask');
 assert.equal(list.length,2);assert.equal(mergeWalletChoice(list,metamask,'MetaMask'),list);
});
