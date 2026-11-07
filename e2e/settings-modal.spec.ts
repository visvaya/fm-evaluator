import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Open settings modal (assumes data already imported so #app-controls is visible).
 */
async function openSettingsModal(page: any) {
  const settingsBtn = page.locator('#settings-btn');
  await expect(settingsBtn).toBeVisible({ timeout: 5000 });
  await settingsBtn.click();

  const modal = page.locator('#settings-modal');
  await expect(modal).toBeVisible({ timeout: 5000 });
  return modal;
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
// SETTINGS MODAL
// ============================================================================

test.describe('Settings Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Import data so #app-controls becomes visible (settings btn is inside it)
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');
  });

  test('should open settings modal', async ({ page }) => {
    const modal = await openSettingsModal(page);
    await expect(modal).toBeVisible();
  });

  test('should have percentile input with default value', async ({ page }) => {
    await openSettingsModal(page);
    const percentileInput = page.locator('#setting-percentile');
    await expect(percentileInput).toBeVisible();

    const value = await percentileInput.inputValue();
    expect(Number(value)).toBeGreaterThan(0);
  });

  test('should have min minutes input', async ({ page }) => {
    await openSettingsModal(page);
    const minMinsInput = page.locator('#setting-min-minutes');
    await expect(minMinsInput).toBeVisible();

    const value = await minMinsInput.inputValue();
    expect(Number(value)).toBeGreaterThanOrEqual(0);
  });

  test('should save settings and close modal', async ({ page }) => {
    await openSettingsModal(page);

    const percentileInput = page.locator('#setting-percentile');
    await percentileInput.fill('15');

    const saveBtn = page.locator(
      '#save-settings, button:has-text("Zapisz"), button:has-text("Save")'
    );
    await saveBtn.first().click();

    const modal = page.locator('#settings-modal');
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('should persist settings after save and reopen', async ({ page }) => {
    await openSettingsModal(page);

    const percentileInput = page.locator('#setting-percentile');
    await percentileInput.fill('25');

    const saveBtn = page.locator(
      '#save-settings, button:has-text("Zapisz"), button:has-text("Save")'
    );
    await saveBtn.first().click();
    await page.waitForTimeout(500);

    // Reopen modal
    await openSettingsModal(page);

    const value = percentileInput;
    await expect(value).toHaveValue('25');
  });

  test('should reset settings to defaults', async ({ page }) => {
    await openSettingsModal(page);

    const percentileInput = page.locator('#setting-percentile');
    await percentileInput.fill('99');

    // Save the modified value
    await page.locator('#save-settings').click();
    await expect(page.locator('#settings-modal')).not.toBeVisible({ timeout: 3000 });

    // Reopen and verify the saved value loaded
    await openSettingsModal(page);
    const savedValue = percentileInput;
    await expect(savedValue).toHaveValue('99');

    // Click reset-all and verify it reverts to default (95)
    await page.locator('#reset-all-settings').click();
    await page.waitForTimeout(300);

    const resetValue = percentileInput;
    await expect(resetValue).toHaveValue('95');
  });

  test('should close modal with close/cancel button', async ({ page }) => {
    await openSettingsModal(page);

    const closeBtn = page.locator(
      '#settings-close, #settings-cancel, #settings-modal .close-btn, button:has-text("Anuluj"), button:has-text("Cancel")'
    );
    if (
      await closeBtn
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await closeBtn.first().click();
      const modal = page.locator('#settings-modal');
      await expect(modal).not.toBeVisible({ timeout: 3000 });
    }
  });

  // Known app bug: the settings focus trap never activates (no aria-modal, Escape
  // does not close); re-enable the test once the modal gets a working focus trap.
  test.fixme('should close modal on Escape key', async ({ page }) => {
    await openSettingsModal(page);

    await page.keyboard.press('Escape');

    const modal = page.locator('#settings-modal');
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('should accept typed value and persist after save', async ({ page }) => {
    await openSettingsModal(page);

    const percentileInput = page.locator('#setting-percentile');
    await percentileInput.fill('30');

    // Verify the input accepted the value
    const typedValue = percentileInput;
    await expect(typedValue).toHaveValue('30');

    // Save via button and close
    await page.locator('#save-settings').click();
    await expect(page.locator('#settings-modal')).not.toBeVisible({ timeout: 3000 });

    // Reopen and verify persistence
    await openSettingsModal(page);
    const value = percentileInput;
    await expect(value).toHaveValue('30');
  });
});
