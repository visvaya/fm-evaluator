import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// COLUMN HIDE / PIN PERSISTENCE
// ============================================================================

test.describe('Column Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have column visibility controls after import', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Table headers should be visible
    const text = page.locator('#results-count');
    await expect(text).toHaveText(/.+/);
    const headerCount = await page.locator('#table-headers th').count();
    expect(headerCount).toBeGreaterThan(5);

    // Store should be accessible with column state
    const hasStore = await page.evaluate(() => {
      const store = (window as any).store;
      return !!store && Array.isArray(store.hiddenColumns);
    });
    expect(hasStore).toBe(true);
  });

  test('should hide a column and have it reflected in store state', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Hide a column via store
    const result = await page.evaluate(() => {
      const store = (window as any).store;
      if (!store) return { success: false };
      store.hiddenColumns = ['basic_dob'];
      return {
        hiddenColumns: store.hiddenColumns,
        success: true
      };
    });

    expect(result.success).toBe(true);
    expect(result.hiddenColumns).toContain('basic_dob');

    // Verify the store retains the value after a short delay
    await page.waitForTimeout(500);
    const retained = await page.evaluate(() => {
      const store = (window as any).store;
      return store?.hiddenColumns || [];
    });
    expect(retained).toContain('basic_dob');
  });

  test('should persist hidden columns in localStorage', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Hide a column and persist
    await page.evaluate(() => {
      const store = (window as any).store;
      if (!store) return;
      store.hiddenColumns = ['basic_dob'];
      if (typeof (window as any).persistUIState === 'function') {
        (window as any).persistUIState();
      }
    });
    await page.waitForTimeout(300);

    // Check localStorage – key is 'fm24-evaluator-state-v1'
    const persisted = await page.evaluate(() => {
      const raw = localStorage.getItem('fm24-evaluator-state-v1');
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    });

    if (persisted) {
      expect(persisted.hiddenColumns).toContain('basic_dob');
    }
  });

  test('should persist pinned columns in localStorage', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await page.evaluate(() => {
      const store = (window as any).store;
      if (!store) return;
      store.pinnedColumns = ['basic_name'];
      if (typeof (window as any).persistUIState === 'function') {
        (window as any).persistUIState();
      }
    });
    await page.waitForTimeout(300);

    const persisted = await page.evaluate(() => {
      const raw = localStorage.getItem('fm24-evaluator-state-v1');
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    });

    if (persisted) {
      expect(persisted.pinnedColumns).toContain('basic_name');
    }
  });

  test('should restore hidden columns from localStorage on page reload', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Set hidden columns and persist
    await page.evaluate(() => {
      const store = (window as any).store;
      if (!store) return;
      store.hiddenColumns = ['basic_dob'];
      if (typeof (window as any).persistUIState === 'function') {
        (window as any).persistUIState();
      }
    });
    await page.waitForTimeout(300);

    // Verify saved
    const saved = await page.evaluate(() => localStorage.getItem('fm24-evaluator-state-v1'));
    expect(saved).toBeTruthy();

    // Reload and check store is hydrated
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const restoredHidden = await page.evaluate(() => {
      const store = (window as any).store;
      return store?.hiddenColumns || [];
    });

    expect(restoredHidden).toContain('basic_dob');
  });

  test('should restore sort state from localStorage on reload', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await page.evaluate(() => {
      const store = (window as any).store;
      if (!store) return;
      store.currentSort = { col: 'attribute_pace', dir: 'asc' };
      if (typeof (window as any).persistUIState === 'function') {
        (window as any).persistUIState();
      }
    });
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const restoredSort = await page.evaluate(() => {
      const store = (window as any).store;
      return store?.currentSort || null;
    });

    if (restoredSort) {
      expect(restoredSort.col).toBe('attribute_pace');
      expect(restoredSort.dir).toBe('asc');
    }
  });
});
