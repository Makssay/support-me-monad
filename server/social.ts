import { jsonStore, checkpoint, cloudStorage } from './persistence';
import fs from 'node:fs';
import './env-normalize';
import { socialPostId, type Verification } from '../shared/model';
const file = '.data/social-lookups.json';
const store=jsonStore(file,{cached:{} as Record<string,Verification>,total:0,days:{} as Record<string,number>});const saved=store.data;const cached=saved.cached;const days=saved.days;
const inFlight = new Map<string,Promise<Verification>>();
const persist=store.save;
export function lookupUsage() { const day=new Date().toISOString().slice(0,10); return { today:days[day]||0,total:saved.total,dailyLimit:Number(process.env.SOCIAL_LOOKUP_DAILY_LIMIT||100),totalLimit:Number(process.env.SOCIAL_LOOKUP_TOTAL_LIMIT||1000) }; }
// Shared hard cap for tweet and profile requests; reserve synchronously before fetching.
export function reserveSocialLookup(){const usage=lookupUsage();if(usage.today>=usage.dailyLimit||usage.total>=usage.totalLimit)return false;saved.total++;const day=new Date().toISOString().slice(0,10);days[day]=(days[day]||0)+1;persist();return true;}
export const cachedSocial = (post: string) => cached[post];
export async function verifySocial(url:string,apiKey=process.env.SOCIAL_DATA_API_KEY,fetcher:typeof fetch=fetch):Promise<Verification> {
 const base={checkedAt:new Date().toISOString(),postUrl:url};
 if(!url)return {...base,status:'manual',note:'No social link. Review the contribution directly.'};
 const id=socialPostId(url); if(!id)return {...base,status:'unsupported',note:'Automatic checks support public X / Twitter post links. Review this link manually.'};
 if(!apiKey)return {...base,status:'unavailable',note:'Social verification is not configured. Creator review is still available.'};
 // Tests inject fetch and never touch the real cache, key or paid API.
 const live=fetcher===fetch;
 if(live){ const previous=cached[id]; if(previous&&Date.now()-Date.parse(previous.checkedAt)<(previous.status==='verified'?86400000:900000))return {...previous,postUrl:url};
  const pending=inFlight.get(id); if(pending)return pending;
  if(!reserveSocialLookup())return {...base,status:'unavailable',note:'The social lookup budget limit is reached. No paid request was sent. Try later or request manual review.'};
 }
 const task=(async():Promise<Verification>=>{await checkpoint();try{
  const response=await fetcher(`https://api.socialdata.tools/twitter/tweets/${id}`,{headers:{Authorization:`Bearer ${apiKey}`,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(response.status===404||response.status===403)return {...base,status:'not_found',note:'The post is missing or private. A raffle entry cannot be verified.'};
  if(!response.ok)return {...base,status:'unavailable',note:'The social service is unavailable or its balance is insufficient. No automatic retries are made.'};
  const data=await response.json(); const text=data.full_text||data.text;
  if(String(data.id_str)!==id||!data.user?.screen_name||typeof text!=='string')return {...base,status:'unavailable',note:'The service returned incomplete evidence. Review manually.'};
  return {...base,status:'verified',author:String(data.user.screen_name).slice(0,50),authorId:data.user.id_str?String(data.user.id_str):undefined,replyTo:data.in_reply_to_status_id_str?String(data.in_reply_to_status_id_str):undefined,postedAt:data.tweet_created_at||data.created_at,text:text.slice(0,6000),likes:Number(data.favorite_count)||0,reposts:Number(data.retweet_count)||0,note:'Public post found. This confirms evidence, not work quality or ownership of the submitting wallet.'};
 }catch{return {...base,status:'unavailable',note:'The social check timed out. No automatic retries are made.'};}})();
 if(live)inFlight.set(id,task);
 try{const result=await task;if(live){cached[id]=result;persist();}return result;}finally{if(live)inFlight.delete(id);}
}
export function replyEligibility(reply:Verification,target:Verification,token:string,start:number,end:number,creatorX?:string):string|undefined {
 if(reply.status!=='verified'||target.status!=='verified')return 'Public reply and original post must both be available.';
 if(reply.replyTo!==socialPostId(target.postUrl||''))return 'This must be a direct reply to the contest post, not another reply or a quote.';
 if(!reply.authorId||!/^\d+$/.test(reply.authorId))return 'The provider did not return a stable X user ID.';
 if(reply.authorId===target.authorId||reply.authorId===creatorX)return 'The organizer or original post author cannot enter.';
 if(!reply.text?.split(/\s+/).includes(token))return 'Include your personal verification code as a separate word in the reply.';
 const posted=Date.parse(reply.postedAt||'')/1000;if(!Number.isFinite(posted)||posted<start||posted>=end)return 'The reply must be posted after your code was issued and before the contest deadline.';
}
