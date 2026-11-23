import { defineConfig, devices } from '@playwright/test';
import { returningWebUser } from './tests/browser/accepted-web-license.ts';

// Keep the ordinary browser suite isolated from a developer's default 4173
// server. Otherwise `reuseExistingServer` can silently run this app's tests
// against an unrelated shell, including one with no release manifest.
const defaultDevServerPort = 48173;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${defaultDevServerPort}`;
const usesExternalServer = process.env.PLAYWRIGHT_BASE_URL !== undefined;
const hostResolverRules = process.env.PLAYWRIGHT_HOST_RESOLVER_RULES;

export default defineConfig({
  testDir: './tests/browser',
  // PWA assertions require the production bundle and a real service worker.
  // They run under playwright.pwa.config.mjs, including when a separate
  // development server is supplied for the ordinary editor suite.
  testIgnore: '**/pwa-e2e.spec.ts',
  fullyParallel: true,
  // The suite drives real long-press, pinch and SVG hit-target interactions
  // against one local development server. Serial execution keeps those mobile
  // timing assertions deterministic instead of letting parallel browser load
  // masquerade as a product failure.
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
        channel: 'chrome',
        launchOptions: hostResolverRules
          ? { args: [`--host-resolver-rules=${hostResolverRules}`] }
          : undefined
      }
    }
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        command: `INTERIORS_DEV_SERVER_PORT=${defaultDevServerPort} pnpm run dev`,
        url: `http://127.0.0.1:${defaultDevServerPort}`,
        reuseExistingServer: false,
        timeout: 30_000
      }
});
