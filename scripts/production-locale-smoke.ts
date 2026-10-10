import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3001';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const check = expect.configure({ timeout: 60000 });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.name));
try {
  const response = await page.request.get(`${baseURL}/api/state`, { timeout: 60000 });
  if (!response.ok()) throw new Error('State unavailable');
  const state = await response.json();
  expect(state.missions.every((m:any)=>!['Testing','Launch support'].includes(m.category))).toBe(true);
  const mission = state.missions.find((item: any) => item.id === 9);
  if (!mission) throw new Error('Demo mission missing');
  const profile = state.contributions.find((item: any) => item.missionId === 9 && item.status === 1)?.contributor;
  await page.goto(`${baseURL}/mission/9`);
  await page.getByRole('button', { name: 'Русский', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Зафиксированный публичный рейтинг' })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('heading', { name: mission.title, exact: true })).toBeVisible();
  await expect(page.locator('.payout-proof')).toContainText('0,003 MON');
  await page.screenshot({ path: 'test-results/ru-production-mission-desktop.png', fullPage: true });
  for (const width of [320, 390, 768, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/create', '/mission/9', '/mission/9/submit', '/dashboard', `/profile/${profile}`, '/activity']) {
      await page.goto(baseURL + path);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path}, ${width}`).toBe(true);
      // A clipped header can hide overflow from scrollWidth, so check each control's bounds too.
      for (const selector of ['.language-toggle', '.wallet-button', '.wordmark']) {
        const bounds = await page.locator(`header ${selector}`).boundingBox();
        expect(!!bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, `${selector}, ${width}`).toBe(true);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/mission/9`);
  await check(page.getByRole('heading', { name: 'Зафиксированный публичный рейтинг' })).toBeVisible();
  await page.screenshot({ path: 'test-results/ru-production-mission-mobile.png', fullPage: true });
  await page.goto(baseURL);
  await expect(page.getByRole('heading', { name: 'Приноси пользу.' })).toBeVisible();
  await expect(page.locator('.filter-list button')).toHaveText(['Все задания','Мемы','Обратная связь','Контент для соцсетей','Реплаи','Поиск багов']);
  await page.screenshot({ path: 'test-results/ru-production-feed-mobile.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make yourself useful.' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.filter-list button')).toHaveText(['All missions','Memes','Feedback','Social content','Replies','Bug hunting']);
  expect(errors).toEqual([]);
  const report = { passed: true, languages: ['en', 'ru'], persisted: true, pages: 7, mobileWidths: [320, 390, 768, 1100, 1440], realPayoutShown: '0.003 MON', authorContentPreserved: true, browserErrors: 0, checkedAt: new Date().toISOString() };
  fs.writeFileSync('locale-validation.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
