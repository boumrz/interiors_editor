import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.PREFS_BASE_URL;
const outputDir = process.env.PREFS_OUTPUT_DIR;
if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1' || !outputDir) throw new Error('Isolated preference verification URL/output required');
export default defineConfig({
  testDir: './tests/browser', testMatch: 'drawing-preferences-e2e.check.ts', workers: 1, timeout: 20_000, outputDir,
  use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'chrome', baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'pnpm --config.verifyDepsBeforeRun=false exec rspack serve --mode development --config rspack.drawing-preferences-test.config.mjs', url: baseURL, reuseExistingServer: false, timeout: 30_000 }
});
