import { test, expect, type Page } from '@playwright/test';
const wallet='0x1111111111111111111111111111111111111111';
async function mainnet(page:Page,locale='en') {
 const config={local:true,chainId:143,version:9,contractAddress:'0x4444444444444444444444444444444444444444',explorer:'https://monadscan.com',publicRpc:'https://rpc.monad.xyz',privyAppId:'',authProvider:'privy',walletAuthEnabled:false,gasSponsorship:false};
 await page.route('**/api/config',r=>r.fulfill({json:config}));
 await page.route('**/api/state',r=>r.fulfill({json:{config,missions:[],contributions:[],profiles:[],updatedAt:new Date().toISOString(),chainTime:Math.floor(Date.now()/1000)}}));
 await page.route('**/api/rpc',r=>r.fulfill({json:{jsonrpc:'2.0',id:1,result:'0x'+'0'.repeat(64)}}));
 await page.route('**/api/draw-fee',r=>r.fulfill({json:{wei:'1400000000000000000'}}));
 await page.addInitScript(({wallet,locale})=>{
  localStorage.setItem('support.locale',locale);localStorage.setItem('support.wallet','rabby');
  (window as any).ethereum={isRabby:true,request:async({method}:any)=>{
   if(['eth_accounts','eth_requestAccounts'].includes(method))return [wallet];
   if(method==='eth_chainId')return '0x8f';
   if(method==='eth_getBalance')return '0xde0b6b3a7640000';
   throw Error('Unexpected wallet operation: '+method);
  },on(){},removeListener(){}};
 },{wallet,locale});
}
for(const locale of ['en','ru'])test(`mainnet wallet uses real MON labels and no testnet faucet (${locale})`,async({page})=>{
 await mainnet(page,locale);await page.goto('/');
 await expect(page.locator('footer')).toContainText('Monad Mainnet');
 await expect(page.locator('footer a[target="_blank"]')).toHaveAttribute('href',/https:\/\/monadscan.com\/address\//);
 await page.locator('.wallet-button').click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await expect(dialog).toContainText('Monad Mainnet');
 await expect(dialog.locator('a[href*="faucet"]')).toHaveCount(0);
 await expect(dialog.locator('.account-balance-value')).toContainText('MON');
 await expect(dialog).not.toContainText(/testnet|тестов/i);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/mainnet-wallet-${locale}.png`,fullPage:true});
});
test('a testnet creation recovery draft cannot leak quick windows into mainnet',async({page})=>{
 await mainnet(page);
 await page.addInitScript(()=>sessionStorage.setItem('support.create-recovery',JSON.stringify({savedAt:Date.now(),chainId:10143,contractAddress:'0x4444444444444444444444444444444444444444',draft:{step:2,templateId:'meme',title:'Old testnet draft',quick:true}})));
 await page.goto('/create');
 await expect(page.getByText('Old testnet draft',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Start with a template',{exact:true})).toBeVisible();
 await expect(page.getByText('Quick demo: each stage is 10 minutes',{exact:true})).toHaveCount(0);
});
