import { jsonStore, checkpoint, cloudStorage } from './persistence';
import { requirePaidService,reserveServiceCheck } from './paid-services';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import fs from 'node:fs';
import { AbiCoder, getBytes, keccak256, verifyMessage } from 'ethers';
import { chainId, contractAddress, contract, provider, snapshot, saveVerification, invalidate, local } from './chain';
import { sameAddress, socialPostId, replyMessage, type Verification } from '../shared/model';
import { verifySocial, replyEligibility, lookupUsage } from './social';
import { socialSigner } from './social-signer';
import { requireMember, requireMemberWallet, memberXId } from './auth';
import { assess } from './ai';
import { claimReplyIdentity } from './reply-identity';
import { missionPublishedAt } from './mission-publication';
const router=Router();
const file='.data/reply-identities.json';
const store=jsonStore(file,{bindings:{} as Record<string,string>,wallets:{} as Record<string,string>});const saved=store.data;
const bindings:Record<string,string>=saved.bindings||{}; const wallets:Record<string,string>=saved.wallets||{};
const persist=store.save;
function identityKey(wallet:string){return `${chainId}:${wallet.toLowerCase()}`;}
function ticketKey(id:number,wallet:string){return `${chainId}:${contractAddress.toLowerCase()}:${id}:${wallet.toLowerCase()}`;}
function publicError(e:unknown,fallback:string){return e instanceof Error&&e.message.length<200&&!/0x[a-fA-F0-9]{40}|Bearer|https?:\/\//.test(e.message)?e.message:fallback;}
export async function socialLookup(url:string):Promise<Verification>{
 // Explicit local fixture transport: never enabled on Monad; no provider key is used.
 if(local&&process.env.SOCIAL_FIXTURES==='1'){
  const data=fs.existsSync('.data/qa-social.json')?JSON.parse(fs.readFileSync('.data/qa-social.json','utf8')):{}; const mock=(async()=>data[socialPostId(url)||'']?new Response(JSON.stringify(data[socialPostId(url)||''])):new Response('',{status:404})) as typeof fetch;
  return verifySocial(url,'local-fixture',mock);
 }
 return verifySocial(url);
}
function authorize(body:any,purpose:string,id:number,url=''){
 const {wallet,timestamp,signature}=body;
 if(!/^0x[0-9a-fA-F]{40}$/.test(wallet||'')||!Number.isSafeInteger(timestamp)||Math.abs(Date.now()-timestamp)>300000||typeof signature!=='string')throw new Error('Invalid or expired wallet authorization.');
 let signer='';try{signer=verifyMessage(replyMessage(purpose,id,contractAddress,chainId,wallet,timestamp,url),signature);}catch{}
 if(!sameAddress(signer,wallet))throw new Error('Wallet authorization did not match.');return wallet.toLowerCase();
}
router.get('/social/usage',(_req,res)=>res.json(lookupUsage()));
router.get('/missions/:id/reservation/:wallet',async(req,res)=>{try{if(!contract||!/^0x[0-9a-fA-F]{40}$/.test(req.params.wallet))throw new Error();const r=await contract.reservations(Number(req.params.id),req.params.wallet);res.json({active:r.active,expires:Number(r.expires),activeWork:Number(await contract.activeWork(req.params.wallet))});}catch{res.status(400).json({error:'Reservation unavailable.'});}});
router.get('/draw-fee',async(_req,res)=>{try{res.json({wei:(await contract!.drawFee()).toString()});}catch{res.status(503).json({error:'The randomness service is unavailable. Retry later; no fallback draw is used.'});}});
router.use('/missions/:id/reply',requireMember,rateLimit({windowMs:60000,limit:6,message:{error:'Wait a minute before another reply request.'}}));
async function mission(id:number,wallet:string){const state=await snapshot();const m=state.missions.find(m=>m.id===id);if(!m||m.mode!==4||m.closed||Date.now()/1000>=m.deadline||sameAddress(wallet,m.creator))throw new Error('This reply raffle is not available to this wallet.');if((await contract!.hasSubmitted(id,wallet)))throw new Error('This wallet already entered.');if((m.entries?.length||0)>=256)throw new Error('The published 256-entry limit has been reached.');return m;}
const pending=new Map<string,Promise<unknown>>();
router.post('/missions/:id/reply/ticket',async(req,res)=>{
 try{const id=Number(req.params.id);const url=String(req.body.url||'');const post=socialPostId(url);if(!Number.isSafeInteger(id)||id<1||!post)throw new Error('Use a valid public X reply URL.');const wallet=authorize(req.body,'Verify reply entry',id,url);const m=await mission(id,wallet);const key=ticketKey(id,wallet);
 requireMemberWallet(req,wallet);
 const originalX=memberXId(req);
 if(!originalX&&!local)throw new Error('Sign in with your connected X account before verifying a reply.');
 const taskKey=`${key}:${post}`;
 const task=pending.get(taskKey)|| (async()=>{
 await requirePaidService(id,m.aiReview?2:1);reserveServiceCheck(id,'x',socialPostId(m.targetPost)!);reserveServiceCheck(id,'x',post);const target=await socialLookup(m.targetPost);if(target.status!=='verified')throw new Error('Original post could not be verified. No entry was admitted.');
 const reply=await socialLookup(url);const published=await missionPublishedAt(m.id,m.createdTx);const expectedX=originalX||(local&&process.env.SOCIAL_FIXTURES==='1'?reply.authorId:'');const problem=replyEligibility(reply,target,expectedX||'',published,m.deadline,bindings[identityKey(m.creator)]);if(problem)throw new Error(problem);
 const xUser=reply.authorId!;if(originalX&&xUser!==originalX)throw new Error('Use the X account originally linked to Support Me.');const bound=wallets[`${chainId}:${xUser}`];if(bound&&bound!==wallet)throw new Error('This X account is already linked to a different wallet.');const own=bindings[identityKey(wallet)];if(own&&own!==xUser)throw new Error('Use the X account already linked to this wallet.');
 if(await contract!.usedXUsers(id,xUser)||await contract!.usedPosts(id,post))throw new Error('This X account or reply already entered.');
 if(m.aiReview)reserveServiceCheck(id,'ai',post);const aiReview=m.aiReview?await assess(m,'',reply):undefined;
 if(aiReview&&aiReview.status!=='pass')throw new Error(`AI eligibility ${aiReview.status}: ${aiReview.reason.slice(0,140)}`);
 claimReplyIdentity(bindings,wallets,chainId,wallet,xUser);persist();
 const validUntil=Math.min(Number((await provider.getBlock('latest'))!.timestamp)+600,m.deadline-1);const digest=keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','uint256','address','uint256','uint256','uint64'],[chainId,contractAddress,id,wallet,xUser,post,validUntil]));
 const signer=socialSigner();if(!sameAddress(signer.address,await contract!.verifier()))throw new Error('Eligibility signer does not match the deployed contract.');
 const signature=await signer.signMessage(getBytes(digest));return {xUser,post,validUntil,signature,aiReview,evidence:{...reply,note:'Direct reply, connected X account and publication date verified. Entry grants a chance to win, not guaranteed payment.'}};
 })();
 pending.set(taskKey,task);try{res.json(await task);}finally{pending.delete(taskKey);}
 }catch(e){res.status(400).json({error:publicError(e,'Reply verification failed. No entry was admitted; retry later.')});}
});
export default router;
