import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEther, type ContractRunner, type Provider } from 'ethers';
import { prepareMissionTransaction, TransactionPreflightError } from '../src/transaction-preflight';
import { sendMissionTransaction } from '../src/mission-transaction';
const transaction={to:'0x52A1660F907221afbc6c29c02249FD5c0a7f661b',data:'0x',value:parseEther('2'),chainId:10143};
function dependencies(balance= '3') { return {balance:async()=>parseEther(balance),estimateGas:async()=>612970n,fees:async()=>({gasPrice:102000000000n,maxFeePerGas:null,maxPriorityFeePerGas:null})}; }
test('the reported 1.94747706 MON balance cannot fund two MON and never opens a signer',async()=>{
 let signerCalls=0,sends=0;
 await assert.rejects(sendMissionTransaction({contractAddress:transaction.to,chainId:10143,method:'createMissionPaid',args:[parseEther('1'),2000000000,259200,0,86400,'{}',0],value:transaction.value,
 preflight:(tx,sponsored)=>prepareMissionTransaction(tx,sponsored,dependencies('1.94747706')),
 getSigner:async()=>{signerCalls++;throw Error('Unexpected signer');},waitForReceipt:async()=>null,onSent:()=>{sends++;}}),TransactionPreflightError);
 assert.equal(signerCalls,0);assert.equal(sends,0);
});
test('value alone is insufficient: reserve the quoted maximum gas fee before sending',async()=>{
 await assert.rejects(prepareMissionTransaction(transaction,false,dependencies('2.01')),e=>e instanceof TransactionPreflightError&&e.values?.required==='2.068775234');
 const q=await prepareMissionTransaction(transaction,false,dependencies());assert.equal(q.gasLimit,674267n);assert.equal(q.gasPrice,102000000000n);
});
test('sponsored zero-value participation does not require a user balance or fee quote',async()=>{
 const unexpected=async():Promise<never>=>{throw Error('Unexpected balance/gas access');};
 assert.deepEqual(await prepareMissionTransaction({...transaction,value:0n},true,{balance:unexpected,estimateGas:unexpected,fees:unexpected}),{});
});
test('sponsor covers gas, while rewards must come from the creator',async()=>{
 const d=dependencies('2');d.estimateGas=async()=>{throw Error('Sponsor estimates gas');};
 assert.deepEqual(await prepareMissionTransaction(transaction,true,d),{});
 await assert.rejects(prepareMissionTransaction(transaction,true,dependencies('1')),TransactionPreflightError);
});
test('fee quote preserves EIP-1559 caps; reverted estimates never use fallback gas',async()=>{
 const d={...dependencies(),fees:async()=>({gasPrice:null,maxFeePerGas:100000000000n,maxPriorityFeePerGas:2000000000n})};
 assert.deepEqual(await prepareMissionTransaction(transaction,false,d),{gasLimit:674267n,maxFeePerGas:100000000000n,maxPriorityFeePerGas:2000000000n});
 await assert.rejects(prepareMissionTransaction(transaction,false,{...d,estimateGas:async()=>{throw Error('sensitive provider details');}}),e=>e instanceof TransactionPreflightError&&!e.message.includes('sensitive'));
 await assert.rejects(prepareMissionTransaction(transaction,false,{...d,estimateGas:async()=>30000000n}),TransactionPreflightError);
});
test('self-paid contract request sends the precise preflight gas quote and value',async()=>{
 let request:any;const receipt={status:1,hash:'0x'+'ab'.repeat(32),logs:[]};
 const runner:ContractRunner={provider:{getTransactionReceipt:async()=>receipt} as unknown as Provider,sendTransaction:async(tx)=>{request=tx;return {hash:receipt.hash,wait:async()=>receipt} as any;}};
 await sendMissionTransaction({contractAddress:transaction.to,chainId:10143,method:'createMissionPaid',args:[parseEther('1'),2000000000,259200,0,86400,'{}',0],value:transaction.value,
 preflight:async()=>({gasLimit:674267n,gasPrice:102000000000n}),getSigner:async()=>runner,waitForReceipt:async()=>null,onSent:()=>{}});
 assert.equal(request.gasLimit,674267n);assert.equal(request.gasPrice,102000000000n);assert.equal(request.value,transaction.value);
});
