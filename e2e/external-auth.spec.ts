import { test, expect } from '@playwright/test';
import { Contract, HDNodeWallet, JsonRpcProvider, getBytes } from 'ethers';
import fs from 'node:fs';
import { emptyWalletAuth, WalletAuthPolicy } from '../server/wallet-auth-policy';

test('External wallet links X once, restores, clears on account switch and never sponsors gas', async ({ page }) => {
 const rpc = new JsonRpcProvider(process.env.QA_RPC_URL || 'http://127.0.0.1:8546', 31337, { batchMaxCount: 1 });
 const wallet = HDNodeWallet.fromPhrase('test test test test test test test test test test test junk');
 const policy = new WalletAuthPolicy(emptyWalletAuth(), 'http://127.0.0.1:5174', 31337, 'https://x.com/Makssay_eth/status/2109778998876119439', () => {});
 let badReply = true, paidLookups = 0, sponsoredRequests = 0, sentHash = '';
 const token = JSON.parse(fs.readFileSync('.data/local-reward-token.json', 'utf8')).address;
 const recipient = HDNodeWallet.fromPhrase('test test test test test test test test test test test junk', undefined, "m/44'/60'/0'/0/1").address;
 const asset = { address: token, chainId: 31337, name: 'QA reward token', symbol: 'QAR', decimals: 6, source: 'test-fixture' };
 const erc20 = new Contract(token, ['function balanceOf(address) view returns(uint256)'], rpc);
 try {
  await page.exposeFunction('externalAuthRpc', async ({ method, params = [] }: any) => {
   if (method === 'personal_sign') return wallet.signMessage(getBytes(params[0]));
   const result = await rpc.send(method, params);
   if (method === 'eth_sendTransaction') sentHash = result;
   return result;
  });
  await page.addInitScript(({ address }) => {
   localStorage.setItem('support.locale', 'ru');
   const listeners: Record<string, Function[]> = {};
   (window as any).ethereum = { isRabby: true, request: ({ method, params }: any) => method === 'eth_requestAccounts' || method === 'eth_accounts' ? Promise.resolve([(window as any).qaAccount || address]) : (window as any).externalAuthRpc({ method, params }), on: (event: string, cb: Function) => { (listeners[event] ||= []).push(cb); }, removeListener: (event: string, cb: Function) => { listeners[event] = (listeners[event] || []).filter(f => f !== cb); } };
   (window as any).qaChangeAccount = (address: string) => { (window as any).qaAccount = address; for (const cb of listeners.accountsChanged || []) cb([address]); };
  }, { address: wallet.address });
  await page.route('**/api/config', async route => { const r = await route.fetch(); await route.fulfill({ response: r, json: { ...await r.json(), privyAppId: 'qa-external-auth', walletAuthEnabled: true, gasSponsorship: true } }); });
  await page.route('**/api/state', async route => { const r = await route.fetch(); const state = await r.json(); state.profiles.push({ address: wallet.address, name: 'qa_external', submitted: 0, accepted: 0, earned: '0', completed: 0, acceptanceRate: 0, score: 0, credits: '0', tokenRewards: [{ asset, earned: '1', credits: '0' }] }); await route.fulfill({ response: r, json: state }); });
  await page.route('**/api/wallet-auth/**', async route => {
   const path = new URL(route.request().url()).pathname, body = route.request().postDataJSON();
   try {
    let result: unknown;
    if (path.endsWith('/challenge')) result = policy.challenge(body.wallet);
    else if (path.endsWith('/login')) result = policy.login(body.id, body.signature);
    else if (path.endsWith('/link')) {
     paidLookups++;
     const p = policy.pending(body.linkToken);
     result = policy.link(body.linkToken, { status: 'verified', checkedAt: new Date().toISOString(), postedAt: new Date().toISOString(), author: 'qa_external', authorId: '555000123', replyTo: badReply ? '999' : '2109778998876119439', text: p.code, note: '' });
    } else { policy.logout((route.request().headers().authorization || '').slice(7)); result = { ok: true }; }
    await route.fulfill({ json: result });
   } catch (e) { await route.fulfill({ status: 400, json: { error: (e as Error).message } }); }
  });
  await page.route('**/api/auth/session', async route => {
   try { const b = policy.identify((route.request().headers().authorization || '').slice(7)); await route.fulfill({ json: { xId: b.xId, username: b.username, backupEmail: false } }); }
   catch { await route.fulfill({ status: 401, json: { error: 'expired' } }); }
  });
  page.on('request', req => { if (/privy.*\/wallets.*\/rpc/.test(req.url())) sponsoredRequests++; });
  await page.goto('/'); await page.locator('.wallet-button').click();
  await expect(page.getByRole('tab', { name: 'Privy', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Privy не работает?' }).click();
  await expect(page.getByRole('button', { name: 'Rabby', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Rabby', exact: true }).click();
  await expect(page.getByText('Скопируй личный код')).toBeVisible();
  await page.locator('#wallet-reply-url').fill('https://x.com/test/status/2109778998876119440');
  await page.getByRole('button', { name: 'Подтвердить и войти' }).click();
  await expect(page.getByRole('alert')).toContainText('Ответь напрямую');
  await expect(page.locator('.wallet-button')).not.toContainText('@qa_external');
  badReply = false;
  fs.mkdirSync('.data', { recursive: true });
  await page.screenshot({ path: '.data/external-auth-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#wallet-reply-url')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.data/external-auth-mobile.png' });
  await page.getByRole('button', { name: 'Подтвердить и войти' }).click();
  await expect(page.locator('.wallet-button')).toContainText('@qa_external');
  await expect(page.getByRole('dialog')).toContainText('Комиссию сети оплачиваешь сам');
  await expect(page.getByText('Добавить резервный email', { exact: true })).toHaveCount(0);
  await page.reload(); await expect(page.locator('.wallet-button')).toContainText('@qa_external');
  await page.locator('.wallet-button').click();
  await page.getByRole('button', { name: 'Отправить токены', exact: true }).click();
  await page.getByLabel('Кошелёк получателя', { exact: true }).fill(recipient);
  await page.locator('.wallet-token-amount input').fill('1');
  await page.getByRole('button', { name: 'Проверить перевод', exact: true }).click();
  const beforeGas = BigInt(await rpc.send('eth_getBalance', [wallet.address, 'latest']));
  const beforeTokens = await erc20.balanceOf(recipient);
  await page.getByRole('button', { name: 'Подтвердить перевод', exact: true }).click();
  await expect(page.getByText('Токены отправлены', { exact: true })).toBeVisible({ timeout: 30000 });
  expect(sentHash).toMatch(/^0x[\da-f]{64}$/i);
  const receipt = await rpc.getTransactionReceipt(sentHash);
  expect(receipt?.status).toBe(1);
  expect(beforeGas - BigInt(await rpc.send('eth_getBalance', [wallet.address, 'latest']))).toBe(receipt!.fee);
  expect(await erc20.balanceOf(recipient)).toBe(beforeTokens + 1000000n);
  expect(paidLookups).toBe(2); expect(sponsoredRequests).toBe(0);
  await page.evaluate(() => (window as any).qaChangeAccount('0x1111111111111111111111111111111111111111'));
  await expect(page.locator('.wallet-button')).not.toContainText('@qa_external');
  expect(await page.evaluate(() => sessionStorage.getItem('support.external-session'))).toBeNull();
 } finally { rpc.destroy(); }
});
