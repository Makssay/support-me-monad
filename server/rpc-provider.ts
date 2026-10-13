import { JsonRpcProvider, type JsonRpcPayload } from 'ethers';

const reads=new Set(['eth_chainId','eth_blockNumber','eth_call','eth_estimateGas','eth_getBalance','eth_getTransactionCount','eth_getTransactionReceipt','eth_getTransactionByHash','eth_gasPrice','eth_maxPriorityFeePerGas','eth_getBlockByNumber','eth_feeHistory','eth_getLogs','net_version']);
// Retry reads on independent infrastructure; never replay a broadcast or wallet
// command. Ordinary contract errors are returned unchanged to ethers.
export class ResilientRpcProvider extends JsonRpcProvider {
 private verified=new Set<string>();
 private cooling=new Map<string,number>();
 constructor(private endpoints:string[],private expectedChain:number,private timeoutMs=4000){
  super(endpoints[0],expectedChain,{staticNetwork:true,batchMaxCount:1});
 }
 private async request(url:string,payload:JsonRpcPayload|JsonRpcPayload[]){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(this.timeoutMs)});
  if(!response.ok)throw new Error('RPC transport unavailable.');
  const data=await response.json();
  const rows=Array.isArray(data)?data:[data];const sent=Array.isArray(payload)?payload:[payload];
  if(rows.length!==sent.length||rows.some((row:any)=>!row||row.jsonrpc!=='2.0'||!sent.some(p=>p.id===row.id)||!('result' in row)&&!row.error))throw new Error('Invalid RPC response.');
  return rows;
 }
 override async _send(payload:JsonRpcPayload|JsonRpcPayload[]):Promise<any[]> {
  const safe=(Array.isArray(payload)?payload:[payload]).every(p=>reads.has(p.method));
  const endpoints=safe?this.endpoints:[this.endpoints[0]];
  for(const url of endpoints){
   if(safe&&(this.cooling.get(url)||0)>Date.now())continue;
   try {
    if(!this.verified.has(url)){
     const check=await this.request(url,{jsonrpc:'2.0',id:0,method:'eth_chainId',params:[]});
     if(Number(check[0].result)!==this.expectedChain)throw new Error('RPC network mismatch.');
     this.verified.add(url);
    }
    const result=await this.request(url,payload);
    // Provider throttling/internal failures may use a JSON-RPC error with HTTP 200.
    if(safe&&result.some((r:any)=>[-32603,-32005].includes(r.error?.code)))throw new Error('RPC unavailable.');
    return result;
   } catch { this.cooling.set(url,Date.now()+10000); }
  }
  throw new Error('Monad RPC is temporarily unavailable. Retry shortly.');
 }
}

export function rpcEndpoints(primary:string,extra:string|undefined,chain:number){
 const defaults=chain===10143?['https://rpc-testnet.monadinfra.com']:[];
 const urls=[...new Set([primary,...(extra===undefined?defaults:extra.split(',').map(s=>s.trim()).filter(Boolean))])];
 if(urls.length>3||urls.some(s=>{const u=new URL(s);return u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname));}))throw new Error('Invalid RPC configuration.');
 return urls;
}
