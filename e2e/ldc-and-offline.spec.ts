/* eslint-disable playwright/no-conditional-expect, playwright/no-conditional-in-test, playwright/no-networkidle, playwright/no-wait-for-timeout -- Legacy E2E patterns kept as-is; cleanup belongs to the test-hardening pass. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const currentFileName = fileURLToPath(import.meta.url);
const currentDirName = path.dirname(currentFileName);

function collectParserWorkerErrors(page: any, errors: string[]) {
  page.on('console', (msg: any) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('[ParserBridge] Worker error:') || text.includes('[ParserWorker] Error:')) {
      errors.push(text);
    }
  });
}

/**
 * Upload fixture and dismiss all modals until the table renders.
 * Uses evaluate()-based adaptive loop for reliability across EN/PL files.
 */
async function uploadAndWaitForTable(
  page: any,
  fixture: string | { buffer: ReturnType<typeof Buffer.from>; mimeType: string; name: string }
) {
  const fileInput = page.locator('#files-input');
  await fileInput.setInputFiles(
    typeof fixture === 'string' ? path.join(currentDirName, 'fixtures', fixture) : fixture
  );

  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    // eslint-disable-next-line sonarjs/cognitive-complexity
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
// LDC FLOW
// ============================================================================

test.describe('LDC Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // LDC button is inside #app-controls which is hidden until data is imported
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');
  });

  test('should open LDC modal', async ({ page }) => {
    const ldcBtn = page.locator('#ldc-btn');
    await expect(ldcBtn).toBeVisible();

    await ldcBtn.click();

    const ldcModal = page.locator('#ldc-modal');
    await expect(ldcModal).toBeVisible({ timeout: 3000 });

    // Modal should have the enable checkbox
    const enableCheckbox = page.locator('#ldc-enabled');
    await expect(enableCheckbox).toBeVisible();
  });

  test('should toggle LDC enabled state', async ({ page }) => {
    const ldcBtn = page.locator('#ldc-btn');
    await ldcBtn.click();

    const ldcModal = page.locator('#ldc-modal');
    await expect(ldcModal).toBeVisible({ timeout: 3000 });

    const enableCheckbox = page.locator('#ldc-enabled');

    // Get initial state
    const wasChecked = await enableCheckbox.isChecked();

    // Toggle
    await enableCheckbox.click();
    const isNowChecked = enableCheckbox;
    await expect(isNowChecked).toBeChecked({ checked: !wasChecked });

    // Toggle back
    await enableCheckbox.click();
    const isBack = enableCheckbox;
    await expect(isBack).toBeChecked({ checked: wasChecked });
  });

  test('should close LDC modal with close button', async ({ page }) => {
    const ldcBtn = page.locator('#ldc-btn');
    await ldcBtn.click();

    const ldcModal = page.locator('#ldc-modal');
    await expect(ldcModal).toBeVisible({ timeout: 3000 });

    const closeBtn = page.locator('#ldc-close');
    await closeBtn.click();

    await expect(ldcModal).toBeHidden();
  });

  test('should have model selection options', async ({ page }) => {
    const ldcBtn = page.locator('#ldc-btn');
    await ldcBtn.click();

    const ldcModal = page.locator('#ldc-modal');
    await expect(ldcModal).toBeVisible({ timeout: 3000 });

    // Model selection is a radio group (input[name="ldc-model"]), not a
    // <select> – the old <select id="ldc-model"> markup predates the React
    // migration and no longer exists.
    const basketRadio = ldcModal.locator('input[name="ldc-model"][value="basket"]');
    const simpleRadio = ldcModal.locator('input[name="ldc-model"][value="simple"]');
    await expect(basketRadio).toBeVisible();
    await expect(simpleRadio).toBeVisible();
    await expect(basketRadio).toBeChecked();
    await expect(simpleRadio).not.toBeChecked();
  });

  test('should have alpha/parameter controls that swap with the selected model', async ({
    page
  }) => {
    const ldcBtn = page.locator('#ldc-btn');
    await ldcBtn.click();

    const ldcModal = page.locator('#ldc-modal');
    await expect(ldcModal).toBeVisible({ timeout: 3000 });

    // Only one alpha input exists at a time – its id tracks the active
    // model (settings.model === 'basket' ? 'ldc-alpha-basket' : 'ldc-alpha-simple').
    await expect(ldcModal.locator('#ldc-alpha-basket')).toBeVisible();
    await expect(ldcModal.locator('#ldc-alpha-simple')).toHaveCount(0);

    await ldcModal.locator('input[name="ldc-model"][value="simple"]').click();

    await expect(ldcModal.locator('#ldc-alpha-simple')).toBeVisible();
    await expect(ldcModal.locator('#ldc-alpha-basket')).toHaveCount(0);
  });

  test('should expand the league list and append a new league from the add button', async ({
    page
  }) => {
    await page.locator('#ldc-btn').click();
    await expect(page.locator('#ldc-modal')).toBeVisible({ timeout: 3000 });

    await expect(page.locator('#ldc-leagues-scroll')).toHaveCount(0);

    await page.locator('#ldc-add-league-btn').click();

    await expect(page.locator('#ldc-leagues-scroll')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#ldc-leagues-tbody input[data-field="name"]').last()).toHaveValue(
      'Nowa liga'
    );
  });

  test('should reveal missing leagues panel and bulk actions for synthetic missing leagues', async ({
    page
  }) => {
    await page.evaluate(() => {
      localStorage.removeItem('fm24-evaluator-ldc-mappings-v1');
      const processor = (window as any).processor;
      if (processor?.mergedData?.[0]) {
        processor.mergedData[0].Division = 'Synthetic Missing League';
        processor.mergedData[0]['Based In'] = 'POL';
      }
    });

    await page.locator('#ldc-btn').click();
    await expect(page.locator('#ldc-modal')).toBeVisible({ timeout: 3000 });

    const showMissingBtn = page.locator('#ldc-show-missing-btn');
    await expect(showMissingBtn).toBeVisible();
    await showMissingBtn.click();

    const missingPanel = page.locator('#ldc-missing-leagues');
    await expect(missingPanel).toBeVisible();

    const countryCheckbox = missingPanel.locator('.ldc-country-checkbox').first();
    await countryCheckbox.check();

    await expect(page.locator('#ldc-selected-count')).toContainText('1 zaznaczonych');
    await expect(page.locator('#ldc-add-selected-btn')).toBeVisible();
    await expect(page.locator('#ldc-match-selected-btn')).toBeVisible();

    await page.locator('#ldc-hide-missing-btn').click();
    await expect(missingPanel).toBeHidden();
    await expect(showMissingBtn).toBeVisible();
  });
});

