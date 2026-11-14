import { defineConfig, devices } from '@playwright/test';

// This gate takes two immutable build artifacts and its own isolated preview.
// It must never invoke the ordinary build or reuse the live phone preview.
const baseURL = process.env.PLAYWRIGHT_S1_UPGRADE_BASE_URL;
if (!baseURL || !process.env.INTERIORS_S1_VERIFY_ROOT) {
  throw new Error('Set PLAYWRIGHT_S1_UPGRADE_BASE_URL and INTERIORS_S1_VERIFY_ROOT for the isolated old-to-new release fixture');
}
if (new URL(baseURL).hostname !== '127.0.0.1') {
  throw new Error('The host upgrade fixture requires a loopback-only preview');
}

export default defineConfig({
  testDir: './tests/upgrade',
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    channel: 'chrome',
    baseURL,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
