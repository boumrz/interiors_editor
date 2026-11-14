import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.TMA_READONLY_BASE_URL, outputDir = process.env.TMA_READONLY_RESULTS;
if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1' || !outputDir) throw new Error('Owned readonly loopback proof environment is required');
export default defineConfig({ testDir: './tests/browser', testMatch: 'telegram-readonly-source-e2e.check.ts', workers: 1, timeout: 15_000, outputDir, reporter: [['list'], ['json', { outputFile: process.env.TMA_READONLY_REPORT }]], use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'chrome', baseURL, actionTimeout: 5_000, trace: 'retain-on-failure', screenshot: 'only-on-failure' } });
