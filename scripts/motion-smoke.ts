import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const base = 'http://127.0.0.1:3001';
const snapshot = await (await fetch(`${base}/api/state`)).json();
const fixture = structuredClone(snapshot);
fixture.config.privyAppId = '';
const contribution = fixture.contributions.find((c: any) => c.status === 1);
if (!contribution) throw new Error('Missing payout fixture');
const paid = structuredClone(contribution);
contribution.status = 0; contribution.paid = '0';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/config', route => route.fulfill({ json: fixture.config }));
await page.route('**/api/state', route => route.fulfill({ json: fixture }));
await page.addInitScript(`const originalInterval = window.setInterval.bind(window); window.setInterval = (fn, delay, ...args) => originalInterval(fn, delay === 15000 ? 500 : delay, ...args); window.ethereum = { request: async () => { throw new Error('QA connection rejection'); } };`);
try {
 await page.goto(base); await page.waitForSelector('.mission-row');
 await page.getByLabel('Toggle navigation').click();
 await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
 await page.getByLabel('Toggle navigation').click();
 await expect(page.locator('.mobile-nav')).toHaveCount(0);
 // Reopening during an exit must retarget, without duplicate surfaces.
 await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
 await page.getByLabel('Close wallet dialog').click();
 await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
 await expect(page.locator('.wallet-dialog')).toHaveCount(1);
 await page.getByRole('button', { name: 'Browser wallet', exact: true }).click();
 await expect(page.locator('.toast')).toContainText('Connection was not completed');
 await page.keyboard.press('Escape'); await expect(page.locator('.wallet-dialog')).toHaveCount(0);
 await page.getByLabel('Dismiss notification').click();
 await expect(page.locator('.toast')).toHaveCount(0);
 await page.goto(`${base}/mission/${paid.missionId}`);
 await page.waitForSelector('.contribution');
 await expect(page.locator('.payout-proof')).toHaveCount(0);
 Object.assign(contribution, paid);
 await page.waitForSelector('.payout-proof');
 await expect(page.locator('.payout-proof')).toContainText(`${Number(paid.paid)} MON`);
 await expect(page.locator('.payout-proof')).toHaveCSS('opacity', '1');
 await page.reload(); await page.waitForSelector('.payout-proof');
 const historicalTransform = await page.locator('.payout-proof').evaluate(el => getComputedStyle(el).transform);
 if (!['none','matrix(1, 0, 0, 1, 0, 0)'].includes(historicalTransform)) throw new Error('Historical payout replayed');
 await page.goto(`${base}/activity`); await page.waitForSelector('.leaderboard');
 for (const tab of ['Recent activity','Leaderboard','Recent activity']) {
  await page.getByRole('button', { name: tab, exact: true }).click();
  await expect(page.locator('.activity-panel')).toHaveCount(1);
 }
 await page.emulateMedia({ reducedMotion: 'reduce' });
 await expect(page.locator('.activity-panel')).toHaveCSS('transition-duration', '0.08s');
 await page.getByLabel('Toggle navigation').click();
 await expect(page.locator('.mobile-nav')).toHaveCSS('transform', 'none');
 await page.getByLabel('Toggle navigation').click(); await expect(page.locator('.mobile-nav')).toHaveCount(0);
 await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
 await expect(page.locator('.wallet-dialog')).toHaveCSS('transform', 'none');
 await page.keyboard.press('Escape'); await expect(page.locator('.wallet-dialog')).toHaveCount(0);
 for (const width of [320,390,768,900,901,1440]) {
  await page.setViewportSize({ width, height: 900 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Overflow ${width}`);
  if (width <= 900) await expect(page.getByLabel('Toggle navigation')).toBeVisible();
  else await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
 }
 if(errors.length) throw new Error(errors.join('\n'));
 const report = { passed: true, walletExitAndInterruption: true, toastDismissal: true, newPayoutAndHistoricalPayout: true, rapidTabSwitching: true, reducedMotion: true, responsiveWidths: [320,390,768,900,901,1440], browserErrors: 0, transactionsSent: 0 };
 fs.writeFileSync('motion-check.json', JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
} finally { await browser.close(); }

