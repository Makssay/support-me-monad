import {test,expect} from '@playwright/test';
import {HDNodeWallet,JsonRpcProvider,Contract,getBytes,parseUnits} from 'ethers';
import fs from 'node:fs';
import {erc20Abi} from '../shared/rewards';
const p=new JsonRpcProvider(process.env.QA_RPC_URL||'http://127.0.0.1:8546',31337,{batchMaxCount:1});
const wallets=[2,3].map(i=>HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,`m/44'/60'/0'/0/${i}`).connect(p));
test.afterAll(()=>p.destroy());
test('Token mission: exact approval, escrow, submission, payout and profile',async({page})=>{
 test.setTimeout(120000);let active=0;const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('qaTokenWallet',async({method,params=[]}:{method:string;params:any[]})=>{
  const wallet=wallets[active];if(['eth_accounts','eth_requestAccounts'].includes(method))return[wallet.address];if(method==='wallet_switchEthereumChain')return null;
  if(method==='personal_sign')return wallet.signMessage(getBytes(params[0]));
  if(method==='eth_sendTransaction'){const {from,gas,...tx}=params[0];if(gas)tx.gasLimit=gas;return(await wallet.sendTransaction(tx)).hash;}return p.send(method,params);
 });
 await page.addInitScript(()=>{const listeners:Record<string,Function[]>={};(window as any).ethereum={isMetaMask:true,request:(q:any)=>(window as any).qaTokenWallet(q),on:(e:string,f:Function)=>(listeners[e]||=[]).push(f),removeListener:(e:string,f:Function)=>{listeners[e]=listeners[e]?.filter(v=>v!==f);}};(window as any).switchTokenWallet=(a:string)=>listeners.accountsChanged?.forEach(f=>f([a]));});
 await page.goto('/');await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:'MetaMask',exact:true}).click();
 await page.goto('/create');await page.getByLabel('Mission title').fill('Make an original community meme');await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByLabel('Reward currency').selectOption('token');
 const tokenAddress=JSON.parse(fs.readFileSync('.data/local-reward-token.json','utf8')).address;
 await page.getByLabel('nad.fun token URL or contract address').fill(tokenAddress);await page.getByRole('button',{name:'Check token',exact:true}).click();await expect(page.getByText('QA reward token (QAR)',{exact:true})).toBeVisible();
 await page.getByLabel('Reward per contribution',{exact:true}).fill('1.123456');await page.getByLabel('Reward slots',{exact:true}).fill('1');await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByLabel('The brief',{exact:true}).fill('Create one original friendly meme for this community.');await page.getByLabel('What makes a great contribution?').fill('Original text and community relevance.');await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.locator('.mission-review')).toContainText('1.123456 QAR');await expect(page.locator('.mission-review')).toContainText('0.2 MON');await page.getByRole('button',{name:'Publish & fund mission',exact:true}).click();await page.waitForURL(/\/mission\/\d+$/);
 const missionUrl=page.url();const id=Number(missionUrl.split('/').pop());const token=new Contract(tokenAddress,erc20Abi,p);const deployment=JSON.parse(fs.readFileSync('.data/local-deployment.json','utf8'));
 const fees=new Contract(deployment.creationFees,['function paid(address,uint256) view returns(uint256)','function tiers(address,uint256) view returns(uint8)'],p);expect(await fees.paid(deployment.address,id)).toBe(parseUnits('0.2',18));expect(await fees.tiers(deployment.address,id)).toBe(0n);
 expect(await token.balanceOf(deployment.address)).toBe(parseUnits('1.123456',6));expect(await token.allowance(wallets[0].address,deployment.address)).toBe(0n);
 active=1;await page.evaluate(a=>(window as any).switchTokenWallet(a),wallets[1].address);await page.getByRole('link',{name:'I can help',exact:true}).click();await page.getByLabel('Your name').fill('Token Contributor');await page.getByLabel('Your contribution').fill('An original community meme with a clear friendly caption.');await page.getByLabel(/I understand this payment agreement/).check();await page.getByRole('button',{name:'Submit contribution',exact:true}).click();await page.waitForURL(missionUrl);
 active=0;await page.evaluate(a=>(window as any).switchTokenWallet(a),wallets[0].address);await page.getByLabel(/I checked the work and authorship/).check();await page.getByRole('button',{name:/Approve & pay/}).click();await expect(page.getByText('1.123456 QAR paid on Monad')).toBeVisible();
 expect(await token.balanceOf(wallets[1].address)).toBe(parseUnits('1.123456',6));
 await page.goto(`/profile/${wallets[1].address}`);await expect(page.getByRole('heading',{name:'Token rewards'})).toBeVisible();await expect(page.locator('.profile-token-rewards')).toContainText('1.123456');await expect(page.locator('.profile-stats')).not.toContainText('1.123456');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.goto(missionUrl);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 const state=await(await page.request.get('/api/state')).json();const m=state.missions.find((m:any)=>m.id===id);expect(m.rewardAsset.symbol).toBe('QAR');expect(m.reward).toBe('1.123456');
 fs.writeFileSync('token-browser-proof.json',JSON.stringify({passed:true,syntheticQA:true,tokenDecimals:6,exactAllowance:true,exactEscrow:true,payout:'1.123456 QAR',separateMonReserves:true,profilePerCurrency:true,mobileNoOverflow:true,browserErrors:0},null,2));
});

