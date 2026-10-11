import {test,expect} from '@playwright/test';
import {JsonRpcProvider} from 'ethers';
test('Privy wallet wrapper updates do not reconnect the same provider during a confirmation',async({page})=>{
 const rpc=new JsonRpcProvider(process.env.QA_RPC_URL||'http://127.0.0.1:8546',31337,{batchMaxCount:1});
 try {
  await page.exposeFunction('walletStabilityRpc',({method,params=[]}:any)=>rpc.send(method,params));
  await page.addInitScript(()=>{
   localStorage.setItem('support.privy-session','1');
   (window as any).qaProviderCalls=0;
   (window as any).ethereum={request:(arg:unknown)=>(window as any).walletStabilityRpc(arg),on:()=>{},removeListener:()=>{}};
  });
  await page.route('**/api/config',async route=>{const r=await route.fetch();const data=await r.json();data.privyAppId='qa-wallet-stability';await route.fulfill({response:r,json:data});});
  await page.route('**/src/privy.tsx',route=>route.fulfill({contentType:'application/javascript',body:`
   import React from '/node_modules/.vite/deps/react.js';
   export default function MockPrivy({onSession}) {
    React.useEffect(()=>{const publish=()=>onSession({ready:true,authenticated:true,member:{xId:'123',username:'stable_account',backupEmail:false},wallets:[{address:'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',label:'Support Me wallet',getProvider:async()=>{window.qaProviderCalls++;return window.ethereum;},switchChain:async()=>{}}],login:()=>{},logout:async()=>{},connectWallet:()=>{}});publish();const timer=setInterval(publish,30);return()=>clearInterval(timer);},[onSession]);return null;
   }`}));
  await page.goto('/');await expect(page.locator('.wallet-button')).toContainText('@stable_account');
  await expect.poll(()=>page.evaluate(()=>(window as any).qaProviderCalls)).toBeGreaterThan(0);
  const calls=await page.evaluate(()=>(window as any).qaProviderCalls);
  // Observe many fresh SDK wallet objects while the account stays unchanged.
  await page.waitForTimeout(650);
  expect(await page.evaluate(()=>(window as any).qaProviderCalls)).toBe(calls);
  await page.locator('.wallet-button').click();await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading',{name:'@stable_account'})).toBeVisible();
 }finally{rpc.destroy();}
});
