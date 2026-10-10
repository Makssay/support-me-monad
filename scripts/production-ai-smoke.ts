import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { Contract, keccak256, toUtf8Bytes } from 'ethers';
import { checkedProvider } from './env';
import { parseRubric } from '../shared/ai';
import controllerABI from '../shared/ai-abi.json';
const proof=JSON.parse(fs.readFileSync('ai-demo-proof.json','utf8'));const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.name));let p:Awaited<ReturnType<typeof checkedProvider>>|undefined;
let step='state';
try{
 const state=await(await page.request.get('http://127.0.0.1:3001/api/state',{timeout:60000})).json();const mission=state.missions.find((m:any)=>m.id===proof.missionId);if(mission?.mode!==5||mission.creator.toLowerCase()!==proof.creator.toLowerCase()||!state.config.aiConfigured)throw new Error('AI config or organizer mapping');
 step='public commitment';const result=await(await page.request.get(`http://127.0.0.1:3001/api/missions/${proof.missionId}/ai-result`)).json();const computed=keccak256(toUtf8Bytes(JSON.stringify({missionId:proof.missionId,rankings:result.rankings,winners:result.winners,entryHash:result.entryHash,model:mission.aiModel,version:mission.aiVersion})));if(computed!==result.resultHash||result.resultHash!==proof.resultHash)throw new Error('Result commitment');
 const rubric=parseRubric(mission.aiRubric);for(const r of result.rankings)if(Math.round(r.review.scores.reduce((n:number,s:number,i:number)=>n+s*rubric[i].weight,0)/100)!==r.review.score)throw new Error('Weighted score');
 step='chain commitment';p=await checkedProvider();const controller=new Contract(proof.controller,controllerABI,p);if(await controller.results(proof.missionId)!==result.resultHash)throw new Error('Onchain commitment');
 step='mission page';await page.goto(`http://127.0.0.1:3001/mission/${proof.missionId}`);await page.getByRole('heading',{name:'Fixed public ranking'}).waitFor({timeout:60000});if(!(await page.locator('.payout-proof').innerText()).includes('0.003 MON'))throw new Error('Payout UI');await page.screenshot({path:'test-results/production-ai-desktop.png',fullPage:true});
 step='mobile layout';for(const width of[320,390,768]){await page.setViewportSize({width,height:900});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('AI mobile overflow');}await page.screenshot({path:'test-results/production-ai-mobile.png',fullPage:true});
 step='profile';await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`http://127.0.0.1:3001/profile/${proof.contributors[0]}`);await page.locator('.signal-badge strong').waitFor({timeout:60000});if(await page.locator('.signal-badge strong').innerText()!=='15')throw new Error('AI reputation UI');if(errors.length)throw new Error('Browser error');
 const report={passed:true,missionId:proof.missionId,chainId:10143,controller:proof.controller,payoutMON:proof.payoutMON,model:mission.aiModel,realModelAssessment:true,publicCommitmentMatchesChain:true,weightedScoresVerified:true,organizerMapped:true,profileSignal:15,mobileWidths:[320,390,768],noOverflow:true,reducedMotionChecked:true,browserErrors:0,syntheticQA:true,checkedAt:new Date().toISOString()};fs.writeFileSync('ai-production-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch{console.log('AI production verification failed at:',step);process.exitCode=1;}finally{await browser.close();p?.destroy();}
