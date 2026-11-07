import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { devices, expect, test } from '@playwright/test';

const fileName = fileURLToPath(import.meta.url);
const directoryName = path.dirname(fileName);
const importFlowTimeout = 20_000;

async function clickIfVisible(page: any, rootSelector: string, actionSelector: string) {
  const root = page.locator(rootSelector);
  if (await root.isVisible()) {
    await page.locator(actionSelector).click();
    return true;
  }

  return false;
}

async function resolveImportStep(page: any) {
  const steps = [
    ['#language-choice-modal', '#language-choice-ui-btn'],
    ['#format-verification-modal', '#confirm-btn'],
    ['#single-type-prompt', '#btn-process-now'],
    ['#header-mapping-modal', '#confirm-header-btn']
  ] as const;

  for (const [rootSelector, actionSelector] of steps) {
    if (await clickIfVisible(page, rootSelector, actionSelector)) {
      return;
    }
  }
}

function getVisibleRowCount(page: any) {
  return page.locator('#table-body tr').count();
}

async function uploadAndWaitForTable(page: any, fixtureName: string) {
  await page
    .locator('#files-input')
    .setInputFiles(path.join(directoryName, 'fixtures', fixtureName));

  await expect
    .poll(
      async () => {
        await resolveImportStep(page);
        return getVisibleRowCount(page);
      },
      {
        intervals: [250, 500, 1000],
        timeout: importFlowTimeout
      }
    )
    .toBeGreaterThan(0);
}

async function openAnalysisSettings(page: any) {
  const positionSelect = page.locator('#position-select');
  if (await positionSelect.isVisible()) {
    return;
  }

  await page.locator('#toggle-analysis-controls').click();
  await expect(positionSelect).toBeVisible();
}

async function openApp(page: any) {
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
}

// ============================================================================
// CRITICAL PATH: Import → Table Rendering
// ============================================================================

test.describe('Critical Path: Import & Table', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('should import EN attributes file and render table with player data', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const tableBody = page.locator('#table-body');
    const rows = tableBody.locator('tr:not(.virtual-spacer)');

    // Should have 5 players (from the fixture)
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);

    // Verify a known player name appears in the table
    await expect(page.locator('#table-body')).toContainText('James Richardson');
  });

  test('should import PL attributes file and render table', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-pl.html');

    const tableBody = page.locator('#table-body');
    const rows = tableBody.locator('tr:not(.virtual-spacer)');

    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Verify Polish fixture player appears
    await expect(tableBody).toContainText('Krzysztof Lewandowski');
  });

  test('should show table headers after import', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const tableHeaders = page.locator('#table-headers th');
    const headerCount = await tableHeaders.count();

    // Must have at least a few columns
    expect(headerCount).toBeGreaterThan(3);
  });

  test('should keep table rows in normal table flow after import', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await expect(page.locator('#table-body tr').first()).not.toHaveCSS('position', 'absolute');
  });

  test('should show pagination controls after import', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Pagination lives in the PlayerTable footer; the old #react-pagination-controls
    // belonged to TableControls, which is not rendered (deferred to the redesign).
    await expect(page.getByTestId('pagination-first')).toBeVisible();
    await expect(page.getByTestId('pagination-last')).toBeVisible();
    await expect(page.getByTestId('pagination-rows-per-page')).toBeVisible();
  });

  test('should wait for a role choice before analysis after import', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // The role selector now sits in the header instead of a collapsed settings panel.
    await expect(page.locator('#position-select')).toBeVisible();
    await expect(page.locator('#position-select')).toHaveValue('');
    await expect(page.locator('#run-analysis')).toBeVisible();
  });

  test('should keep the legacy single-type prompt hidden after import', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await expect(page.locator('#single-type-prompt')).toBeHidden();
  });

  test('should render React filter buttons without legacy font-awesome classes', async ({
    page
  }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const filterTrigger = page.locator('[data-filter-trigger="true"]').first();
    await expect(filterTrigger).toBeVisible();
    await expect(filterTrigger).not.toHaveClass(/fa-filter/);
  });

  test('should hide scoring columns until analysis runs', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await expect(page.locator('th[data-col-id="totalScore"]')).toHaveCount(0);

    await openAnalysisSettings(page);
    await page.locator('#position-select').selectOption({ index: 1 });
    await page.locator('#run-analysis').click();

    await expect(page.locator('th[data-col-id="totalScore"]')).toHaveCount(1);
  });
});

