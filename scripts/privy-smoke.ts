import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = []; page.on('pageerror', e => errors.push(e.name));
fs.mkdirSync('test-results', { recursive: true });
try {
 await page.goto('http://127.0.0.1:3001');
 await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
 await page.getByRole('button', { name: 'Continue with X', exact: true }).waitFor();
 if (await page.getByText('Continue with email, Google or wallet', { exact: true }).count()) throw new Error('Legacy signup visible');
 await page.screenshot({ path: 'test-results/x-signup-desktop.png', fullPage: true });
 await page.getByRole('button', { name: 'Sign in with backup email', exact: true }).click();
 await page.getByRole('textbox', { name: 'Backup email', exact: true }).waitFor({ timeout: 60000 });
 await page.getByRole('textbox', { name: 'Backup email', exact: true }).fill('');
 // No email is sent, no third-party identity is created during this smoke test.
 await page.screenshot({ path: 'test-results/backup-login-desktop.png', fullPage: true });
 await page.setViewportSize({ width: 390, height: 844 });
 if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('Backup dialog overflows');
 await page.screenshot({ path: 'test-results/backup-login-mobile.png', fullPage: true });
 await page.getByRole('button', { name: 'Close backup sign in' }).click();
 await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
 await page.getByRole('button', { name: 'Continue with X', exact: true }).waitFor();
 await page.screenshot({ path: 'test-results/x-signup-mobile.png', fullPage: true });
 for (const url of ['/api/auth/session', '/api/contributions/1/verify', '/api/missions/1/reply/challenge']) {
  const res = await page.request.post(`http://127.0.0.1:3001${url}`, { data: {} });
  if (res.status() !== 401) throw new Error('Anonymous protected request admitted');
 }
 const forged = await page.request.post('http://127.0.0.1:3001/api/auth/session', { headers: { Authorization: 'Bearer fake.fake.fake' } });
 if (forged.status() !== 401) throw new Error('Forged session admitted');
 if (errors.length) throw new Error('Browser runtime error');
 const report = { passed: true, xSignupPrimary: true, backupEmailForm: true, mobileOverflow: false, browserErrors: 0, anonymousApiDenied: 3, forgedTokenDenied: true, liveXLoginVerified: false, liveEmailRecoveryVerified: false };
 fs.writeFileSync('privy-x-check.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch { console.error('X and backup login smoke failed.'); process.exitCode = 1; }
finally { await browser.close(); }
