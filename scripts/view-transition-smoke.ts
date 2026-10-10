import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const base = 'http://127.0.0.1:3001';
const state = await (await fetch(`${base}/api/state`)).json();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(`window.__fadeLogs=[];window.__nativeCalls=0;const original=document.startViewTransition?.bind(document);if(original)document.startViewTransition=options=>{window.__nativeCalls++;return original(options);};document.addEventListener('transitionrun',event=>{const el=event.target;if(!el.classList?.contains('route-fade'))return;window.__fadeLogs.push({path:location.pathname,scroll:scrollY,title:document.querySelector('main h1')?.getBoundingClientRect().toJSON(),transform:getComputedStyle(el).transform,animations:el.getAnimations().map(a=>({duration:a.effect.getTiming().duration,keys:a.effect.getKeyframes().map(k=>({opacity:k.opacity,transform:k.transform}))}))});});`);
let routesChecked = 0;
async function assertFade(reduced = false) {
 await expect.poll(async () => page.evaluate((duration: number) => ((window as any).__fadeLogs.at(-1)?.path === location.pathname) && (window as any).__fadeLogs.at(-1)?.animations.some((a: any) => a.duration === duration && a.keys.some((k: any) => k.opacity === '0') && a.keys.some((k: any) => k.opacity === '1')), reduced ? 80 : 140)).toBe(true);
 const log = await page.evaluate(() => (window as any).__fadeLogs.at(-1));
 expect(log.transform).toBe('none');
 expect(await page.evaluate(() => (window as any).__nativeCalls)).toBe(0);
 for (const animation of log.animations) {
  if (animation.keys.some((key: any) => key.transform && key.transform !== 'none')) throw new Error('Page is moving during fade');
 }
 await expect(page.locator('.route-fade')).toHaveCSS('opacity', '1');
 await page.waitForFunction(() => document.querySelector('.route-fade')?.getAnimations().length === 0);
 const heading = await page.locator('main h1').first().boundingBox();
 if (heading && Math.abs(heading.y - log.title.y) > 1) throw new Error(`Page geometry changed: ${JSON.stringify({url:page.url(),log,heading})}`);
 if (log.scroll !== 0) throw new Error('Incoming page captured before scroll reset');
 await expect(page.locator('.topbar')).toHaveCSS('transform', 'none');
 routesChecked++;
}
try {
 await page.goto(base); await page.waitForSelector('.mission-row');
 const mission = state.missions.find((m:any)=>!m.closed);
 await page.locator(`.mission-open-link[href="/mission/${mission.id}"]`).scrollIntoViewIfNeeded();
 await page.locator(`.mission-open-link[href="/mission/${mission.id}"]`).click(); await expect(page).toHaveURL(`${base}/mission/${mission.id}`); await assertFade();
 await page.locator('.creator-link').click(); await expect(page).toHaveURL(`${base}/profile/${mission.creator}`); await assertFade();
 await page.goBack(); await expect(page.locator('.mission-detail h1')).toHaveText(mission.title); await assertFade();
 await page.getByRole('link',{name:'All missions',exact:true}).click(); await assertFade();
 await page.locator(`.mission-open-link[href="/mission/${mission.id}"]`).locator('..').locator('.row-creator').click(); await assertFade();
 await page.goto(`${base}/activity`); await page.waitForSelector('.leaderboard-row');
 await page.locator('.leaderboard-row').first().click(); await expect(page.locator('.profile-heading')).toBeVisible(); await assertFade();
 await page.goto(base); await page.waitForSelector('.mission-row');
 await page.evaluate(() => { document.addEventListener('click', event => { (window as any).__modifierPrevented = event.defaultPrevented; event.preventDefault(); }, { once: true }); });
 await page.locator('.mission-open-link').first().click({ modifiers: ['Control'] });
 expect(await page.evaluate(() => (window as any).__modifierPrevented)).toBe(false); await expect(page).toHaveURL(`${base}/`);
 await page.emulateMedia({ reducedMotion: 'reduce' });
 await page.locator('.mission-open-link').first().click(); await assertFade(true);
 // Exercise the wizard using a disposable browser wallet; never submit a transaction.
 const wizard = await browser.newPage({ viewport: { width: 390, height: 844 } });
 wizard.on('pageerror', e => errors.push(e.message));
 await wizard.route('**/api/config', route => route.fulfill({ json: { ...state.config, privyAppId: '' } }));
 await wizard.addInitScript(`window.ethereum={isMetaMask:true,request:async ({method})=>{if(method==='eth_chainId')return '${'0x'+state.config.chainId.toString(16)}'; if(method==='eth_accounts'||method==='eth_requestAccounts')return ['${state.missions[0].creator}']; if(method==='eth_getBalance')return '0x8ac7230489e80000';throw new Error('No transactions allowed in wizard QA');},on:()=>{},removeListener:()=>{}};window.__stepTypes=[];const original=document.startViewTransition?.bind(document);if(original)document.startViewTransition=options=>{window.__stepTypes.push(Array.from(options.types||[]));return original(options);};`);
 await wizard.goto(base); await wizard.getByRole('button',{name:'Connect wallet',exact:true}).click(); await wizard.getByRole('button',{name:'MetaMask',exact:true}).click();
 await expect(wizard.locator('.wallet-dialog')).toHaveCount(0);
 await wizard.getByRole('link',{name:'Start a mission',exact:true}).first().click();
 await wizard.getByRole('button',{name:'Next',exact:true}).click(); await expect(wizard.getByLabel('Your creator name')).toBeVisible();
 await wizard.getByLabel('Your creator name').fill('Transition Creator'); await wizard.getByLabel('Mission title').fill('Create something useful together');
 await wizard.evaluate(()=>document.fonts.ready);
 await wizard.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getTiming().iterations===Infinity));
 const actionsTop = await wizard.locator('.wizard-actions').evaluate(el => el.getBoundingClientRect().top + scrollY);
 await wizard.getByRole('button',{name:'Next',exact:true}).click(); await wizard.getByLabel('Reward slots',{exact:true}).fill('4');
 await wizard.getByRole('button',{name:'Next',exact:true}).click(); await wizard.getByLabel('The brief',{exact:true}).fill('Make an original helpful community contribution.');
 await wizard.getByLabel('What makes a great contribution?',{exact:true}).fill('Original work with a clear explanation.'); await wizard.getByRole('button',{name:'Next',exact:true}).click(); await expect(wizard.locator('.mission-review')).toContainText('0.04 MON');
 expect(Math.abs((await wizard.locator('.wizard-actions').evaluate(el => el.getBoundingClientRect().top + scrollY)) - actionsTop)).toBeLessThan(1);
 await wizard.getByRole('button',{name:'Back',exact:true}).click(); await expect(wizard.getByRole('textbox',{name:'The brief',exact:true})).toHaveValue('Make an original helpful community contribution.');
 await wizard.getByRole('button',{name:'Back',exact:true}).click(); await expect(wizard.getByLabel('Reward slots',{exact:true})).toHaveValue('4');
 await wizard.getByRole('button',{name:'Back',exact:true}).click(); await expect(wizard.getByLabel('Mission title')).toHaveValue('Create something useful together');
 expect(await wizard.evaluate(() => (window as any).__stepTypes.some((types: string[])=>types.includes('step-next')))).toBe(true);
 expect(await wizard.evaluate(() => (window as any).__stepTypes.some((types: string[])=>types.includes('step-back')))).toBe(true);
 await wizard.emulateMedia({reducedMotion:'reduce'}); await wizard.getByRole('button',{name:'Next',exact:true}).click(); await expect(wizard.getByRole('heading',{name:'Reward',exact:true})).toBeVisible();
 await wizard.getByRole('button',{name:'Next',exact:true}).click();
 await wizard.getByRole('textbox',{name:'The brief',exact:true}).fill('Useful creative contribution. '.repeat(50));
 await wizard.getByRole('textbox',{name:'What makes a great contribution?',exact:true}).fill('Original work and a clear explanation. '.repeat(20));
 await wizard.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getTiming().iterations===Infinity));
 const longActionsTop = await wizard.locator('.wizard-actions').evaluate(el => el.getBoundingClientRect().top + scrollY);
 await wizard.getByRole('button',{name:'Next',exact:true}).click(); await expect(wizard.getByRole('heading',{name:'Review',exact:true})).toBeVisible();
 await wizard.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getTiming().iterations===Infinity));
 expect(Math.abs((await wizard.locator('.wizard-actions').evaluate(el => el.getBoundingClientRect().top + scrollY)) - longActionsTop)).toBeLessThan(1);
 expect(Math.abs(longActionsTop - actionsTop)).toBeLessThan(1);
 if(await wizard.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Wizard mobile overflow');
 await wizard.screenshot({ path: 'test-results/repaired-wizard-mobile.png', fullPage: true });
 await wizard.close();

 const fallback = await browser.newPage(); fallback.on('pageerror', error => errors.push(error.message));
 await fallback.addInitScript('document.startViewTransition = undefined;');
 await fallback.goto(base); await fallback.waitForSelector('.mission-row');
 await fallback.locator('.mission-open-link').first().click(); await expect(fallback.locator('.mission-detail h1')).toBeVisible(); await fallback.close();
 for (const width of [320,390,768,1440]) { await page.setViewportSize({ width, height: 900 }); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow at ${width}`); }
 if(errors.length) throw new Error(errors.join('\n'));
 const report={passed:true,opacityOnlyPageFadeMs:140,reducedMotionMs:80,sharedElementsRemoved:true,noScrollJump:true,staticHeader:true,routesChecked,wizardDataPreserved:true,wizardActionsStable:true,longBriefLayoutStable:true,modifierClick:true,unsupportedBrowserFallback:true,browserErrors:0};
 fs.writeFileSync('view-transition-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally { await browser.close(); }
