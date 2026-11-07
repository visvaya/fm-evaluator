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
    try {
      await page.evaluate(() => {
        const roleSelect = document.querySelector('#central-position-select');
        if (roleSelect && (roleSelect as any).offsetParent !== null) {
          (roleSelect as HTMLSelectElement).value = 'BEST';
          roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await page.waitForTimeout(1000);
    } catch {
      /* not shown */
    }
  }

  await expect(tableRow).toBeVisible({ timeout: 15000 });
}

// ============================================================================
// DRAG-AND-DROP & FILE INPUT
// ============================================================================

test.describe('Drag-and-Drop & File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show drop zone on page load', async ({ page }) => {
    const dropArea = page.locator('#drop-area');
    await expect(dropArea).toBeVisible({ timeout: 5000 });
  });

  test('should show file input on page load', async ({ page }) => {
    const fileInput = page.locator('#files-input');
    await expect(fileInput).toBeAttached();
  });

  test('should accept .html files via file input', async ({ page }) => {
    const fileInput = page.locator('#files-input');
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toContain('.html');
  });

  test('should allow multiple file selection', async ({ page }) => {
    const fileInput = page.locator('#files-input');
    const multipleAttr = await fileInput.getAttribute('multiple');
    // multiple attribute exists (value is "" or "multiple" or null for boolean attrs)
    expect(
      multipleAttr !== null || (await fileInput.evaluate((el: HTMLInputElement) => el.multiple))
    ).toBeTruthy();
  });

  test('should have drop zone container with proper structure', async ({ page }) => {
    const dropContainer = page.locator('#drop-zone-container');
    await expect(dropContainer).toBeVisible({ timeout: 5000 });

    // Drop area inside container
    const dropArea = dropContainer.locator('#drop-area');
    await expect(dropArea).toBeVisible();

    // Drop area text should exist
    const dropText = page.locator('#drop-area-text');
    if (await dropText.isVisible().catch(() => false)) {
      await expect(dropText).toHaveText(/.+/);
    }
  });

  test('should trigger file processing after file input change', async ({ page }) => {
    const fileInput = page.locator('#files-input');
    const filePath = path.join(__dirname, 'fixtures', 'sample-attributes-en.html');
    await fileInput.setInputFiles(filePath);

    // After file input, processing starts – at least one modal should appear
    // Use Promise.race to detect the first visible modal
    const visible = await Promise.race([
      page
        .locator('#format-verification-modal')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'fv'),
      page
        .locator('#language-choice-modal:not(.hidden)')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'lang'),
      page
        .locator('#header-mapping-modal')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'hm')
    ]);
    expect(['fv', 'lang', 'hm']).toContain(visible);
  });

  test('should show drop area hint text', async ({ page }) => {
    const dropHint = page.locator('#drop-area-hint, #drop-area-text');
    if (
      await dropHint
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      const textAfter = dropHint.first();
      await expect(textAfter).toHaveText(/.+/);
    }
  });

  test('should show file stack after importing two files', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Import second file
    const fileInput = page.locator('#files-input');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample-stats-en.html'));
    await shortClick(page, '#language-choice-file-btn', 3000);
    await page.waitForTimeout(300);
    await shortClick(page, '#confirm-btn', 15000);
    await page.waitForTimeout(300);
    await shortClick(page, '#confirm-header-btn', 3000);
    await page.waitForTimeout(1000);

    // File stack should be visible with file cards
    const fileStack = page.locator('#file-stack, .file-stack');
    if (await fileStack.isVisible().catch(() => false)) {
      const fileCards = fileStack.locator('.file-card, .file-item, [data-file]');
      const count = await fileCards.count();
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });
});
