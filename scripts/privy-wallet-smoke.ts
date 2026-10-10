// A disposable, unfunded test wallet signs Privy's login challenge. No .env secrets used.
import { chromium } from '@playwright/test';
import { Wallet, JsonRpcProvider, getBytes } from 'ethers';
import { PUBLIC_RPC } from '../shared/model';
import fs from 'node:fs';
const wallet = Wallet.createRandom(); const provider = new JsonRpcProvider(PUBLIC_RPC);
const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
const errors: string[] = []; page.on('pageerror', e => errors.push(e.name));
const methods: string[] = [];
await page.exposeFunction('qaWallet', async ({ method, params = [] }: { method: string; params?: any[] }) => {
 methods.push(method);
 if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [wallet.address];
 if (['wallet_getPermissions', 'wallet_requestPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts', caveats: [{ type: 'restrictReturnedAccounts', value: [wallet.address] }] }];
 if (['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_revokePermissions'].includes(method)) return null;
 if (method === 'personal_sign') return wallet.signMessage(getBytes(params[0]));
 if (method === 'eth_chainId') return '0x279f';
 if (method.startsWith('eth_send') || method.startsWith('eth_sign')) throw new Error('QA wallet never sends transactions');
 return provider.send(method, params);
});
// A literal avoids tsx's __name helper leaking into the serialized browser function.
await page.addInitScript(`
 const listeners = {};
 const ethereum = { isRabby: true, isConnected: () => true, request: args => window.qaWallet(args), on: (e, f) => { (listeners[e] ||= []).push(f); return ethereum; }, removeListener: (e, f) => { listeners[e] = (listeners[e] || []).filter(x => x !== f); return ethereum; } };
 window.ethereum = ethereum;
 const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: 'a03f5a37-045c-4d25-868d-06427d1b6905', name: 'Rabby Wallet', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=', rdns: 'io.rabby' }, provider: ethereum } }));
 window.addEventListener('eip6963:requestProvider', announce); announce();
`);
try {
 await page.goto('http://127.0.0.1:3001'); await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
 await page.getByRole('button', { name: 'Continue with email, Google or wallet', exact: true }).click({ timeout: 60000 });
 await page.getByRole('button', { name: 'Continue with a wallet', exact: true }).click();
 await page.getByRole('button', { name: /Rabby/ }).first().click();
 // Privy asks the user to explicitly confirm wallet authentication.
 const confirm = page.getByRole('button', { name: /^(sign message|sign and connect|confirm|sign in to.*)$/i });
 await Promise.race([page.locator('.wallet-button .status-dot.connected').waitFor({ timeout: 45000 }), confirm.first().waitFor({ timeout: 45000 }).then(() => confirm.first().click())]);
 await page.locator('.wallet-button .status-dot.connected').waitFor({ timeout: 60000 });
 await page.reload(); await page.locator('.wallet-button .status-dot.connected').waitFor({ timeout: 60000 });
 if (!(await page.locator('.wallet-button').innerText()).includes(wallet.address.slice(0, 6))) throw new Error('Restored a different wallet');
 await page.locator('.wallet-button').click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
 await page.getByRole('button', { name: 'Sign in', exact: true }).first().waitFor();
 if (errors.length) throw new Error('Browser runtime error');
 fs.writeFileSync('privy-check.json', JSON.stringify({ passed: true, liveWalletAuthentication: true, sessionRestored: true, signOut: true, transactionsSent: 0, browserErrors: 0, checkedAt: new Date().toISOString() }, null, 2));
 console.log('Privy live wallet authentication, session restore, and sign out passed. No transactions sent.');
} catch (e: any) { console.error('Privy wallet session test failed:', e.message.slice(0, 450)); console.log(JSON.stringify({ methods })); console.log((await page.locator('body').innerText()).slice(-800)); await page.screenshot({ path: 'test-results/privy-wallet-failed.png', fullPage: true }); process.exitCode = 1; }
finally { await browser.close(); provider.destroy(); }
