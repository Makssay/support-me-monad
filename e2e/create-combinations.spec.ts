import {test,expect,type Page} from '@playwright/test';
import {HDNodeWallet,JsonRpcProvider,getBytes,Contract} from 'ethers';
import fs from 'node:fs';
import {verificationMessage} from '../shared/model';
const provider=new JsonRpcProvider(process.env.QA_RPC_URL||'http://127.0.0.1:8546',31337,{batchMaxCount:1,cacheTimeout:-1});
const wallet=HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,"m/44'/60'/0'/0/8").connect(provider);
let checkpoint:string;
test.beforeEach(async()=>{checkpoint=await provider.send('evm_snapshot',[]);});
test.afterEach(async({request})=>{await provider.send('evm_revert',[checkpoint]);await request.post('/api/refresh');});
test.afterAll(()=>provider.destroy());
async function connect(page:Page){
 await page.exposeFunction('creationQA',async({method,params=[]}:{method:string;params?:any[]})=>{
  if(['eth_accounts','eth_requestAccounts'].includes(method))return[wallet.address];
  if(method==='wallet_switchEthereumChain')return null;
  if(method==='personal_sign')return wallet.signMessage(getBytes(params[0]));
  if(method==='eth_sendTransaction'){const{from,gas,...tx}=params[0];if(gas)tx.gasLimit=gas;return(await wallet.sendTransaction(tx)).hash;}
  return provider.send(method,params);
 });
 await page.addInitScript(()=>{(window as any).ethereum={isMetaMask:true,request:(args:any)=>(window as any).creationQA(args),on:()=>{},removeListener:()=>{}};});
 await page.goto('/');await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:'MetaMask',exact:true}).click();await page.goto('/create');await page.getByLabel('Mission title').fill('Combination regression mission');
}
const next=(page:Page)=>page.getByRole('button',{name:'Next',exact:true}).click();
const back=(page:Page)=>page.getByRole('button',{name:'Back',exact:true}).click();
test('Late token lookup cannot replace MON after changing the reward currency',async({page})=>{
 await connect(page);await next(page);await page.getByLabel('Reward currency').selectOption('token');await page.getByLabel('nad.fun token URL or contract address').fill('0x'+'11'.repeat(20));
 let release!:()=>void,started!:()=>void;const pending=new Promise<void>(r=>release=r),received=new Promise<void>(r=>started=r);
 await page.route('**/api/reward-tokens/lookup?*',async route=>{started();await pending;await route.fulfill({json:{asset:{address:'0x'+'11'.repeat(20),name:'QA stale token',symbol:'STALE',decimals:18,source:'nad.fun',url:'https://testnet.nad.fun/tokens/0x'+'11'.repeat(20)},balance:'100'}});});
 await page.getByRole('button',{name:'Check token',exact:true}).click();await received;await page.getByLabel('Reward currency').selectOption('MON');const response=page.waitForResponse(r=>r.url().includes('/api/reward-tokens/lookup'));release();await response;await expect(page.getByLabel('Reward currency')).toHaveValue('MON');await expect(page.locator('.funding-preview')).not.toContainText('STALE');await page.unrouteAll({behavior:'wait'});
});
test('Every category/payment combination preserves category-specific evidence and reward settings',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await connect(page);
 const target='https://x.com/creator/status/10';
 for(const[category,modes]of Object.entries({'Memes':[0,5,6],'Feedback':[1,0,5,6],'Social content':[2,0,5,6],'Replies':[4,0,5],'Bug hunting':[3]})){
  await page.getByLabel('Kind of contribution').selectOption(category);
  await expect(page.locator('.payment-option')).toHaveCount(modes.length);
  for(const mode of modes){
   await page.locator(`[data-payment-mode="${mode}"]`).click();
   const post=page.getByLabel('Contest post URL');
   if(category==='Replies'){await expect(post).toBeVisible();await post.fill(target);}else await expect(post).toHaveCount(0);
   await next(page);await page.getByLabel('Reward slots',{exact:true}).fill('7');await page.getByLabel('Quick test · every stage is 10 minutes',{exact:false}).check();await next(page);
   const x=page.getByLabel('Require a public X / Twitter post link');
   if(mode===6)await expect(x).toHaveCount(0);
   else if(category==='Replies'||category==='Social content'&&mode===5){await expect(x).toBeChecked();await expect(x).toBeDisabled();}
   else await expect(x).toBeEnabled();
   if(category==='Bug hunting')await expect(page.getByLabel('Add AI Review',{exact:false})).toHaveCount(0);
   await page.getByLabel('The brief',{exact:true}).fill('Deliver relevant work against the published brief.');await page.getByLabel('What makes a great contribution?').fill('Useful, original and on topic.');
   if(mode===6){await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled();}
   else{await next(page);await expect(page.locator('.mission-review')).toContainText('7');if(category==='Replies')await expect(page.locator('.mission-review')).toContainText(target);if(mode===4)await expect(page.locator('.mission-review dt').filter({hasText:'Review deadline'})).toHaveCount(0);await back(page);}
   await back(page);await expect(page.getByLabel('Reward slots',{exact:true})).toHaveValue('7');await back(page);
  }
 }
 // Changing format must not reset the chosen number of rewards or lose a post URL.
 await page.getByLabel('Kind of contribution').selectOption('Replies');await expect(page.getByLabel('Contest post URL')).toHaveValue(target);await page.locator('[data-payment-mode="0"]').click();await expect(page.getByLabel('Contest post URL')).toHaveValue(target);
 await page.getByLabel('Contest post URL').fill('https://example.com/not-a-post');await next(page);await expect(page.getByRole('alert')).toContainText('public X post URL');await expect(page.getByLabel('Contest post URL')).toBeVisible();
 await page.getByLabel('Contest post URL').fill(target);await expect(page.getByRole('alert')).toHaveCount(0);await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/reply-author-choice-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('Creator-selected replies retain the target onchain and reject evidence from another thread',async({page,request})=>{
 await connect(page);await page.getByLabel('Kind of contribution').selectOption('Replies');await page.getByLabel('Contest post URL').fill('https://x.com/creator/status/10');await page.locator('[data-payment-mode="0"]').click();await next(page);await page.getByLabel('Reward slots',{exact:true}).fill('1');await next(page);await expect(page.getByLabel('Require a public X / Twitter post link')).toBeDisabled();await page.getByLabel('The brief',{exact:true}).fill('Reply directly to the specified public post.');await page.getByLabel('What makes a great contribution?').fill('A helpful direct reply.');await next(page);await expect(page.locator('.mission-review')).toContainText('https://x.com/creator/status/10');await page.getByRole('button',{name:'Publish & fund mission',exact:true}).click();await expect(page).toHaveURL(/\/mission\/\d+$/);
 const id=Number(page.url().split('/').pop());const cfg=await(await request.get('/api/config')).json();const ledger=new Contract(cfg.contractAddress,JSON.parse(fs.readFileSync('shared/abi.json','utf8')),wallet);const meta=JSON.parse((await ledger.missions(id)).metadata);expect(meta.targetPost).toBe('https://x.com/creator/status/10');expect(meta.socialRequired).toBe(true);await expect(page.getByRole('link',{name:'Reply to this post',exact:true})).toHaveAttribute('href',meta.targetPost);
 const contributor=HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,"m/44'/60'/0'/0/9").connect(provider);
 fs.writeFileSync('.data/qa-social.json',JSON.stringify({'111':{id_str:'111',user:{screen_name:'wrong_thread',id_str:'123'},full_text:'A good reply to an unrelated post',in_reply_to_status_id_str:'20'}}));
 const receipt=await(await ledger.connect(contributor).getFunction('submitContribution')(id,JSON.stringify({name:'QA reply',text:'Helpful reply',socialUrl:'https://x.com/wrong_thread/status/111'}))).wait();const event=receipt.logs.map((l:any)=>{try{return ledger.interface.parseLog(l);}catch{return null;}}).find((e:any)=>e?.name==='ContributionSubmitted');const cid=Number(event.args.contributionId);const timestamp=Date.now();const signature=await wallet.signMessage(verificationMessage(cid,cfg.contractAddress,cfg.chainId,timestamp));const response=await request.post(`/api/contributions/${cid}/verify`,{data:{timestamp,signature}});expect(response.ok()).toBe(true);const evidence=await response.json();expect(evidence.status).toBe('unsupported');expect(evidence.note).toContain('direct reply');
 await page.goto(`/mission/${id}/submit`); // Creator is blocked from entering their own mission.
 await expect(page.getByText('This contribution is not available.',{exact:true})).toBeVisible();
});
