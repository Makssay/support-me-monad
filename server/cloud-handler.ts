import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { app } from './index';
import { durableOperation, cloudStorage, readPublicSnapshot } from './persistence';
import { resetProcessCache, chainId, contractAddress, publicConfig } from './chain';
import { publicSnapshot } from './public-snapshot';
import type { Snapshot } from '../shared/model';
import { runAutomationTick } from './automation';
export const config = { maxDuration: 240 };
function permitted(header: string | undefined) {
 const expected=process.env.SCHEDULER_SECRET||'';const actual=header?.replace(/^Bearer /,'')||'';
 return !!expected && Buffer.byteLength(actual)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
}
export default async function handler(req: IncomingMessage, res: ServerResponse) {
 const path=new URL(req.url||'/', 'https://local.invalid').pathname;
 res.setHeader('Cache-Control','no-store');
 if(path==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:cloudStorage,storage:cloudStorage?'d1':'not_configured'}));return;}
 if(!cloudStorage){res.statusCode=503;res.end(JSON.stringify({error:'Durable storage is not configured.'}));return;}
 if(path==='/api/config'||path==='/api/rpc') { app(req,res);return; }
 let displaySnapshot: Snapshot | undefined;
 const sendSnapshot = (value:Snapshot) => {res.statusCode=200;res.removeHeader('Content-Length');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...value,config:publicConfig()}));};
 if(path==='/api/state'&&req.method==='GET') {
  try {
   const stored=await readPublicSnapshot();
   displaySnapshot=publicSnapshot(stored.data,chainId,contractAddress);
   if(displaySnapshot&&(!displaySnapshot.stale||stored.busy)){sendSnapshot(displaySnapshot);return;}
  } catch { /* The normal fresh read can still recover if the cache read fails. */ }
 }
 if(path==='/api/internal/tick') {
  if(req.method!=='POST'||!permitted(req.headers.authorization)){res.statusCode=401;res.end(JSON.stringify({error:'Not authorized.'}));return;}
  try { const result=await durableOperation(async()=>{resetProcessCache();await runAutomationTick();return {ok:true};});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result)); }
  catch {res.statusCode=503;res.end(JSON.stringify({error:'Executor temporarily unavailable.'}));}return;
 }
 // Express only emits JSON or redirects for API routes. Buffer its final end
 // until every persisted invariant is committed; no success/signature can
 // escape if D1 rejects the lease or a durable write fails.
 const originalEnd=res.end.bind(res);let captured:any[]|undefined;
 try {
  await durableOperation(async()=>{
   resetProcessCache();
   await new Promise<void>((resolve,reject)=>{
    res.end=((...args:any[])=>{captured=args;resolve();return res;}) as typeof res.end;
    try{app(req,res);}catch(e){reject(e);}
   });
  });
  res.end=originalEnd;
  if(displaySnapshot&&res.statusCode>=500){sendSnapshot({...displaySnapshot,stale:true});return;}
  originalEnd(...(captured||[]) as [any]);
 } catch {
  res.end=originalEnd;
  if(displaySnapshot&&!res.headersSent){sendSnapshot({...displaySnapshot,stale:true});return;}
  if(!res.headersSent){res.removeHeader('Content-Length');res.removeHeader('Location');res.setHeader('Content-Type','application/json');res.statusCode=503;}
  originalEnd(JSON.stringify({error:'Another operation is in progress or storage is unavailable. Retry shortly.'}));
 }
}
