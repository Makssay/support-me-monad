import fs from 'node:fs';
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
  await expect(page.locator('.stepped-form')).toBeVisible();
  await expect(page.locator('.wizard-steps li[aria-current=step]')).toHaveText('1Mission title');
  await expect(page.getByLabel('The brief',{exact:true})).not.toBeVisible();
  if(item.id==='reply'){
   await page.getByLabel('Contest post URL').fill('https://example.com/not-a-post');await page.getByRole('button',{name:'Next',exact:true}).click();
   await expect(page.getByRole('alert')).toContainText('Use a public X post URL');await page.getByLabel('Contest post URL').fill('https://x.com/creator/status/1234567890');
  }
  if(item.id==='meme'){
   await page.getByRole('textbox',{name:'Mission title',exact:true}).fill('x');
   await page.getByRole('button',{name:'Next',exact:true}).click();
   await expect(page.locator('.wizard-steps li[aria-current=step]')).toHaveText('1Mission title');
   await page.getByRole('textbox',{name:'Mission title',exact:true}).fill(item.title);
   await page.emulateMedia({reducedMotion:'reduce'});
  }
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('.wizard-steps li[aria-current=step]')).toHaveText('2Reward');
  await expect(page.getByRole('textbox',{name:'Mission title',exact:true})).not.toBeVisible();
  const quickTest=page.getByRole('checkbox',{name:'Quick test · every stage is 10 minutes',exact:false});
  await expect(quickTest).toBeVisible();await quickTest.check();
  await expect(page.getByLabel('Accept submissions for')).toBeDisabled();
  await expect(page.getByLabel('Accept submissions for')).toHaveValue('quick');
  await quickTest.uncheck();await expect(page.getByLabel('Accept submissions for')).toBeEnabled();
  await page.getByLabel('Reward per contribution',{exact:true}).fill('0.02');await page.getByLabel('Reward slots',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.getByLabel('The brief',{exact:true})).toHaveValue(item.brief);
  if(item.id==='nft'){
   await expect(page.getByLabel('Wallet / NFT requirement')).toHaveCount(0);
   await expect(page.getByLabel('Discord requirement')).toHaveCount(0);
   await page.getByLabel('NFT collection contract on this network').fill('not-an-address');
   await expect(page.getByRole('button',{name:'Review mission',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('Enter a valid NFT contract address.');
   await page.getByLabel('NFT collection contract on this network').fill(JSON.parse(fs.readFileSync('.data/local-community-nft.json','utf8')).address);
  }
  if(item.id==='token'){
   await expect(page.getByLabel('NFT standard')).toHaveCount(0);await expect(page.getByLabel('Discord requirement')).toHaveCount(0);
   await page.getByLabel('Token contract on this network').fill('bad');await expect(page.getByRole('button',{name:'Review mission',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('Enter a valid token contract address.');
   await page.getByLabel('Token contract on this network').fill(JSON.parse(fs.readFileSync('.data/local-reward-token.json','utf8')).address);
   await page.getByLabel('Minimum token balance').fill('0');await expect(page.getByRole('button',{name:'Review mission',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('Enter a positive minimum token balance.');await page.getByLabel('Minimum token balance').fill('1.25');
  }
  if(item.id==='wallet'){
   await expect(page.getByLabel('NFT standard')).toHaveCount(0);await expect(page.getByLabel('Discord requirement')).toHaveCount(0);
   const upload=page.locator('input[type="file"]');
   await upload.setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from('[]')});await expect(page.getByRole('alert').filter({hasText:'Use a TXT or CSV'})).toBeVisible();
   await upload.setInputFiles({name:'large.txt',mimeType:'text/plain',buffer:Buffer.alloc(512001,32)});await expect(page.getByRole('alert').filter({hasText:'500 KB'})).toBeVisible();
   await upload.setInputFiles({name:'wallets.txt',mimeType:'text/plain',buffer:Buffer.from(wallet.address+'\nwrong-address')});
   await expect(page.getByRole('status').filter({hasText:'unique entries'})).toContainText('Invalid rows: 2');await expect(page.getByRole('button',{name:'Review mission',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('Correct invalid rows');
   await upload.setInputFiles({name:'wallets.csv',mimeType:'text/csv',buffer:Buffer.from('\uFEFFaddress\r\n"'+wallet.address+'"\r\n'+wallet.address+'\r\n')});
   await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByRole('status').filter({hasText:'unique entries'})).toContainText('1 unique entries · 1 duplicates');await expect(page.getByRole('link',{name:'Download CSV example'})).toHaveAttribute('download','');
   await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/wallet-list-create-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
  }
  await page.getByRole('button',{name:'Review mission',exact:true}).click();await expect(page.locator('.mission-review')).toContainText('0.04 MON');
  await expect(page.getByRole('region',{name:'Your payment breakdown'})).toBeVisible();await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByLabel('The brief',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByLabel('Reward per contribution',{exact:true})).toHaveValue('0.02');
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.locator('.wizard-steps li[aria-current=step]')).toHaveText('1Mission title');
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();
  if(item.id==='meme'){await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/template-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});}
  await expect(page.getByLabel('AI verification SOON',{exact:false})).toBeDisabled();
  await expect(page.getByLabel('AI verification SOON',{exact:false})).not.toBeChecked();
  await expect(page.getByLabel('Kind of contribution')).toHaveCount(0);
  await page.getByRole('button',{name:'Change template',exact:true}).click();
  await expect(page.locator('.template-soon')).toBeDisabled();
  await expect(page.locator('.mission-form')).toHaveCount(0);
 }
 expect(sends).toBe(0);await page.goto('/create');await page.screenshot({path:'test-results/template-picker-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/template-picker-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});const item=missionTemplates[1];await page.getByRole('button',{name:item.title+' '+item.summary,exact:true}).click();
 await page.getByRole('textbox',{name:'Mission title',exact:true}).fill('Template funded meme mission');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Review mission',exact:true}).click();
 allowPayment=true;await page.getByRole('button',{name:'Publish & fund mission',exact:true}).click();await expect(page).toHaveURL(/\/mission\/\d+$/);expect(sends).toBe(1);
 await expect(page.getByRole('heading',{name:'Template funded meme mission',exact:true})).toBeVisible();
 await expect(page.locator('.participants-panel')).toContainText('No participants yet');
 await expect(page.getByRole('region',{name:'Mission progress'})).toBeVisible();
 await page.screenshot({path:'test-results/mission-redesign-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mission-redesign-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 const snapshot=await(await page.request.get('/api/state')).json();const funded=snapshot.missions.find((m:any)=>m.id===Number(page.url().split('/').pop()));
 expect(funded.mode).toBe(0);expect(funded.aiReview).toBe(false);expect(funded.aiModel).toBe('');expect(funded.aiRubric).toBe('');
 await rpc.send('evm_increaseTime',[11*86400]);await rpc.send('evm_mine',[]);await page.request.post('/api/refresh');await page.reload();
 await page.getByRole('button',{name:'Close & refund remaining MON',exact:true}).click();await page.getByRole('button',{name:'Confirm close & refund',exact:true}).click();await expect(page.getByText('Closed',{exact:true})).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('support.locale','ru'));await page.goto('/create');
 await expect(page.getByRole('heading',{name:'Начни с шаблона',exact:true})).toBeVisible();
 await page.locator('.template-tile').first().click();await expect(page.getByRole('button',{name:'Далее',exact:true})).toBeVisible();
 await expect(page.locator('input[type=url]')).toBeVisible();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{rpc.destroy();}
});
