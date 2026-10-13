import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ResilientRpcProvider,rpcEndpoints} from '../server/rpc-provider';
async function node(reply:(method:string)=>unknown,chain='0x279f'){
 const methods:string[]=[];const server=createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;const p=JSON.parse(body);methods.push(p.method);
  const answer=p.method==='eth_chainId'?{result:chain}:reply(p.method);
  if(answer===null){res.statusCode=503;res.end();return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:p.id,...answer as object}));
 });await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 return {url:`http://127.0.0.1:${(server.address() as any).port}`,methods,close:()=>new Promise<void>(r=>server.close(()=>r()))};
}
const payload=(method:string)=>({jsonrpc:'2.0' as const,id:1,method,params:[]});
test('read transport failures switch RPC, cool down failed endpoint, and validate network',async()=>{
 const a=await node(()=>null),b=await node(()=>({result:'0x10'}));const p=new ResilientRpcProvider([a.url,b.url],10143,100);
 try{assert.equal((await p._send(payload('eth_blockNumber')))[0].result,'0x10');const count=a.methods.length;await p._send(payload('eth_blockNumber'));assert.equal(a.methods.length,count);
  assert.equal(b.methods.filter(m=>m==='eth_chainId').length,1);
 }finally{p.destroy();await Promise.all([a.close(),b.close()]);}
 const wrong=await node(()=>({result:'0xff'}),'0x1'),right=await node(()=>({result:'0x20'}));const q=new ResilientRpcProvider([wrong.url,right.url],10143,100);
 try{assert.equal((await q._send(payload('eth_blockNumber')))[0].result,'0x20');assert.deepEqual(wrong.methods,['eth_chainId']);}finally{q.destroy();await Promise.all([wrong.close(),right.close()]);}
});
test('contract reverts are not retried and transaction broadcasts never go to fallback',async()=>{
 const a=await node(m=>m==='eth_call'?{error:{code:3,message:'execution reverted',data:'0x'}}:null),b=await node(()=>({result:'0x10'}));const p=new ResilientRpcProvider([a.url,b.url],10143,100);
 try{assert.equal((await p._send(payload('eth_call')))[0].error.code,3);assert.equal(b.methods.length,0);await assert.rejects(p._send(payload('eth_sendRawTransaction')),/temporarily unavailable/);assert.equal(b.methods.length,0);}finally{p.destroy();await Promise.all([a.close(),b.close()]);}
});
test('RPC configuration is bounded and never puts public fallback on local QA',()=>{
 assert.equal(rpcEndpoints('https://testnet-rpc.monad.xyz',undefined,10143).length,2);
 assert.deepEqual(rpcEndpoints('http://127.0.0.1:8545','',31337),['http://127.0.0.1:8545']);
 assert.throws(()=>rpcEndpoints('http://unsafe.example','',10143));
 assert.throws(()=>rpcEndpoints('https://one','https://two,https://three,https://four',10143));
});
