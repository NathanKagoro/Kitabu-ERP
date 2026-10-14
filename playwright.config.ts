import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end flows run against a production build: the service worker and
 * offline behaviour only exist there. The viewport is the target phone.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3217',
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 740 },
    locale: 'sw-TZ',
    trace: 'retain-on-failure',
    // A system Chrome can stand in for Playwright's own download.
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [{ name: 'chromium-mobile', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run build && node scripts/serve-static.mjs 3217 out',
    url: 'http://localhost:3217/ingia/',
    timeout: 300_000,
    reuseExistingServer: false,
    // A Supabase address that does not exist: the tests intercept every call to
    // it, so the real client and sync code run with no backend.
    env: {
      NEXT_PUBLIC_DEV_OTP: '1',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
    },
  },
});
