import { chromium } from '@playwright/test';
import fs from 'node:fs';
const base='http://127.0.0.1:3001';
const state=await (await fetch(base+'/api/state')).json();
const profile=state.profiles.find(p=>p.xId);
if(!profile) throw new Error('Verified X profile missing');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const paths=[`/profile/x-${profile.xId}`,`/profile/${profile.address}`,`/profile/${profile.username}`];
for(const width of [390,1440]){
 await page.setViewportSize({width,height:900});
 for(const path of paths){
  await page.goto(base+path);await page.locator('.profile-heading h1').waitFor();
  await page.waitForFunction(()=>!!document.querySelector('.x-profile-link'));
  const link=page.locator('.x-profile-link');
  if(await link.getAttribute('href')!==`https://x.com/${profile.username}`) throw new Error('X link mismatch');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow) throw new Error('Profile overflow');
 }
}
await page.goto(base+'/activity');
if(errors.length)throw new Error('Browser errors');
const report={passed:true,verifiedPublicProfile:true,canonicalXIdRoute:true,legacyWalletRoute:true,usernameRoute:true,externalXLink:true,widths:[390,1440],browserErrors:errors.length,noOverflow:true};
fs.writeFileSync('x-profile-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
await browser.close();