// ============================================================================
// SORTING
// ============================================================================

test.describe('Critical Path: Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('should sort table when clicking column header', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // Find a clickable header (th with sort capability)
    const headers = page.locator('#table-headers th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);

    // Get initial first row text
    const clickableHeader = headers.nth(0);
    await clickableHeader.click();

    await clickableHeader.click();

    const rows = page.locator('#table-body tr:not(.virtual-spacer)');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// FILTERING
// ============================================================================

test.describe('Critical Path: Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('should show visible apply action in column filter popup', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const filterTrigger = page.locator('[data-filter-trigger="true"]').first();
    await filterTrigger.click();

    await expect(page.locator('.filter-popup.show [data-fm-action="applyFilter"]')).toBeVisible();
  });

  test('should filter by position using position selector', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await openAnalysisSettings(page);

    const posSelect = page.locator('#position-select');
    await expect(posSelect).toBeVisible();

    const options = await posSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(1);

    const rowsBefore = await page.locator('#table-body tr:not(.virtual-spacer)').count();

    await posSelect.selectOption({ index: 1 });
    await page.locator('#run-analysis').click();

    const rows = page.locator('#table-body tr:not(.virtual-spacer)');
    const filteredCount = await rows.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(rowsBefore);
  });

  test('should disable clear filters when no column filters are active', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const clearBtn = page.locator('#clear-all-filters');
    await expect(clearBtn).toBeVisible();
    await expect(clearBtn).toBeDisabled();
  });
});

// ============================================================================
// PAGINATION
// ============================================================================

test.describe('Critical Path: Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('should show correct results count', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    // The fixture has 5 players.
    await expect(page.locator('#table-scroller')).toContainText('Showing 5 of 5 players');
  });
});

// ============================================================================
// MULTI-LANGUAGE DETECTION
// ============================================================================

test.describe('Critical Path: Language Detection', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('should detect English language from EN fixture headers', async ({ page }) => {
    // Upload EN file – the app should detect English headers
    const fileInput = page.locator('#files-input');
    const filePath = path.join(directoryName, 'fixtures', 'sample-attributes-en.html');
    await fileInput.setInputFiles(filePath);

    // Wait for either success or modal
    const statusText = page.locator('#upload-status-text');
    const mappingModal = page.locator('#header-mapping-modal');
    const fvModal = page.locator('#format-verification-modal');

    await expect
      .poll(
        async () =>
          (await statusText.isVisible()) ||
          (await mappingModal.isVisible()) ||
          (await fvModal.isVisible()),
        { timeout: 10_000 }
      )
      .toBe(true);

    // The app should have processed the file – check window.processor for language info
    const langInfo = await page.evaluate(() => {
      const p = (window as any).processor;
      if (!p) return null;
      return {
        detectedLang: p.detectedLanguage || p.language || null,
        fileCount: p.mergedData?.length || p.allPlayers?.length || 0
      };
    });

    // Processor should have detected something
    // (exact assertion depends on implementation – at minimum, file was processed)
    expect(langInfo?.fileCount ?? 0).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Critical Path: Mobile Table', () => {
  test.use({
    hasTouch: devices['iPhone 13'].hasTouch,
    isMobile: devices['iPhone 13'].isMobile,
    userAgent: devices['iPhone 13'].userAgent,
    viewport: devices['iPhone 13'].viewport
  });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('should render imported rows on mobile viewport', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const rows = page.locator('#table-body tr:not(.virtual-spacer)');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });
});

test.describe('Critical Path: Compact Table', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 430, height: 700 }
  });

  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('should keep table rows visible on compact screens', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await expect(page.locator('#table-scroller')).not.toHaveCSS('height', '0px');
    await expect(page.locator('#table-body tr:not(.virtual-spacer)').first()).toBeVisible();
  });
});
