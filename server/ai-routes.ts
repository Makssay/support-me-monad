import { requirePaidService,reserveServiceCheck } from './paid-services';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AbiCoder, getBytes, keccak256, toUtf8Bytes, verifyMessage } from 'ethers';
import { contract, contractAddress, chainId, aiController, aiControllerAddress, provider, snapshot, verificationFor, saveVerification, invalidate } from './chain';
import { requireMember, requireMemberWallet } from './auth';
import { assess, AIError, resultFor, saveResult, aiUsage, linkReview, linkedReview } from './ai';
import { aiJudgeMessage, aiReviewMessage, AI_MODEL, AI_VERSION, type AIResult } from '../shared/ai';
import { sameAddress } from '../shared/model';
import { socialSigner } from './social-signer';
import { socialLookup } from './social-routes';
const router=Router();const finalizing=new Map<string,Promise<AIResult>>();
const resultKey=(id:number)=>`${chainId}:${aiControllerAddress.toLowerCase()}:${id}`;
function authorized(req:any,message:string){const {timestamp,signature}=req.body;if(!Number.isSafeInteger(timestamp)||Math.abs(Date.now()-timestamp)>300000||typeof signature!=='string')throw new AIError('Wallet authorization expired.');let address='';try{address=verifyMessage(message,signature);}catch{throw new AIError('Invalid wallet authorization.');}requireMemberWallet(req,address);return address;}
router.get('/ai/usage',(_req,res)=>res.json(aiUsage()));
router.get('/contributions/:id/ai-review',(req,res)=>res.json(linkedReview(`${chainId}:${contractAddress.toLowerCase()}:${Number(req.params.id)}`)||null));
router.get('/missions/:id/ai-result',(req,res)=>res.json(resultFor(resultKey(Number(req.params.id)))||null));
router.use(['/contributions/:id/ai-review','/missions/:id/ai-finalize'],requireMember,rateLimit({windowMs:60000,limit:6,message:{error:'Wait a minute before another AI request.'}}));
router.post('/contributions/:id/ai-review',async(req,res)=>{try{
 const id=Number(req.params.id);const address=authorized(req,aiReviewMessage(id,contractAddress,chainId,req.body.timestamp));const state=await snapshot();const c=state.contributions.find(c=>c.id===id);const m=state.missions.find(m=>m.id===c?.missionId);
 if(!c||!m||!m.aiReview||(!sameAddress(address,m.creator)&&!sameAddress(address,c.contributor)))throw new AIError('Only the creator or contributor can review this opted-in mission.');
 await requirePaidService(m.id,2);let evidence=verificationFor(id);if(c.socialUrl&&evidence?.status!=='verified'){evidence=await socialLookup(c.socialUrl);saveVerification(id,evidence);}
 reserveServiceCheck(m.id,'ai',`contribution:${c.id}`);const review=await assess(m,c.text,evidence,fetch,c.socialUrl);linkReview(`${chainId}:${contractAddress.toLowerCase()}:${id}`,review);res.json(review);
 }catch(e){res.status(400).json({error:e instanceof AIError?e.message:'AI review unavailable. No decision was made.'});}});
export async function finalizeAIContest(id:number){
 const key=resultKey(id);const existing=resultFor(key);if(existing)return existing;
 const task=finalizing.get(key)||(async()=>{
 if(!aiController||!contract||!sameAddress(await aiController.verifier(),socialSigner().address))throw new AIError('AI settlement signer unavailable.');
 const state=await snapshot();const m=state.missions.find(m=>m.id===id);const now=Number((await provider.getBlock('latest'))?.timestamp||Math.floor(Date.now()/1000));
 if(!m||m.mode!==5||m.closed||now<m.deadline||now>=(m.reviewDeadline||0)||m.aiModel!==AI_MODEL||m.aiVersion!==AI_VERSION)throw new AIError('AI selection opens after submissions close and before the review deadline.');
 await requirePaidService(id,2);const entries=(await contract.raffleEntries(id)).map(Number) as number[];
 const rankings:AIResult['rankings']=[];
 for(const entry of entries){const c=state.contributions.find(c=>c.id===entry);if(!c)throw new AIError('Entry list changed. Retry after refreshing.');
 let evidence=verificationFor(entry);if(c.socialUrl&&evidence?.status!=='verified'){evidence=await socialLookup(c.socialUrl);saveVerification(entry,evidence);}
 reserveServiceCheck(m.id,'ai',`contribution:${c.id}`);const review=await assess(m,c.text,evidence,fetch,c.socialUrl);
 linkReview(`${chainId}:${contractAddress.toLowerCase()}:${entry}`,review);
 if(sameAddress(c.contributor,m.creator))rankings.push({contributionId:entry,review:{...review,status:'fail',reason:'The organizer wallet is excluded from prizes.',score:0}});else rankings.push({contributionId:entry,review});
 }
 // Stable tie-break: earlier onchain contribution ID. Uncertain entries never silently become winners.
 rankings.sort((a,b)=>b.review.score-a.review.score||a.contributionId-b.contributionId);
 if(rankings.some(r=>r.review.status==='uncertain'))throw new AIError('At least one entry has insufficient evidence. Automatic selection is paused; cached assessments are fixed. If unresolved, funds unlock after the review deadline.');
 const winners=rankings.filter(r=>r.review.status==='pass').slice(0,Number(await aiController.prizes(id))).map(r=>r.contributionId);
 const coder=AbiCoder.defaultAbiCoder();const entryHash=keccak256(coder.encode(['uint256[]'],[entries]));const validUntil=m.reviewDeadline!;
 const resultHash=keccak256(toUtf8Bytes(JSON.stringify({missionId:id,rankings,winners,entryHash,model:AI_MODEL,version:AI_VERSION})));
 const digest=keccak256(coder.encode(['uint256','address','uint256','bytes32','bytes32','bytes32','bytes32','uint64'],[chainId,aiControllerAddress,id,await aiController.policyHashes(id),entryHash,keccak256(coder.encode(['uint256[]'],[winners])),resultHash,validUntil]));
 const signature=await socialSigner().signMessage(getBytes(digest));const result={missionId:id,rankings,winners,resultHash,entryHash,validUntil,signature};saveResult(key,result);invalidate();return result;
 })();finalizing.set(key,task);try{return await task;}finally{finalizing.delete(key);}
}
router.post('/missions/:id/ai-finalize',async(req,res)=>{try{
 const id=Number(req.params.id);authorized(req,aiJudgeMessage(id,contractAddress,chainId,req.body.timestamp));res.json(await finalizeAIContest(id));
 }catch(e){invalidate();res.status(400).json({error:e instanceof AIError?e.message:'AI selection could not complete. Cached assessments are retained; no winners were changed.'});}});
export default router;
