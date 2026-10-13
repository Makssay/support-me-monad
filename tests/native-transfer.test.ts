import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEther} from 'ethers';
import {validateNativeTransfer} from '../src/native-transfer';
import {sendMissionTransaction} from '../src/mission-transaction';
import {prepareMissionTransaction} from '../src/transaction-preflight';
const sender='0x1111111111111111111111111111111111111111',recipient='0x2222222222222222222222222222222222222222';
test('native transfers validate exact amounts and reject invalid destinations and precision',()=>{
 assert.deepEqual(validateNativeTransfer(sender,recipient,'0.100000000000000001',parseEther('1')),{to:recipient,units:100000000000000001n});
 for(const to of ['0x0',sender,'0x0000000000000000000000000000000000000000'])assert.throws(()=>validateNativeTransfer(sender,to,'1',parseEther('1')));
 for(const amount of ['0','-1','1e-3','0.0000000000000000001','2'])assert.throws(()=>validateNativeTransfer(sender,recipient,amount,parseEther('1')));
});
test('native withdrawal sends MON directly to recipient with empty calldata, once',async()=>{
 const sent:any[]=[];const receipt={status:1,hash:'0xreceipt'};
 const result=await sendMissionTransaction({nativeTransfer:true,contractAddress:recipient,chainId:143,method:'sendWalletMON',args:[],value:parseEther('.1'),preflight:async tx=>{assert.equal(tx.data,'0x');return {gasLimit:23100n,gasPrice:1n};},getSigner:async()=>({sendTransaction:async(tx:any)=>{sent.push(tx);return {hash:'0xhash',wait:async()=>receipt};}} as any),waitForReceipt:async()=>null,onSent:hash=>assert.equal(hash,'0xhash')});
 assert.equal(result,receipt);assert.equal(sent.length,1);assert.equal(sent[0].to,recipient);assert.equal(sent[0].value,parseEther('.1'));assert.equal(sent[0].data,'0x');assert.equal(sent[0].gasLimit,23100n);
});
test('withdrawing the full balance without gas reserve stops before opening a wallet request',async()=>{
 let requests=0;
 await assert.rejects(sendMissionTransaction({nativeTransfer:true,contractAddress:recipient,chainId:143,method:'sendWalletMON',args:[],value:parseEther('1'),preflight:tx=>prepareMissionTransaction(tx,false,{balance:async()=>parseEther('1'),estimateGas:async()=>21000n,fees:async()=>({gasPrice:1n,maxFeePerGas:null,maxPriorityFeePerGas:null})}),getSigner:async()=>{requests++;throw Error('Unexpected wallet request');},waitForReceipt:async()=>null,onSent:()=>{}}),/including maximum gas/);
 assert.equal(requests,0);
});
test('a rejected native transfer is never automatically retried',async()=>{
 let sends=0;
 await assert.rejects(sendMissionTransaction({nativeTransfer:true,contractAddress:recipient,chainId:143,method:'sendWalletMON',args:[],value:1n,getSigner:async()=>({sendTransaction:async()=>{sends++;throw Error('User rejected');}} as any),waitForReceipt:async()=>null,onSent:()=>{}}),/User rejected/);
 assert.equal(sends,1);
});
