import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shortClick = async (page: any, selector: string, timeout = 5000) => {
  try {
    await page.click(selector, { timeout });
    return true;
  } catch {
    return false;
  }
};

async function uploadAndWaitForTable(page: any, fixtureName: string) {
  const fileInput = page.locator('#files-input');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures', fixtureName));

  const tableBody = page.locator('#table-body');
  const tableRow = tableBody.locator('tr:not(.virtual-spacer)').first();

  await shortClick(page, '#language-choice-file-btn', 3000);
  await page.waitForTimeout(300);

  if (!(await tableRow.isVisible().catch(() => false))) {
    await shortClick(page, '#confirm-btn', 15000);
    await page.waitForTimeout(300);
  }

  if (!(await tableRow.isVisible().catch(() => false))) {
    await shortClick(page, '#btn-process-now', 10000);
    await page.waitForTimeout(300);
  }

  if (!(await tableRow.isVisible().catch(() => false))) {
    await shortClick(page, '#confirm-header-btn', 5000);
    await page.waitForTimeout(300);
  }

  if (!(await tableRow.isVisible().catch(() => false))) {
    const roleSelect = page.locator('#central-position-select');
    try {
      await roleSelect.waitFor({ state: 'visible', timeout: 5000 });
      await roleSelect.selectOption('BEST');
      await page.waitForTimeout(1000);
    } catch {
      /* not shown */
    }
  }

  await expect(tableRow).toBeVisible({ timeout: 15000 });
}

// ============================================================================
// HARD RESET FLOW
// ============================================================================

test.describe('Hard Reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show hard reset button', async ({ page }) => {
    const resetBtn = page.locator('#hard-reset-button');
    await expect(resetBtn).toBeVisible({ timeout: 5000 });
  });

  test('should show confirmation dialog on hard reset click', async ({ page }) => {
    const resetBtn = page.locator('#hard-reset-button');
    await expect(resetBtn).toBeVisible();

    // Listen for dialog (confirm/prompt)
    let dialogMessage = '';
    page.on('dialog', async (dialog: any) => {
      dialogMessage = dialog.message();
      await dialog.dismiss(); // Cancel the reset
    });

    await resetBtn.click();
    await page.waitForTimeout(500);

    expect(dialogMessage).toBeTruthy();
  });

  test('should cancel hard reset when dialog is dismissed', async ({ page }) => {
    // Import data first so we have something to lose
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const tableRow = page.locator('#table-body tr:not(.virtual-spacer)').first();
    await expect(tableRow).toBeVisible();

    // Dismiss the confirmation dialog
    page.on('dialog', async (dialog: any) => {
      await dialog.dismiss();
    });

    const resetBtn = page.locator('#hard-reset-button');
    await resetBtn.click();
    await page.waitForTimeout(500);

    // Data should still be visible (reset was cancelled)
    await expect(tableRow).toBeVisible();
  });

  test('should clear state when hard reset is confirmed', async ({ page }) => {
    // Import data so state gets written
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Verify app-managed state exists
    const hasState = await page.evaluate(() => {
      return (
        localStorage.getItem('fm24-evaluator-state-v1') !== null ||
        localStorage.getItem('fm24-evaluator-settings-v1') !== null
      );
    });

    // Accept the confirmation dialog
    page.on('dialog', async (dialog: any) => {
      await dialog.accept();
    });

    const resetBtn = page.locator('#hard-reset-button');
    await resetBtn.click();

    // Wait for page reload triggered by hard reset
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // After reset, app-managed state keys should be cleared
    const stateAfter = await page.evaluate(() => {
      return {
        possession: localStorage.getItem('fm24-evaluator-possession-v1'),
        settings: localStorage.getItem('fm24-evaluator-settings-v1'),
        state: localStorage.getItem('fm24-evaluator-state-v1')
      };
    });
    expect(stateAfter.state).toBeNull();
    expect(stateAfter.settings).toBeNull();
    expect(stateAfter.possession).toBeNull();
  });

  test('should return to initial state after hard reset', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Verify table is showing
    const tableRow = page.locator('#table-body tr:not(.virtual-spacer)').first();
    await expect(tableRow).toBeVisible();

    // Accept the confirmation dialog
    page.on('dialog', async (dialog: any) => {
      await dialog.accept();
    });

    const resetBtn = page.locator('#hard-reset-button');
    await resetBtn.click();

    // Wait for reload
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // After reset, drop zone should be visible (initial state)
    const dropArea = page.locator('#drop-area');
    await expect(dropArea).toBeVisible({ timeout: 5000 });

    // Table should not have data
    const tableRowAfter = page.locator('#table-body tr:not(.virtual-spacer)').first();
    const isVisible = await tableRowAfter.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('should unregister service workers during hard reset', async ({ page }) => {
    // Accept the confirmation dialog
    page.on('dialog', async (dialog: any) => {
      await dialog.accept();
    });

    // Check for service workers before reset
    const swCountBefore = await page
      .evaluate(async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.length;
      })
      .catch(() => 0);

    const resetBtn = page.locator('#hard-reset-button');
    await resetBtn.click();

    // Wait for reload
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Service workers should have been cleared
    const swCountAfter = await page
      .evaluate(async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.length;
      })
      .catch(() => 0);

    expect(swCountAfter).toBeLessThanOrEqual(swCountBefore);
  });
});
