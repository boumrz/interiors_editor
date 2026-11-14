import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/poc/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'phone-chrome',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        channel: 'chrome'
      }
    }
  ],
  webServer: {
    command: 'pnpm run dev',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
