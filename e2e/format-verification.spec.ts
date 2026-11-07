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

/**
 * Upload fixture and go through full modal sequence until table renders.
 */
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

/**
 * Upload fixture and wait until the format verification modal appears.
 */
async function uploadUntilFormatModal(page: any, fixtureName: string) {
  const fileInput = page.locator('#files-input');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures', fixtureName));

  // Dismiss language choice if it appears first
  await shortClick(page, '#language-choice-file-btn', 3000);
  await page.waitForTimeout(300);

  // Wait for the format verification modal
  const fvModal = page.locator('#format-verification-modal');
  await expect(fvModal).toBeVisible({ timeout: 15000 });
  return fvModal;
}

// ============================================================================
// FORMAT VERIFICATION MODAL
// ============================================================================

test.describe('Format Verification Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show format verification modal after file upload', async ({ page }) => {
    const fvModal = await uploadUntilFormatModal(page, 'sample-attributes-en.html');
    await expect(fvModal).toBeVisible();
  });

  test('should have decimal separator select', async ({ page }) => {
    await uploadUntilFormatModal(page, 'sample-attributes-en.html');

    const decimalSep = page.locator('#decimal-separator');
    await expect(decimalSep).toBeVisible();

    const options = await decimalSep.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  test('should have thousand separator select', async ({ page }) => {
    await uploadUntilFormatModal(page, 'sample-attributes-en.html');

    const thousandSep = page.locator('#thousand-separator');
    await expect(thousandSep).toBeVisible();

    const options = await thousandSep.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  test('should have date format select', async ({ page }) => {
    await uploadUntilFormatModal(page, 'sample-attributes-en.html');

    const dateFormat = page.locator('#date-format');
    await expect(dateFormat).toBeVisible();

    const options = await dateFormat.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  test('should have confirm button', async ({ page }) => {
    await uploadUntilFormatModal(page, 'sample-attributes-en.html');

    const confirmBtn = page.locator('#confirm-btn');
    await expect(confirmBtn).toBeVisible();
    const text = confirmBtn;
    await expect(text).toHaveText(/.+/);
  });

  test('should have cancel button', async ({ page }) => {
    await uploadUntilFormatModal(page, 'sample-attributes-en.html');

    const cancelBtn = page.locator('#cancel-btn');
    await expect(cancelBtn).toBeVisible();
  });

  test('should close modal and proceed on confirm', async ({ page }) => {
    await uploadUntilFormatModal(page, 'sample-attributes-en.html');

    await page.click('#confirm-btn');
    await page.waitForTimeout(500);

    const fvModal = page.locator('#format-verification-modal');
    await expect(fvModal).not.toBeVisible({ timeout: 5000 });
  });

  test('should close modal on cancel', async ({ page }) => {
    await uploadUntilFormatModal(page, 'sample-attributes-en.html');

    await page.click('#cancel-btn');
    await page.waitForTimeout(500);

    const fvModal = page.locator('#format-verification-modal');
    await expect(fvModal).not.toBeVisible({ timeout: 5000 });
  });

  test('should allow changing decimal separator before confirm', async ({ page }) => {
    await uploadUntilFormatModal(page, 'sample-attributes-en.html');

    const decimalSep = page.locator('#decimal-separator');
    const initialValue = await decimalSep.inputValue();

    // Select a different separator
    const options = await decimalSep
      .locator('option')
      .evaluateAll((opts: HTMLOptionElement[]) => opts.map((o) => o.value));
    const otherValue = options.find((v: string) => v !== initialValue);
    if (otherValue) {
      await decimalSep.selectOption(otherValue);
      const newValue = decimalSep;
      await expect(newValue).toHaveValue(otherValue);
    }
  });

  test('should proceed to table after confirm with default settings', async ({ page }) => {
    // Full flow: upload → FV modal → confirm → should eventually reach table
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const rows = page.locator('#table-body tr:not(.virtual-spacer)');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
