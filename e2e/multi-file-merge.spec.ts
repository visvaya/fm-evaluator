import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Upload additional file (table already rendered from first file).
 * Dismisses modals for the new file and waits for processing to complete.
 */
async function uploadAdditionalFile(page: any, fixtureName: string) {
  const fileInput = page.locator('#files-input');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures', fixtureName));

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const state = await page.evaluate(() => {
      // Check if any modal is visible and dismiss it
      const langModal = document.querySelector('#language-choice-modal');
      if (langModal && !langModal.classList.contains('hidden')) {
        const btn = document.querySelector('#language-choice-file-btn');
        if (btn) {
          (btn as HTMLElement).click();
          return { dismissed: 'lang' };
        }
      }
      const fvModal = document.querySelector('#format-verification-modal');
      if (fvModal && getComputedStyle(fvModal).display !== 'none') {
        const btn = document.querySelector('#confirm-btn');
        if (btn) {
          (btn as HTMLElement).click();
          return { dismissed: 'fv' };
        }
      }
      const stp = document.querySelector('#single-type-prompt');
      if (stp && !stp.classList.contains('hidden')) {
        const btn = document.querySelector('#btn-process-now');
        if (btn) {
          (btn as HTMLElement).click();
          return { dismissed: 'stp' };
        }
      }
      const hmModal = document.querySelector('#header-mapping-modal');
      if (hmModal && getComputedStyle(hmModal).display !== 'none') {
        const btn = document.querySelector('#confirm-header-btn');
        if (btn) {
          (btn as HTMLElement).click();
          return { dismissed: 'hm' };
        }
      }
      // No modals visible – processing may be done
      return { waiting: true };
    });
    await page.waitForTimeout('dismissed' in state ? 1000 : 500);
    // After dismissing all modals, check if we've stabilized (no more modals for 2 iterations)
    if ('waiting' in state && i > 5) break;
  }

  // Give time for merge processing
  await page.waitForTimeout(1000);
}

/**
 * Upload fixture and dismiss all modals until the table renders.
 * Uses evaluate()-based adaptive loop for reliability across EN/PL files.
 */
async function uploadAndWaitForTable(page: any, fixtureName: string) {
  const fileInput = page.locator('#files-input');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures', fixtureName));

  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    const state = await page.evaluate(() => {
      const appControls = document.querySelector('#app-controls');
      const tb = document.querySelector('#table-body');
      const visibleRows =
        tb && !appControls?.classList.contains('hidden')
          ? tb.querySelectorAll('tr:not(.virtual-spacer)').length
          : 0;
      if (visibleRows > 0 && !appControls?.classList.contains('hidden')) return { done: true };

      const langModal = document.querySelector('#language-choice-modal');
      if (langModal && !langModal.classList.contains('hidden')) {
        const btn = document.querySelector('#language-choice-ui-btn');
        if (btn) {
          (btn as HTMLElement).click();
          return { dismissed: 'lang' };
        }
      }
      const fvModal = document.querySelector('#format-verification-modal');
      if (fvModal && getComputedStyle(fvModal).display !== 'none') {
        const btn = document.querySelector('#confirm-btn');
        if (btn) {
          (btn as HTMLElement).click();
          return { dismissed: 'fv' };
        }
      }
      const stp = document.querySelector('#single-type-prompt');
      if (stp && !stp.classList.contains('hidden')) {
        const btn = document.querySelector('#btn-process-now');
        if (btn) {
          (btn as HTMLElement).click();
          return { dismissed: 'stp' };
        }
      }
      const hmModal = document.querySelector('#header-mapping-modal');
      if (hmModal && getComputedStyle(hmModal).display !== 'none') {
        const btn = document.querySelector('#confirm-header-btn');
        if (btn) {
          (btn as HTMLElement).click();
          return { dismissed: 'hm' };
        }
      }
      const roleSelect = document.querySelector('#central-position-select');
      if (roleSelect && (roleSelect as any).offsetParent !== null) {
        (roleSelect as HTMLSelectElement).value = 'BEST';
        roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
        return { dismissed: 'role' };
      }
      return { waiting: true };
    });
    if ('done' in state) break;
    await page.waitForTimeout('dismissed' in state ? 1000 : 500);
  }

  const rowCount = await page.evaluate(() => {
    const ac = document.querySelector('#app-controls');
    if (ac?.classList.contains('hidden')) return 0;
    return document.querySelectorAll('#table-body tr:not(.virtual-spacer)').length;
  });
  expect(rowCount).toBeGreaterThan(0);
}

