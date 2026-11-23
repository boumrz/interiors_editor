import { defineConfig, devices } from '@playwright/test';
import { returningWebUser } from './tests/browser/accepted-web-license.ts';

const baseURL = process.env.PLAYWRIGHT_PWA_BASE_URL ?? 'http://127.0.0.1:4175';
const usesExternalServer = process.env.PLAYWRIGHT_PWA_BASE_URL !== undefined;

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'pwa-e2e.spec.ts',
  // PWA scenarios mutate a worker, cache and persistent local project state.
  // They must not race each other through the shared origin while proving
  // recovery and offline behaviour.
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    storageState: returningWebUser(baseURL),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ru-RU',
    colorScheme: 'light'
  },
  projects: [
    {
      name: 'mobile-browser-emulation',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        channel: 'chrome'
      }
    }
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        command: 'npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 -c "pnpm run build && node scripts/serve-pwa-e2e.mjs"',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 30_000
      }
});
