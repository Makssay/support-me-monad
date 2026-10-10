import {chromium} from '@playwright/test';
import fs from 'node:fs';
import {missionDefaults,type Snapshot,type Mission} from '../shared/model';
// Visual fixtures only. Never submit transactions or call paid verification providers.
const origin='http://127.0.0.1:3001';
const config={...await(await fetch(origin+'/api/config')).json(),privyAppId:'',gasSponsorship:false};
const now=Math.floor(Date.now()/1000),creator='0x'+'11'.repeat(20),participant='0x'+'22'.repeat(20);
const base:Mission={...missionDefaults,id:101,creator,creatorName:'Visual QA creator',title:'UI fixture: oracle outage refund',description:'A visual fixture for checking payout explanations and the public result. This is not an onchain mission.',requirements:'An original contribution that follows the published brief.',category:'Memes',mode:0,reward:'0.01',remaining:'0',slots:3,closed:true,deadline:now-9*86400,reviewDeadline:now-8*86400,recoveryAt:now-86400,recovery:{active:true,scanned:true,eligible:2,processed:2},refundRaw:'20000000000000000',refundTransferred:true,automation:{enabled:true,pythReserve:'0',executionReserve:'0'},draw:{sequence:'1',provider:'',seed:'',requested:true,ready:false,settled:false}};
const state:Snapshot={config,updatedAt:new Date().toISOString(),chainTime:now,missions:[base,{...base,id:102,title:'UI fixture: creator mission is open',closed:false,remaining:'0.03',deadline:now+3600,reviewDeadline:now+86400,recoveryAt:now+8*86400,recovery:undefined,draw:undefined,refundRaw:undefined}],contributions:[{id:1,missionId:101,contributor:participant,name:'Visual QA contributor',text:'Previously accepted contribution.',socialUrl:'',status:1,paid:'0.01',transferred:true},{id:2,missionId:101,contributor:'0x'+'33'.repeat(20),name:'Pending contributor',text:'The draw did not complete.',socialUrl:'',status:6,paid:'0'}],profiles:[]};
fs.mkdirSync('.data/experience-visual',{recursive:true});
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const results:any[]=[];
try{
 await page.route('**/api/config',r=>r.fulfill({json:config}));await page.route('**/api/state',r=>r.fulfill({json:state}));await page.route('**/api/draw-fee',r=>r.fulfill({json:{wei:'100000000000000'}}));
 for(const language of ['en','ru'])for(const width of [1440,390,320])for(const id of [101,102]){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/mission/'+id);await page.getByRole('heading',{level:1}).waitFor();
  if(language==='ru')await page.getByRole('button',{name:'Русский',exact:true}).click();else await page.getByRole('button',{name:'English',exact:true}).click();
  await page.locator('.reward-terms').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('Horizontal overflow');
  const path=`.data/experience-visual/${id}-${language}-${width}.png`;await page.screenshot({path,fullPage:true});results.push({id,language,width,overflow,path});
 }
 if(errors.length)throw new Error('Browser errors');fs.writeFileSync('experience-visual-proof.json',JSON.stringify({fixtureOnly:true,transactionsSent:0,paidProviderCalls:0,errors,results},null,2));console.log('12 production UI fixture checks passed at 1440, 390 and 320px in EN/RU.');
}finally{await browser.close();}
