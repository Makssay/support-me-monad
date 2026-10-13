import { test, expect, type Page } from '@playwright/test';
import { missionDefaults, contributionDefaults } from '../shared/model';

const owner = '0x1111111111111111111111111111111111111111';
const linked = '0x3333333333333333333333333333333333333333';
const visitor = '0x2222222222222222222222222222222222222222';
async function fixture(page: Page, wallet = owner, locale = 'en', remaining = '2') {
  const now = Math.floor(Date.now() / 1000);
  const config = { local: true, chainId: 31337, version: 8, contractAddress: '0x4444444444444444444444444444444444444444', explorer: 'https://example.org', publicRpc: 'http://127.0.0.1:8546', privyAppId: '', authProvider: 'privy', walletAuthEnabled: false };
  const profile = (address: string) => ({ address, name: 'Mission creator', username: 'creator', xId: '123', submitted: 0, accepted: 0, earned: '0', completed: 0, acceptanceRate: 0, score: 0, credits: '0' });
  const snapshot = { config, updatedAt: new Date().toISOString(), chainTime: now, profiles: [profile(owner), profile(linked)], missions: [{ ...missionDefaults, id: 1, creator: owner, creatorName: 'Mission creator', title: 'Review inbox QA', description: 'A useful mission brief.', requirements: 'Original work.', reward: '0.01', remaining, automation: { enabled: true, pythReserve: '1', executionReserve: '1' }, deadline: now + 86400, reviewDeadline: now + 172800, closed: false, mode: 0 }], contributions: Array.from({ length: 200 }, (_, i) => ({ ...contributionDefaults, id: i + 1, missionId: 1, contributor: `0x${(i + 100).toString(16).padStart(40, '0')}`, name: `Writer ${String(i + 1).padStart(3, '0')}`, text: `Original work number ${i + 1}.`, socialUrl: `https://x.com/writer/status/${i + 1}`, status: (i + 1) % 2 ? 1 : 0, paid: (i + 1) % 2 ? '0.01' : '0' })) };
  await page.route('**/api/config', route => route.fulfill({ json: config }));
  await page.route('**/api/state', route => route.fulfill({ json: snapshot }));
  await page.addInitScript(({ wallet, locale }) => {
    localStorage.setItem('support.locale', locale); localStorage.setItem('support.wallet', 'rabby');
    (window as any).ethereum = { isRabby: true, request: async ({ method }: any) => {
      if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [wallet];
      if (method === 'eth_chainId') return '0x7a69';
      if (method === 'eth_getBalance') return '0x0';
      if (method === 'wallet_switchEthereumChain') return null;
      throw new Error(`Unexpected wallet request: ${method}`);
    }, on() {}, removeListener() {} };
  }, { wallet, locale });
}

test('creator reviews 200 submissions through keyboard tabs, filters, search and bounded pages', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await fixture(page); await page.goto('/mission/1');
  const overview = page.getByRole('tab', { name: 'Overview' });
  const work = page.getByRole('tab', { name: /Participant work/ });
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.contribution')).toHaveCount(0);
  await overview.focus(); await page.keyboard.press('ArrowRight');
  await expect(work).toBeFocused(); await expect(work).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.submission-row')).toHaveCount(10);
  await expect(page.getByText('Showing 1–10 of 200')).toBeVisible();
  await page.getByRole('button', { name: /Writer 200/ }).click();
  await expect(page.locator('.contribution')).toHaveCount(1);
  const pay = page.getByRole('button', { name: 'Approve & pay 0.01 MON', exact: true });
  await expect(pay).toBeDisabled(); await page.getByLabel('I checked the work and authorship').check(); await expect(pay).toBeEnabled();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('.contribution')).toHaveCount(0); await expect(page.getByText('Showing 11–20 of 200')).toBeVisible();
  await page.getByRole('button', { name: 'Rewarded 100', exact: true }).click();
  await expect(page.getByText('Showing 1–10 of 100')).toBeVisible();
  await page.getByRole('button', { name: 'All work 200', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search participant work' }).fill('Writer 042');
  await expect(page.locator('.submission-row')).toHaveCount(1);
  await page.getByRole('button', { name: /Writer 042/ }).click();
  await expect(page.locator('.contribution-text')).toHaveText('Original work number 42.');
  await page.getByRole('searchbox').fill('nothing-matches'); await expect(page.getByRole('heading', { name: 'No matching submissions' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click(); await expect(page.locator('.submission-row')).toHaveCount(10);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/submissions-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('creator deep links open the right page and work in Russian', async ({ page }) => {
  await fixture(page, owner, 'ru'); await page.goto('/mission/1#contribution-1');
  await expect(page.getByRole('tab', { name: /Работы участников/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('191–200 из 200')).toBeVisible();
  await expect(page.locator('#contribution-1 .contribution-text')).toHaveText('Original work number 1.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/submissions-desktop.png', fullPage: true });
});

test('other users cannot see the work tab or participant submissions', async ({ page }) => {
  await fixture(page, visitor); await page.goto('/mission/1');
  await expect(page.getByRole('heading', { name: 'Review inbox QA' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Participant work/ })).toHaveCount(0);
  await expect(page.locator('.submission-row, .contribution')).toHaveCount(0);
});

test('a linked creator wallet can inspect but cannot approve', async ({ page }) => {
  await fixture(page, linked); await page.goto('/mission/1#contribution-200');
  await expect(page.getByRole('tab', { name: /Participant work/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#contribution-200')).toBeVisible();
  await expect(page.getByRole('button', { name: /Approve & pay/ })).toHaveCount(0);
});

for (const locale of ['en', 'ru']) test(`exhausted rewards finish the journey before the deadline (${locale})`, async ({ page }) => {
  await fixture(page, visitor, locale, '0');
  await page.goto('/mission/1');
  const title = locale === 'ru' ? 'Все награды выплачены' : 'All rewards have been paid';
  const journey = page.getByRole('region', { name: locale === 'ru' ? 'Ход задания' : 'Mission progress' });
  await expect(journey.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('.detail-category .pill')).toHaveText(title);
  await expect(journey.locator('.journey-track li.complete')).toHaveCount(4);
  await expect(journey.locator('.journey-time')).toHaveCount(0);
  await expect(journey.locator(':scope > small')).toHaveCount(0);
  await expect(journey).toContainText(locale === 'ru' ? 'Приём новых работ завершён.' : 'no longer accepting entries.');
  await expect(page.locator('a[href="/mission/1/submit"]')).toHaveCount(0);
  await expect(page.locator('.raffle-progress')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/rewards-exhausted-${locale}.png`, fullPage: true });
});
