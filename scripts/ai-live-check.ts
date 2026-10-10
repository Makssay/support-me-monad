import 'dotenv/config';
import fs from 'node:fs';
import { assess, aiUsage, AIError } from '../server/ai';
import { missionDefaults } from '../shared/model';
import { AI_MODEL, AI_VERSION, DEFAULT_RUBRIC } from '../shared/ai';
try{
 const brief={...missionDefaults,title:'Write a practical product testing report',description:'Describe the steps you tested, the observed result and a useful improvement. A text-only report is sufficient. Negative feedback is welcome. Do not claim a bug without supporting evidence.',requirements:'Include test steps, observed result, and at least one actionable improvement.',aiReview:true,aiModel:AI_MODEL,aiVersion:AI_VERSION,aiRubric:DEFAULT_RUBRIC};
 const text='I opened the mission feed at 390px width, searched for a testing task, opened its brief, and checked the required contribution form. The task and reward were readable. The report field had no checklist reminders, so I suggest showing the published requirements immediately above it. I did not reproduce a transaction or a bug; this is a layout and clarity report.';
 const before=aiUsage().reservedUsd;const review=await assess(brief,text);const again=await assess(brief,text);const proof={model:AI_MODEL,status:review.status,score:review.score,reason:review.reason,cacheStable:again.inputHash===review.inputHash,reservedUsdForCall:aiUsage().reservedUsd-before,usage:aiUsage(),checkedAt:new Date().toISOString()};fs.writeFileSync('ai-live-check.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
}catch(e){console.log(e instanceof AIError?e.message:'Live AI check failed; provider details suppressed.');process.exitCode=1;}
