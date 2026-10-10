import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setDefaultResultOrder } from 'node:dns';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { encodeStores } from '../server/persistence';
import artifact from '../artifacts/SupportMe.json';
import deployment from '../deployment.json';
setDefaultResultOrder('ipv4first');
const env=JSON.parse(fs.readFileSync('.data/cloud-config.json','utf8'));
if(new Wallet(env.SOCIAL_VERIFIER_PRIVATE_KEY).address.toLowerCase()!==deployment.verifier.toLowerCase())throw new Error('Cloud signer does not match the deployed verifier.');
const scopes=['auth-accounts','public-x-profiles','service-checks','reply-identities','ai-cache','social-lookups','verifications','x-checkmarks','community-10143',`automation-10143-${deployment.address.toLowerCase()}`,`events-10143-${deployment.address.toLowerCase()}`].map(s=>'.data/'+s+'.json');
const stores=new Map<string,Record<string,any>>();for(const file of scopes)if(fs.existsSync(file))stores.set(file,JSON.parse(fs.readFileSync(file,'utf8')));
const index=scopes.at(-1)!;
if(!stores.has(index)){
 const provider=new JsonRpcProvider(env.MONAD_RPC_URL||'https://testnet-rpc.monad.xyz',10143,{staticNetwork:true});
 const ledger=new Contract(deployment.address,artifact.abi,provider);
 const count=Number(await ledger.missionCount());
 stores.set(index,{events:{},lastEventBlock:count===0?await provider.getBlockNumber():deployment.block-1});
 provider.destroy();
}
const owner=randomUUID();
async function call(path:string,body:unknown){const r=await fetch(env.D1_GATEWAY_URL+path,{method:'POST',headers:{Authorization:'Bearer '+env.D1_GATEWAY_SECRET,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Cloud migration could not complete (HTTP '+r.status+').');return r.json() as Promise<any>;}
const opened=await call('/storage/acquire',{owner});
try{
 if(opened.rows.length)throw new Error('Cloud storage is already populated. Migration refuses to overwrite it.');
 const changes=[...encodeStores(stores)].map(([key,value])=>({key,value}));
 await call('/storage/commit',{owner,changes});
 const checked=await call('/storage/assert',{owner});if(!checked.ok)throw new Error('Migration verification failed.');
 console.log(`Cloud migration completed: ${stores.size} allowlisted stores, ${changes.length} records. No wallet keys or QA data imported.`);
}finally{await call('/storage/release',{owner});}
