import {test,expect} from '@playwright/test';
import {HDNodeWallet,JsonRpcProvider,getBytes} from 'ethers';
import {missionTemplates} from '../src/mission-templates';
test('All templates validate, review, preserve edits and publish safely',async({page})=>{
 const rpc=new JsonRpcProvider(process.env.QA_RPC_URL||'http://127.0.0.1:8546',31337,{batchMaxCount:1});
 const wallet=HDNodeWallet.fromPhrase('test test test test test test test test test test test junk').connect(rpc);
 let sends=0,allowPayment=false;
 try{
 await page.exposeFunction('templateRpc',async({method,params=[]}:any)=>{
  if(['eth_accounts','eth_requestAccounts'].includes(method))return [wallet.address];
  if(method==='wallet_switchEthereumChain')return null;
  if(method==='personal_sign')return wallet.signMessage(getBytes(params[0]));
  if(method==='eth_sendTransaction'){sends++;if(!allowPayment)throw new Error('Unexpected payment');const {from,gas,...tx}=params[0];if(gas)tx.gasLimit=gas;return (await wallet.sendTransaction(tx)).hash;}
  return rpc.send(method,params);
 });
 await page.addInitScript(()=>{(window as any).ethereum={isMetaMask:true,request:(a:unknown)=>(window as any).templateRpc(a),on:()=>{},removeListener:()=>{}};});
 await page.goto('/');await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:'MetaMask',exact:true}).click();
 for(const item of missionTemplates){
  await page.goto('/create');await page.getByRole('button',{name:item.title+' '+item.summary,exact:true}).click();
  await expect(page.locator('.template-form')).toBeVisible();await expect(page.getByLabel('The brief',{exact:true})).toHaveValue(item.brief);
  await expect(page.locator('.wizard-steps')).toHaveCount(0);
  if(item.id==='reply'){
   await page.getByLabel('Contest post URL').fill('https://example.com/not-a-post');await page.getByRole('button',{name:'Review mission',exact:true}).click();
   await expect(page.getByRole('alert')).toContainText('Use a public X post URL');await page.getByLabel('Contest post URL').fill('https://x.com/creator/status/1234567890');
  }
  await page.getByLabel('Reward per contribution',{exact:true}).fill('0.02');await page.getByLabel('Reward slots',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Review mission',exact:true}).click();await expect(page.locator('.mission-review')).toContainText('0.04 MON');
  await expect(page.getByRole('region',{name:'Your payment breakdown'})).toBeVisible();await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByLabel('Reward per contribution',{exact:true})).toHaveValue('0.02');
  if(item.id==='meme'){await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/template-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});}
  await page.getByRole('button',{name:'Use full builder',exact:true}).click();await expect(page.getByLabel('Kind of contribution')).toHaveValue(item.category);
  await expect(page.locator(`[data-payment-mode="${item.mode}"]`)).toHaveAttribute('aria-pressed','true');
 }
 expect(sends).toBe(0);await page.goto('/create');await page.screenshot({path:'test-results/template-picker-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/template-picker-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});const item=missionTemplates[1];await page.getByRole('button',{name:item.title+' '+item.summary,exact:true}).click();
 await page.getByLabel('Mission title',{exact:true}).fill('Template funded meme mission');await page.getByRole('button',{name:'Review mission',exact:true}).click();
 allowPayment=true;await page.getByRole('button',{name:'Publish & fund mission',exact:true}).click();await expect(page).toHaveURL(/\/mission\/\d+$/);expect(sends).toBe(1);
 await expect(page.getByRole('heading',{name:'Template funded meme mission',exact:true})).toBeVisible();
 await rpc.send('evm_increaseTime',[11*86400]);await rpc.send('evm_mine',[]);await page.request.post('/api/refresh');await page.reload();
 await page.getByRole('button',{name:'Close & refund remaining MON',exact:true}).click();await page.getByRole('button',{name:'Confirm close & refund',exact:true}).click();await expect(page.getByText('Closed',{exact:true})).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('support.locale','ru'));await page.goto('/create');
 await expect(page.getByRole('heading',{name:'Начни с шаблона',exact:true})).toBeVisible();
 await page.locator('.template-tile').first().click();await expect(page.getByRole('button',{name:'Проверить задание',exact:true})).toBeVisible();
 await expect(page.locator('input[type=url]')).toBeVisible();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{rpc.destroy();}
});