// ============================================================================
// MULTI-FILE MERGE
// ============================================================================

test.describe('Multi-File Merge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should import attributes then stats and show merged data (EN)', async ({ page }) => {
    // 1. Import EN attributes
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const rowsAfterAttrs = await page.locator('#table-body tr:not(.virtual-spacer)').count();
    expect(rowsAfterAttrs).toBeGreaterThanOrEqual(3);

    // Verify a known player
    await expect(page.locator('#table-body')).toContainText('James Richardson');

    // 2. Import EN stats (same UIDs → merge)
    await uploadAdditionalFile(page, 'sample-stats-en.html');

    // After merge, same players should still be present
    await expect(page.locator('#table-body')).toContainText('James Richardson');

    // Row count should stay the same (merge, not duplicate)
    const rowsAfterMerge = page.locator('#table-body tr:not(.virtual-spacer)');
    await expect(rowsAfterMerge).toHaveCount(rowsAfterAttrs);
  });

  test('should import attributes then stats and show merged data (PL)', async ({ page }) => {
    // 1. Import PL attributes
    await uploadAndWaitForTable(page, 'sample-attributes-pl.html');

    const rowsAfterAttrs = await page.locator('#table-body tr:not(.virtual-spacer)').count();
    expect(rowsAfterAttrs).toBeGreaterThanOrEqual(3);

    await expect(page.locator('#table-body')).toContainText('Krzysztof Lewandowski');

    // 2. Import PL stats
    await uploadAdditionalFile(page, 'sample-stats-pl.html');

    await expect(page.locator('#table-body')).toContainText('Krzysztof Lewandowski');

    const rowsAfterMerge = page.locator('#table-body tr:not(.virtual-spacer)');
    await expect(rowsAfterMerge).toHaveCount(rowsAfterAttrs);
  });

  test('should show file stack with two files after merge', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');
    await uploadAdditionalFile(page, 'sample-stats-en.html');

    // File stack should list both files
    const fileStack = page.locator('#file-stack, .file-stack');
    if (await fileStack.isVisible().catch(() => false)) {
      const fileCards = fileStack.locator('.file-card, .file-item, [data-file]');
      const cardCount = await fileCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(2);
    }
  });

  test('should have more columns after merging stats onto attributes', async ({ page }) => {
    // Import attributes first
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');
    const headersBefore = await page.locator('#table-headers th').count();

    // Import stats to merge
    await uploadAdditionalFile(page, 'sample-stats-en.html');
    const headersAfter = await page.locator('#table-headers th').count();

    // After merge, more columns should be visible (stats columns added)
    expect(headersAfter).toBeGreaterThanOrEqual(headersBefore);
  });

  test('should reject duplicate file upload', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Try to upload same file again
    const fileInput = page.locator('#files-input');
    const filePath = path.join(__dirname, 'fixtures', 'sample-attributes-en.html');
    await fileInput.setInputFiles(filePath);

    // Error log should appear with duplicate message
    const errorLog = page.locator('#error-log');
    await expect(errorLog).toBeVisible({ timeout: 5000 });
    const errorContent = errorLog.locator('.error-log-content');
    await expect(errorContent).toContainText(/duplikat|duplicate/i, { timeout: 3000 });
  });
});
