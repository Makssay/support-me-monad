import { test, expect } from '@playwright/test';
import { Contract, HDNodeWallet, JsonRpcProvider, getBytes } from 'ethers';
import fs from 'node:fs';

test('Russian interface preserves drafts and canonical metadata through payout, reload and mobile navigation', async ({ page, request }) => {
  const rpc = new JsonRpcProvider(process.env.QA_RPC_URL || 'http://127.0.0.1:8546', 31337, { batchMaxCount: 1, cacheTimeout: -1 });
  const wallets = [8, 9].map(i => HDNodeWallet.fromPhrase('test test test test test test test test test test test junk', undefined, `m/44'/60'/0'/0/${i}`).connect(rpc));
  const snapshot = await rpc.send('evm_snapshot', []);
  let active = 0;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    // Earlier raffle tests advance Anvil's clock by days. Keep browser deadlines on that same clock.
    await page.clock.setFixedTime(new Date((await rpc.getBlock('latest'))!.timestamp * 1000));
    await page.exposeFunction('localeWalletRequest', async ({ method, params = [] }: { method: string; params?: any[] }) => {
      const wallet = wallets[active];
      if (['eth_accounts', 'eth_requestAccounts'].includes(method)) return [wallet.address];
      if (method === 'wallet_switchEthereumChain') return null;
      if (method === 'personal_sign') return wallet.signMessage(getBytes(params[0]));
      if (method === 'eth_sendTransaction') {
        const { from, gas, ...transaction } = params[0];
        if (gas) transaction.gasLimit = gas;
        return (await wallet.sendTransaction(transaction)).hash;
      }
      return rpc.send(method, params);
    });
    await page.addInitScript(() => {
      const listeners: Record<string, Array<(...args: any[]) => void>> = {};
      (window as any).ethereum = { isMetaMask: true, request: (payload: any) => (window as any).localeWalletRequest(payload), on: (event: string, listener: (...args: any[]) => void) => (listeners[event] ||= []).push(listener), removeListener: () => {} };
      (window as any).switchLocaleWallet = (address: string) => listeners.accountsChanged?.forEach(listener => listener([address]));
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Русский', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByRole('heading', { name: 'Приноси пользу.' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Русский', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Подключить кошелёк' }).click();
    await page.getByRole('button', { name: 'MetaMask' }).click();
    await page.goto('/create');
    await page.getByLabel('Твоё имя как автора').fill('Русский автор');
    // This title deliberately matches an interface dictionary key. It must remain author content.
    await page.getByLabel('Название задания').fill('Creator choice');
    await page.getByLabel('Категория задания').selectOption('Feedback');
    await expect(page.getByLabel('Формат выплат')).toHaveValue('1');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByLabel('Mission title')).toHaveValue('Creator choice');
    await expect(page.getByLabel('Kind of contribution')).toHaveValue('Feedback');
    await page.getByRole('button', { name: 'Русский', exact: true }).click();
    await page.getByLabel('Категория задания').selectOption('Memes');
    await page.getByRole('button', { name: 'Далее', exact: true }).click();
    await page.getByLabel('Количество наград', { exact: true }).fill('1');
    await expect(page.getByLabel('Срок приёма работ').locator('option:checked')).toHaveText('7 дней');
    await page.getByRole('button', { name: 'Далее', exact: true }).click();
    await page.getByLabel('Описание задания', { exact: true }).fill('Создай полезный мем о нашем запуске. Свой текст и понятная идея.');
    await page.getByLabel('Каким должен быть хороший результат?').fill('Оригинальная идея и понятный текст.');
    await page.getByRole('button', { name: 'Далее', exact: true }).click();
    await expect(page.getByLabel('Проверка задания')).toContainText('Русский автор · Мемы');
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const formBounds = await page.locator('.mission-form').boundingBox();
    for (const button of await page.locator('.wizard-actions button').all()) {
      const bounds = await button.boundingBox();
      expect(!!bounds && !!formBounds && bounds.x + bounds.width <= formBounds.x + formBounds.width).toBe(true);
    }
    await page.screenshot({ path: 'test-results/ru-create-mobile.png', fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Опубликовать и внести награды' }).click();
    await expect(page).toHaveURL(/\/mission\/\d+$/);
    const missionUrl = page.url(), id = Number(missionUrl.split('/').pop());
    await expect(page.getByRole('heading', { name: 'Creator choice', exact: true })).toBeVisible();
    const config = await (await request.get('/api/config')).json();
    const ledger = new Contract(config.contractAddress, JSON.parse(fs.readFileSync('shared/abi.json', 'utf8')), rpc);
    const metadata = JSON.parse((await ledger.missions(id)).metadata);
    expect(metadata.category).toBe('Memes');
    expect(metadata.title).toBe('Creator choice');
    active = 1;
    await page.evaluate(address => (window as any).switchLocaleWallet(address), wallets[1].address);
    await page.getByRole('link', { name: 'Я могу помочь' }).click();
    await page.getByLabel('Твоё имя', { exact: true }).fill('Участник');
    await page.getByLabel('Твоя работа', { exact: true }).fill('Самостоятельная идея мема для запуска. Понятная подпись и полезный смысл.');
    await page.getByLabel('Я понимаю эти правила выплат.').check();
    await page.getByRole('button', { name: 'Отправить работу', exact: true }).click();
    await expect(page).toHaveURL(missionUrl);
    active = 0;
    await page.evaluate(address => (window as any).switchLocaleWallet(address), wallets[0].address);
    await page.getByLabel('Я проверил(а) работу и авторство').check();
    await page.getByRole('button', { name: /Принять и выплатить/ }).click();
    await expect(page.locator('.payout-proof')).toContainText('выплачено в Monad');
    await page.goto(`/profile/${wallets[1].address}`);
    await expect(page.locator('.signal-badge strong')).toHaveText('15');
    await expect(page.locator('.history-row')).toContainText('Работа принята');
    for (const width of [320, 390, 768, 1100]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of ['/', '/create', missionUrl, `${missionUrl}/submit`, '/dashboard', `/profile/${wallets[1].address}`, '/activity']) {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
        await expect(page.locator('main')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path}, width ${width}`).toBe(true);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Открыть или закрыть меню' }).click();
    await page.locator('.mobile-nav').getByRole('link', { name: 'Задания', exact: true }).click();
    await page.getByRole('button', { name: 'Мемы', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Мемы', exact: true })).toHaveClass('active');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Memes', exact: true })).toHaveClass('active');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(errors).toEqual([]);
  } finally {
    await rpc.send('evm_revert', [snapshot]);
    await request.post('/api/refresh');
    rpc.destroy();
  }
});