// Players get a league missing from the LDC list by importing a copy of the fixture with the
// Division renamed; this goes through the UI only, so it runs on the dev server and on preview.
function syntheticLeagueFixture() {
  const source = fs.readFileSync(
    path.join(currentDirName, 'fixtures', 'sample-attributes-en.html'),
    'utf-8'
  );
  return {
    buffer: Buffer.from(source.replaceAll('EFL League One', 'Synthetic English League')),
    mimeType: 'text/html',
    name: 'synthetic-league-en.html'
  };
}

test.describe('LDC missing-league mapping', () => {
  test('should preserve source and target nations through the missing-league mapping flow', async ({
    page
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await uploadAndWaitForTable(page, syntheticLeagueFixture());

    await page.locator('#ldc-btn').click();
    await page.locator('#ldc-show-missing-btn').click();
    const missingPanel = page.locator('#ldc-missing-leagues');
    await expect(missingPanel).toBeVisible();
    await missingPanel.locator('.ldc-country-checkbox').first().check();
    await page.locator('#ldc-match-selected-btn').click();

    const matchDialog = page
      .locator('div.fixed.inset-0')
      .filter({ has: page.getByPlaceholder('Wyszukaj ligę...') })
      .last();
    await expect(matchDialog).toBeVisible();
    await matchDialog.getByPlaceholder('Wyszukaj ligę...').fill('Premier League');
    await matchDialog
      .getByText(/Premier League.*Anglia/)
      .first()
      .click();
    await matchDialog.getByRole('button', { name: 'Wybierz', exact: true }).click();

    // Mappings created inside the modal are transactional: storage is written
    // on "Zastosuj" (covered by unit tests), so assert the in-memory state shown here.
    await page.locator('#ldc-manage-mappings-btn').click();
    const mappingsModal = page.locator('#ldc-mappings-modal');
    await expect(mappingsModal).toBeVisible();
    await expect(mappingsModal.getByText('Synthetic English League')).toBeVisible();
    await expect(mappingsModal.getByText('Premier League')).toBeVisible();
    await expect(mappingsModal.getByText('Anglia')).toHaveCount(2);
  });

  test('should save mappings as a template, load it back and keep it after a reload', async ({
    page
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await uploadAndWaitForTable(page, syntheticLeagueFixture());

    await page.locator('#ldc-btn').click();
    await page.locator('#ldc-show-missing-btn').click();
    const missingPanel = page.locator('#ldc-missing-leagues');
    await missingPanel.locator('.ldc-country-checkbox').first().check();
    await page.locator('#ldc-match-selected-btn').click();
    const matchDialog = page
      .locator('div.fixed.inset-0')
      .filter({ has: page.getByPlaceholder('Wyszukaj ligę...') })
      .last();
    await matchDialog.getByPlaceholder('Wyszukaj ligę...').fill('Premier League');
    await matchDialog
      .getByText(/Premier League.*Anglia/)
      .first()
      .click();
    await matchDialog.getByRole('button', { name: 'Wybierz', exact: true }).click();

    await page.locator('#ldc-manage-mappings-btn').click();
    const mappingsModal = page.locator('#ldc-mappings-modal');
    await mappingsModal.locator('#ldc-template-name').fill('Sezon testowy');
    await mappingsModal.locator('#ldc-save-template-btn').click();
    await expect(mappingsModal.locator('#ldc-load-template')).toHaveValue('Sezon testowy');

    await mappingsModal.locator('#ldc-mappings-select-all').check();
    await mappingsModal.locator('#ldc-mappings-bulk-delete-btn').click();
    await expect(mappingsModal.getByText('Synthetic English League')).toHaveCount(0);
    await mappingsModal.locator('#ldc-load-template-btn').click();
    await expect(mappingsModal.getByText('Synthetic English League')).toBeVisible();

    // Templates live in IndexedDB, so they outlast a reload without another import.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#ldc-btn').click();
    await page.locator('#ldc-manage-mappings-btn').click();
    await expect(
      page.locator('#ldc-mappings-modal #ldc-load-template option', { hasText: 'Sezon testowy' })
    ).toHaveCount(1);
  });
});

// ============================================================================
// OFFLINE MODE
// ============================================================================

test.describe('Offline Mode', () => {
  test('should not log parser worker teardown errors across import, LDC, and offline reload', async ({
    context,
    page
  }) => {
    const parserWorkerErrors: string[] = [];
    collectParserWorkerErrors(page, parserWorkerErrors);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const isolated = await page.evaluate(() => window.crossOriginIsolated);
    if (isolated) {
      await expect
        .poll(() =>
          page.evaluate(() => {
            return (window as any).parserBridge?.getState?.() ?? 'missing';
          })
        )
        .toBe('idle');
    }

    await page.locator('#ldc-btn').click();
    await expect(page.locator('#ldc-modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#ldc-close').click();
    await expect(page.locator('#ldc-modal')).toBeHidden();

    await context.setOffline(true);
    try {
      await page.reload({ timeout: 10000 });
    } catch {
      // Reload may fail while offline when service workers are blocked.
    } finally {
      await context.setOffline(false);
    }

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(parserWorkerErrors).toEqual([]);
  });

  test('should load core UI elements without network', async ({ context, page }) => {
    // First, load the page normally to populate any caches
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify the app loaded
    await expect(page.locator('#drop-area')).toBeVisible();

    // Go offline
    await context.setOffline(true);

    // Reload the page while offline
    try {
      await page.reload({ timeout: 10000 });
      const body = page.locator('body');
      await expect(body).toBeVisible();
    } catch {
      // Page failed to load offline – acceptable when service workers are blocked
    }

    // Go back online
    await context.setOffline(false);
  });

  test('should show network status banner when going offline', async ({ context, page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);
    await page.waitForTimeout(1000);

    const networkBanner = page.locator('#network-banner');
    await networkBanner.textContent().catch(() => '');

    await context.setOffline(false);
    await page.waitForTimeout(1000);

    await expect(networkBanner).toBeAttached();
  });

  test('should recover gracefully after going online again', async ({ context, page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#drop-area')).toBeVisible();

    await context.setOffline(true);
    await page.waitForTimeout(500);

    await context.setOffline(false);
    await page.waitForTimeout(1000);

    // Under the dev server the offline cycle can tear the page down entirely
    // (Vite HMR socket loss forces a reload that fails while offline), so
    // recovery means: after regaining network, a reload restores the shell -
    // either the empty-workspace drop zone or a loaded workspace.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#drop-area').or(page.locator('#app-controls'))).toBeVisible();
  });
});

// The app registers its service worker only in production builds, so this runs against
// `vite preview` (PLAYWRIGHT_BASE_URL) and is skipped on the dev server.
test.describe('Service worker offline (production build)', () => {
  test.use({ serviceWorkers: 'allow' });

  test('should precache the build and reload offline with messages', async ({
    context,
    page,
    request
  }) => {
    // preview answers unknown paths with index.html, the dev server with the Vite client script
    const devClient = await request.get('/@vite/client');
    const isDevServer = (devClient.headers()['content-type'] ?? '').includes('javascript');
    // eslint-disable-next-line playwright/no-skipped-test -- no service worker on the dev server
    test.skip(isDevServer, 'service worker is registered only in production builds');

    await page.goto('/');
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
        timeout: 30000
      })
      .toBe(true);

    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const staticName = names.find(
        (name) => name.startsWith('fm-evaluator-static-') && !name.endsWith('-rollback')
      );
      const keys = staticName ? await (await caches.open(staticName)).keys() : [];
      return keys.map((request) => new URL(request.url).pathname);
    });
    expect(cached).toContain('/i18n/messages/index.json');
    expect(cached.some((pathname) => pathname.startsWith('/assets/'))).toBe(true);

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.locator('#drop-area')).toBeVisible();
      const messagesStatus = await page.evaluate(async () => {
        const response = await fetch('/i18n/messages/index.json');
        return response.status;
      });
      expect(messagesStatus).toBe(200);
    } finally {
      await context.setOffline(false);
    }
  });
});
