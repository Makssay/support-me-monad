import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const requests: string[] = []; const errors: string[] = [];
page.on('request', r => requests.push(r.url())); page.on('pageerror', e => errors.push(e.name));
try {
 await page.goto('http://127.0.0.1:3001'); await page.waitForSelector('.mission-row');
 await page.locator('img[src^="/art/"]').evaluateAll(async images => { await Promise.all(images.map(async node => { const image = node as HTMLImageElement; image.loading = 'eager'; await image.decode(); if (!image.naturalWidth) throw new Error('Illustration failed'); })); });
 if (requests.some(url => /assets\/privy-|auth\.privy\.io/.test(url))) throw new Error('Public feed loaded authentication SDK');
 await page.getByLabel('Search missions').fill('fresh pair');
 await page.getByRole('button', { name: 'Sign in', exact: true }).click();
 await page.getByRole('button', { name: 'Continue with email, Google or wallet', exact: true }).click();
 await page.getByPlaceholder('your@email.com').waitFor({ timeout: 60000 });
 if (await page.getByLabel('Search missions').inputValue() !== 'fresh pair') throw new Error('Auth loading reset the feed');
 await page.reload(); await page.waitForSelector('.mission-row');
 for (const width of [320, 390, 768, 1280, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(`Horizontal overflow at ${width}px`);
  const clipped = await page.locator('.wordmark').first().evaluate(el => el.getBoundingClientRect().right > window.innerWidth);
  if (clipped) throw new Error(`Header clipped at ${width}px`);
 }
 await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: 'test-results/redesign-desktop.png', fullPage: true });
 await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await page.waitForSelector('.mission-row');
 const matrix = await page.locator('.hero-art').evaluate(el => getComputedStyle(el).transform);
 if (matrix !== 'none' && matrix !== 'matrix(1, 0, 0, 1, 0, 0)') throw new Error('Reduced motion entrance is active');
 if (errors.length) throw new Error('Browser runtime errors');
 const report = { passed: true, illustrationsLoaded: true, authenticationDeferred: true, feedStatePreservedDuringLogin: true, responsiveWidths: [320, 390, 768, 1280, 1440], reducedMotion: true, browserErrors: 0 };
 fs.writeFileSync('design-check.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch(e: any) { console.error(e.message); process.exitCode = 1; } finally { await browser.close(); }
