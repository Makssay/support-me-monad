import { chromium } from '@playwright/test';
import fs from 'node:fs';
const proof = JSON.parse(fs.readFileSync('v2-demo-proof.json', 'utf8'));
const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
fs.mkdirSync('test-results', { recursive: true });
try {
 await page.goto('http://127.0.0.1:3001'); await page.waitForSelector('.mission-row', { timeout: 60000 });
 const state = await (await page.request.get('http://127.0.0.1:3001/api/state')).json(); if (state.config.chainId !== 10143 || state.missions.length < 4) throw new Error('Missing testnet state');
 await page.screenshot({ path: 'test-results/production-feed.png', fullPage: true });
 await page.getByLabel('Search missions').fill('fresh pair'); if (await page.locator('.mission-row').count() !== 1) throw new Error('Search failed'); await page.getByLabel('Search missions').fill('');
 await page.getByRole('button', { name: 'Memes', exact: true }).click(); if (await page.locator('.mission-row').count() !== 1) throw new Error('Filter failed');
 await page.goto(`http://127.0.0.1:3001/mission/${proof.missions[1]}`); await page.waitForSelector('.payout-proof'); if (!(await page.locator('.payout-proof').textContent())?.includes('0.005 MON')) throw new Error('Payout missing'); await page.screenshot({ path: 'test-results/production-mission.png', fullPage: true });
 await page.goto(`http://127.0.0.1:3001/profile/${proof.contributor}`); await page.waitForSelector('.signal-badge'); if ((await page.locator('.signal-badge strong').textContent()) !== '15') throw new Error('Reputation missing'); await page.screenshot({ path: 'test-results/production-profile.png', fullPage: true });
 await page.goto('http://127.0.0.1:3001/activity'); await page.waitForSelector('.leaderboard-row'); await page.getByRole('button', { name: 'Recent activity', exact: true }).click(); await page.waitForSelector('.activity-row');
 for (const url of ['/', `/mission/${proof.missions[1]}`, `/profile/${proof.contributor}`, '/activity', '/create', '/dashboard']) { await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`http://127.0.0.1:3001${url}`); await page.waitForSelector('footer'); if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('Mobile overflow'); }
 await page.goto('http://127.0.0.1:3001'); await page.waitForSelector('.mission-row'); await page.screenshot({ path: 'test-results/production-mobile.png', fullPage: true });
 const envResponse = await page.request.get('http://127.0.0.1:3001/.env'); if (envResponse.status() === 200 && (await envResponse.text()).includes('MONAD_PRIVATE_KEY=')) throw new Error('Env exposed');
 if (errors.length) throw new Error('Browser runtime error');
 const report = { passed: true, chainId: 10143, productionBuild: true, missions: state.missions.length, contributions: state.contributions.length, payoutReceiptPresent: true, profileScore: 15, searchAndFilters: true, mobilePages: 6, noHorizontalOverflow: true, browserErrors: 0, envNotServed: true, checkedAt: new Date().toISOString() };
 fs.writeFileSync('production-check.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (e: any) { console.error('Production smoke failed:', e.message); process.exitCode = 1; } finally { await browser.close(); }
