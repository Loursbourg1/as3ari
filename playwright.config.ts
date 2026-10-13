import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 820 } } },
  ],
  // Builds the app and serves it with the production security headers from vercel.json.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && node scripts/serve-dist.mjs ${PORT}`,
        url: `http://localhost:${PORT}`,
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
      },
});
