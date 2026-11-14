import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_TMA_STORAGE_BASE_URL;
const outputDir = process.env.PLAYWRIGHT_TMA_STORAGE_OUTPUT_DIR;
if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1' || !outputDir) {
  throw new Error('Set isolated loopback PLAYWRIGHT_TMA_STORAGE_BASE_URL and PLAYWRIGHT_TMA_STORAGE_OUTPUT_DIR');
}

export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['telegram-storage-e2e.check.ts', 'telegram-project-e2e.check.ts', 'telegram-resources-e2e.check.ts', 'telegram-recovery-e2e.check.ts', 'telegram-library-repair-e2e.check.ts', 'telegram-atomicity-e2e.check.ts', 'scoped-public-admission-e2e.check.ts', 'scoped-composition-owner-e2e.check.ts'],
  outputDir,
  workers: 1,
  timeout: 10_000,
  metadata: { activeMutant: process.env.__STRYKER_ACTIVE_MUTANT__ ?? null },
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    channel: 'chrome',
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
