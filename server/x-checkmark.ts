import { jsonStore, checkpoint, cloudStorage } from './persistence';
import fs from 'node:fs';
import './env-normalize';
import {reserveSocialLookup} from './social';

export interface XCheckmark {userId:string;status:'verified'|'not_verified'|'unavailable';checkedAt:number;}
const file='.data/x-checkmarks.json';
const store=jsonStore<Record<string,XCheckmark>>(file,{});const cache=store.data;
const pending=new Map<string,Promise<XCheckmark>>();
const ttl=(r:XCheckmark)=>r.status==='unavailable'?60000:900000;
export function parseXCheckmark(profile:any,userId:string):XCheckmark['status']{
 if(!profile||profile.id_str!==userId)return 'unavailable';
 // Explicit type wins if the provider includes one; gold/gray are not blue.
 const badgeType=profile.verification_info?.type??profile.verified_type;
 if(badgeType!==undefined){
  if(typeof badgeType!=='string')return 'unavailable';
  if(['business','government','gold','gray','grey','none'].includes(badgeType.toLowerCase()))return 'not_verified';
  if(!['blue','individual'].includes(badgeType.toLowerCase()))return 'unavailable';
 }
 if(typeof profile.is_blue_verified==='boolean')return profile.is_blue_verified?'verified':'not_verified';
 // SocialData documents users-by-ids `verified` as its Blue-checkmark status.
 // Never use the deprecated users-by-usernames endpoint or a tweet's generic flag.
 return typeof profile.verified==='boolean'?(profile.verified?'verified':'not_verified'):'unavailable';
}
export async function checkXBlue(userId:string,apiKey=process.env.SOCIAL_DATA_API_KEY,fetcher:typeof fetch=fetch):Promise<XCheckmark>{
 const unavailable=():XCheckmark=>({userId,status:'unavailable',checkedAt:Date.now()});
 if(!/^\d{1,20}$/.test(userId)||!apiKey)return unavailable();
 const live=fetcher===fetch;
 if(live){const previous=cache[userId];if(previous&&Date.now()>=previous.checkedAt&&Date.now()-previous.checkedAt<ttl(previous))return previous;const inflight=pending.get(userId);if(inflight)return inflight;if(!reserveSocialLookup())return unavailable();}
 const task=(async():Promise<XCheckmark>=>{await checkpoint();try{
  const response=await fetcher('https://api.socialdata.tools/twitter/users-by-ids',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({ids:[userId]}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)return unavailable();const body=await response.json();
  if(!Array.isArray(body.users)||body.users.length!==1)return unavailable();
  return {userId,status:parseXCheckmark(body.users[0],userId),checkedAt:Date.now()};
 }catch{return unavailable();}})();
 if(live)pending.set(userId,task);
 try{const result=await task;if(live){cache[userId]=result;store.save();}return result;}finally{if(live)pending.delete(userId);}
}
