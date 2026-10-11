import { test, expect } from '@playwright/test';
import { JsonRpcProvider } from 'ethers';
const address='0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

test('Sign-in dialog supports keyboard, mobile and reduced motion without starting OAuth', async ({page}) => {
 await page.route('**/api/config',async route => { const r=await route.fetch(); const data=await r.json();data.privyAppId='qa-deferred-auth';await route.fulfill({response:r,json:data}); });
 await page.goto('/');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const modal=page.getByRole('dialog');
 await expect(modal.getByRole('button',{name:'Continue with X'})).toBeEnabled();
 await expect(modal.getByRole('button',{name:'Sign in with backup email'})).toBeEnabled();
 await expect.poll(() => modal.locator('.signin-mascot').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
 await expect(modal.getByRole('button',{name:'Close wallet dialog'})).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(modal.getByRole('link',{name:'Get testnet MON'})).toBeFocused();
 await page.keyboard.press('Tab');await expect(modal.getByRole('button',{name:'Close wallet dialog'})).toBeFocused();
 await page.screenshot({path:'test-results/signin-desktop.png'});
 await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeFocused();
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:'test-results/signin-mobile.png'});
 await modal.getByRole('button',{name:'Close wallet dialog'}).click();await expect(modal).toHaveCount(0);
});

test('Wallet dialog shows account data, copies address, opens profile and disconnects', async ({page,context}) => {
 const rpc=new JsonRpcProvider(process.env.QA_RPC_URL || 'http://127.0.0.1:8545',31337,{batchMaxCount:1});
 try {
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.route('**/api/config',async route => {const r=await route.fetch();const data=await r.json();delete data.privyAppId;await route.fulfill({response:r,json:data});});
 await page.route('**/api/state',async route=>{const r=await route.fetch();const data=await r.json();data.profiles=[{address,name:'Wallet QA',username:'wallet_qa',xId:'123',submitted:10,accepted:7,score:105,earned:'0.7',completed:7,acceptanceRate:70,credits:'0'}];await route.fulfill({response:r,json:data});});
 await page.exposeFunction('qaAccountRequest',async({method,params=[]}:{method:string;params?:unknown[]})=>['eth_accounts','eth_requestAccounts'].includes(method)?[address]:rpc.send(method,params));
 await page.addInitScript(()=>{localStorage.setItem('support.wallet','metamask');(window as any).ethereum={isMetaMask:true,request:(a:unknown)=>(window as any).qaAccountRequest(a),on:()=>{},removeListener:()=>{}};});
 await page.goto('/');await expect(page.locator('.wallet-button')).not.toHaveText('Connect wallet');await page.locator('.wallet-button').click();
 const modal=page.getByRole('dialog');await expect(modal.getByRole('heading',{name:'@wallet_qa'})).toBeVisible();
 await expect(modal.getByLabel('Your activity')).toContainText('105');await expect(modal.getByText('Rewards received').locator('strong')).toHaveText('7');
 await modal.getByRole('button',{name:'Copy wallet address'}).click();await expect(modal.getByRole('button',{name:'Address copied'})).toBeVisible();
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(address);
 await page.screenshot({path:'test-results/wallet-desktop.png'});
 await page.setViewportSize({width:390,height:844});expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:'test-results/wallet-mobile.png'});
 await modal.getByRole('link',{name:'Support Me profile'}).click();await expect(page).toHaveURL(/\/profile\/x-123$/);await expect(modal).toHaveCount(0);
 await page.locator('.wallet-button').click();await modal.getByRole('button',{name:'Disconnect',exact:true}).click();await expect(modal).toHaveCount(0);await expect(page.locator('.wallet-button')).toHaveText('Connect wallet');
 } finally {rpc.destroy();}
});

