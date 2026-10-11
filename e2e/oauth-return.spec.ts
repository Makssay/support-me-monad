import { test, expect } from '@playwright/test';

// Isolate the gateway lifecycle from third-party OAuth. No live credentials,
// token exchange or real account is used; Privy remains the session authority.
test('First X OAuth return mounts Privy without a remembered session or another login click', async ({ page }) => {
 await page.route('**/api/config', async route => {
  const response = await route.fetch(); const data = await response.json();
  data.privyAppId = 'qa-oauth-return'; await route.fulfill({ response, json: data });
 });
 await page.route('**/src/privy.tsx', route => route.fulfill({ contentType: 'application/javascript', body: `
  import React from '/node_modules/.vite/deps/react.js';
  export default function MockPrivy({onSession}) {
   React.useEffect(() => {onSession({ready:true,authenticated:false,wallets:[],login:()=>{},logout:async()=>{},connectWallet:()=>{}})},[onSession]);
   return React.createElement('span', {'data-testid':'oauth-sdk-mounted'}, 'SDK initialized');
  }` }));
 await page.goto('/');
 await expect(page.getByRole('button', {name:'Sign in', exact:true})).toBeVisible();
 await expect(page.getByTestId('oauth-sdk-mounted')).toHaveCount(0);
 // These dummy values are intentionally not valid credentials.
 await page.goto('/?privy_oauth_state=qa-state&privy_oauth_provider=twitter&privy_oauth_code=qa-code');
 await expect(page.getByTestId('oauth-sdk-mounted')).toBeVisible();
 // Mounting the SDK must not treat the callback as a verified session.
 await expect(page.getByRole('button', {name:'Sign in', exact:true})).toBeVisible();
 expect(await page.evaluate(() => localStorage.getItem('support.privy-session'))).toBeNull();
 await page.reload();
 await expect(page.getByTestId('oauth-sdk-mounted')).toBeVisible();
});

test('Disabled Dynamic trial falls back to Privy despite old URL and preference',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('support.auth-provider','dynamic'));
 await page.route('**/api/config',async route=>{const response=await route.fetch();const data=await response.json();await route.fulfill({response,json:{...data,privyAppId:'qa-privy-only',dynamicEnvironmentId:'',authProvider:'privy'}});});
 let dynamicRequested=false;await page.route('**/src/dynamic.tsx',route=>{dynamicRequested=true;return route.abort();});
 await page.route('**/src/privy.tsx',route=>route.fulfill({contentType:'application/javascript',body:`import React from '/node_modules/.vite/deps/react.js';export default function MockPrivy({onSession}){React.useEffect(()=>{onSession({provider:'privy',ready:true,authenticated:false,wallets:[],login:()=>{},logout:async()=>{},connectWallet:()=>{}})},[onSession]);return React.createElement('span',{'data-testid':'privy-only-sdk'},'Privy');}`}));
 await page.goto('/?auth=dynamic');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Continue with X'}).click();
 await expect(page.getByTestId('privy-only-sdk')).toBeVisible();
 expect(dynamicRequested).toBe(false);
 expect(await page.evaluate(()=>localStorage.getItem('support.auth-provider'))).toBe('privy');
});
