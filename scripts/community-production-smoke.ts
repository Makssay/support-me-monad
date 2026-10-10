import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const proof=JSON.parse(fs.readFileSync('community-monad-proof.json','utf8'));
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const response=await page.request.get('http://127.0.0.1:3001/api/state');if(!response.ok())throw new Error('Production API unavailable');const state=await response.json();expect(state.config.chainId).toBe(10143);expect(state.config.version).toBe(6);expect(state.config.contractAddress).toBe(proof.ledger);expect(state.config.communityGate).toBe(proof.gate);
 await page.goto(`http://127.0.0.1:3001/mission/${proof.mission}`);await expect(page.getByText('0.01 MON paid on Monad',{exact:true})).toBeVisible();await expect(page.getByText('Organizer wallet list',{exact:true})).toBeVisible();
 await page.goto(`http://127.0.0.1:3001/profile/${proof.participant}`);await expect(page.locator('footer')).toBeVisible();expect(state.profiles.find((p:any)=>p.address.toLowerCase()===proof.participant.toLowerCase()).earned).toBe('0.01');
 const paths=['/',`/mission/${proof.mission}`,`/profile/${proof.participant}`,'/activity','/create','/dashboard'];for(const width of [320,390])for(const path of paths){await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:3001'+path);await expect(page.locator('footer')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.goto(`http://127.0.0.1:3001/mission/${proof.mission}`);await page.getByRole('button',{name:'Русский',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','ru');await page.screenshot({path:'.data/community-production-mobile.png',fullPage:true});
 const env=await page.request.get('http://127.0.0.1:3001/.env');expect((await env.text()).includes('MONAD_PRIVATE_KEY=')).toBe(false);expect(errors).toEqual([]);
 const result={passed:true,productionBuild:true,chainId:10143,version:6,contract:proof.ledger,realPayoutVisible:true,profileReward:'0.01 MON',mobileWidths:[320,390],mobilePages:paths.length,noOverflow:true,russianUI:true,envNotServed:true,browserErrors:0};fs.writeFileSync('community-production-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){console.error('Community production smoke failed:',(e as Error).message);process.exitCode=1;}finally{await browser.close();}
