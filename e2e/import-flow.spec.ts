import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the application', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#drop-area')).toBeVisible();
  });

  test('should show language choice modal on first visit', async ({ page }) => {
    const modal = page.locator('#language-choice-modal');
    // Modal may or may not be visible depending on localStorage state
    // Just verify the element exists
    await expect(modal).toBeAttached();
  });

  test('should upload HTML file and show mapping interface', async ({ page }) => {
    const fileInput = page.locator('#files-input');

    // Upload sample file
    const filePath = path.join(__dirname, 'fixtures', 'sample-attributes-pl.html');
    await fileInput.setInputFiles(filePath);

    // Wait for either status update or mapping modal (processing result)
    const statusText = page.locator('#upload-status-text');
    const mappingModal = page.locator('#header-mapping-modal');

    await expect(statusText.or(mappingModal)).toBeVisible({ timeout: 10000 });
  });

  test('should detect duplicate file by name', async ({ page }) => {
    const fileInput = page.locator('#files-input');
    const filePath = path.join(__dirname, 'fixtures', 'sample-attributes-pl.html');

    // Upload first time – wait for processing to finish
    await fileInput.setInputFiles(filePath);
    const statusText = page.locator('#upload-status-text');
    const mappingModal = page.locator('#header-mapping-modal');
    await expect(statusText.or(mappingModal)).toBeVisible({ timeout: 10000 });

    // Try to upload same file again
    await fileInput.setInputFiles(filePath);

    // Error log must show duplicate message
    const errorLog = page.locator('#error-log');
    await expect(errorLog).toBeVisible({ timeout: 5000 });

    const errorContent = errorLog.locator('.error-log-content');
    await expect(errorContent).toContainText('duplikat', { timeout: 3000 });
  });

  // Known app timing bug: the banner shows "no profile data" until the diagnostics
  // runtime sets profileReport, which happens only after i18n.init() in bootRuntime().
  // Fix either side: render the banner once profileReport is set, or wait here for a
  // non-empty [data-profile].
  test.fixme('should show profile banner based on COOP/COEP', async ({ page }) => {
    const profileBanner = page.locator('#profile-banner');
    await expect(profileBanner).toBeAttached();

    const isolated = await page.evaluate(() => window.crossOriginIsolated);

    // Dev server sends COOP/COEP headers → should be isolated
    // Banner text should reflect the detected profile
    const bannerText = await profileBanner.textContent();
    if (isolated) {
      // Full profile – banner may be hidden or show FULL
      expect(bannerText?.toLowerCase() || '').toMatch(/full|pełny|ukryj/i);
    } else {
      // TS-only – banner must be visible and indicate degraded profile
      await expect(profileBanner).toBeVisible();
      expect(bannerText?.toLowerCase() || '').toMatch(/ts-only|ograniczony/i);
    }
  });

  test('should have working diagnostics panel', async ({ page }) => {
    const diagnosticsToggle = page.locator('#toggle-diagnostics-panel');
    await expect(diagnosticsToggle).toBeAttached({ timeout: 5000 });
    await expect(diagnosticsToggle).toBeVisible();

    await diagnosticsToggle.click();

    // Check for SW status and DB health inside the panel
    const swStatus = page.locator('#sw-diagnostics');
    await expect(swStatus).toBeAttached({ timeout: 3000 });

    const dbHealth = page.locator('#db-health-version');
    await expect(dbHealth).toBeAttached({ timeout: 3000 });
  });
});

test.describe('Fast Upload Bootstrap Race', () => {
  test('does not throw "window.computeStructureHash is not a function" on a fast upload right after navigation', async ({
    page
  }) => {
    // Regression guard: computeStructureHash used to live only on
    // window.computeStructureHash, set by the async runtime bootstrap
    // (dynamically imported after the upload UI is already interactive).
    // Uploading immediately after navigation - no networkidle wait, unlike
    // every other test in this file - reproduces that race if reintroduced.
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        pageErrors.push(message.text());
      }
    });

    await page.goto('/');

    const fileInput = page.locator('#files-input');
    const filePath = path.join(__dirname, 'fixtures', 'sample-attributes-pl.html');
    await fileInput.setInputFiles(filePath);

    const statusText = page.locator('#upload-status-text');
    const mappingModal = page.locator('#header-mapping-modal');
    await expect(statusText.or(mappingModal)).toBeVisible({ timeout: 10000 });

    const structureHashErrors = pageErrors.filter((message) =>
      message.includes('computeStructureHash')
    );
    expect(structureHashErrors).toEqual([]);
  });
});

test.describe('Parser Worker', () => {
  test('should initialize parser worker when cross-origin isolated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const isolated = await page.evaluate(() => window.crossOriginIsolated);

    if (!isolated) {
      // TS-only profile – parser bridge won't exist, skip gracefully
      test.skip();
      return;
    }

    // Wait for runtime to expose parserBridge
    await page.waitForFunction(() => (window as any).parserBridge !== undefined, {
      timeout: 5000
    });

    const hasParserBridge = await page.evaluate(() => {
      const bridge = (window as any).parserBridge;
      return bridge !== undefined && bridge?.getState?.() === 'idle';
    });

    expect(hasParserBridge).toBe(true);
  });
});

test.describe('Security Headers', () => {
  test('should have security headers set', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    // Check for COOP/COEP headers (set by Vite dev server)
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
  });

  test('should not log SRI errors in console (dev server)', async ({ page }) => {
    const sriErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (
        text.includes("Failed to find a valid digest in the 'integrity' attribute") ||
        text.toLowerCase().includes('integrity')
      ) {
        sriErrors.push(text);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // If SRI mismatches exist, Chromium will emit console errors.
    // We want 0 of them.
    expect(sriErrors).toEqual([]);
  });
});
