import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', timeout: 90000, expect: { timeout: 20000 }, workers: 1, use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' }, reporter: 'list' });
