import { defineConfig, devices } from '@playwright/test';

// One typed read of the environment (this config gets no Node types).
const env: Record<string, string | undefined> = process.env;
const { CI, PLAYWRIGHT_BASE_URL, README_SCREENSHOTS } = env;
const baseURL = PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const useExternalServer = PLAYWRIGHT_BASE_URL !== undefined;

export default defineConfig({
  testDir: './e2e',
  // The README screenshot writer runs only through `pnpm run screenshots:readme`.
  testIgnore: README_SCREENSHOTS ? [] : ['**/readme-screenshots.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!CI,
  retries: CI ? 2 : 0,
  // One worker per core of the 2-vCPU CI runner; one locally (weak laptop).
  workers: CI ? 2 : 1,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30000,
    actionTimeout: 15000,
    serviceWorkers: 'block'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: useExternalServer
    ? undefined
    : {
        command: 'pnpm exec vite --port 5173 --strictPort',
        url: baseURL,
        // A server already on the port may be another project's app: fail instead of testing it.
        reuseExistingServer: false,
        timeout: 120000
      }
});
