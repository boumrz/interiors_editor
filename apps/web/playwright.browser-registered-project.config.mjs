import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.BROWSER_REGISTERED_PROJECT_BASE_URL;
const outputDir = process.env.BROWSER_REGISTERED_PROJECT_OUTPUT_DIR;
if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1' || !outputDir) throw new Error('An isolated loopback URL and output directory are required');
export default defineConfig({ testDir: './tests/browser', testMatch: ['browser-registered-project-e2e.check.ts'], outputDir, workers: 1, timeout: 10000, metadata: { activeMutant: process.env.__STRYKER_ACTIVE_MUTANT__ ?? null }, use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'chrome', baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' } });
