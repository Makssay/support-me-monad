import { test, expect } from '@playwright/test';
test('Dynamic trial overrides a remembered Privy preference and survives navigation', async ({page}) => {
 await page.addInitScript(()=>localStorage.setItem('support.auth-provider','privy'));
 await page.route('**/api/config',async route=>{const response=await route.fetch();const data=await response.json();await route.fulfill({response,json:{...data,privyAppId:'qa-privy',dynamicEnvironmentId:'a51a05b7-b985-4218-b365-74736013c3f8',authProvider:'privy'}});});
 await page.route('**/src/dynamic.tsx',route=>route.fulfill({contentType:'application/javascript',body:`import React from '/node_modules/.vite/deps/react.js'; export default function MockDynamic({onSession}) {React.useEffect(()=>{onSession({provider:'dynamic',ready:true,authenticated:false,wallets:[],login:()=>{document.body.dataset.loginProvider='dynamic'},logout:async()=>{},connectWallet:()=>{}})},[onSession]);return React.createElement('span',{'data-testid':'dynamic-sdk'},'Dynamic');}`}));
 await page.goto('/?auth=dynamic');
 await expect(page.getByTestId('dynamic-sdk')).toBeVisible();
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByText('Sign in via Dynamic',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Continue with X'}).click();
 await expect(page.locator('body')).toHaveAttribute('data-login-provider','dynamic');
 expect(await page.evaluate(()=>localStorage.getItem('support.auth-provider'))).toBe('dynamic');
 await page.reload();
 await expect(page.getByTestId('dynamic-sdk')).toBeVisible();
});

test('A failed Dynamic OAuth exchange is visible before membership exists',async({page})=>{
 await page.route('**/api/config',async route=>{const response=await route.fetch();const data=await response.json();await route.fulfill({response,json:{...data,privyAppId:'qa-privy',dynamicEnvironmentId:'a51a05b7-b985-4218-b365-74736013c3f8'}});});
 await page.route('**/src/dynamic.tsx',route=>route.fulfill({contentType:'application/javascript',body:`import React from '/node_modules/.vite/deps/react.js';export default function MockDynamic({onSession}){React.useEffect(()=>onSession({provider:'dynamic',ready:true,authenticated:false,wallets:[],accountError:'Dynamic could not complete X sign-in. Please retry.',login:()=>{},logout:async()=>{},connectWallet:()=>{}}),[onSession]);return null;}`}));
 await page.goto('/?auth=dynamic');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('Dynamic could not complete X sign-in. Please retry.');
 await expect(page.getByRole('button',{name:'Continue with X'})).toBeEnabled();
});
