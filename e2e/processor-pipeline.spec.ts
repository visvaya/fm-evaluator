import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_TYPES = ['attr', 'stats', 'both', 'complete', 'unknown'] as const;

async function resolveImportStep(page: any) {
  const steps = [
    ['#language-choice-modal', '#language-choice-ui-btn'],
    ['#format-verification-modal', '#confirm-btn'],
    ['#single-type-prompt', '#btn-process-now'],
    ['#header-mapping-modal', '#confirm-header-btn']
  ] as const;

  for (const [rootSelector, actionSelector] of steps) {
    const root = page.locator(rootSelector);
    if (await root.isVisible()) {
      await page.locator(actionSelector).click();
      return;
    }
  }
}

async function uploadAndWaitForTable(page: any, fixtureName: string) {
  await page.locator('#files-input').setInputFiles(path.join(__dirname, 'fixtures', fixtureName));

  await expect
    .poll(
      async () => {
        await resolveImportStep(page);
        return page.locator('#table-body tr:not(.virtual-spacer)').count();
      },
      { intervals: [250, 500, 1000], timeout: 25_000 }
    )
    .toBeGreaterThan(0);
}

async function getProcessorState(page: any) {
  return page.evaluate(() => {
    const p = (window as any).processor;
    if (!p) return null;
    return {
      mergedDataLength: p.mergedData?.length ?? 0,
      attributesLength: p.attributes?.length ?? 0,
      statsLength: p.stats?.length ?? 0,
      fileStackLength: p.fileStack?.length ?? 0,
      fileStackType: p.fileStack?.[0]?.type ?? null,
      fileStackRowCount: p.fileStack?.[0]?.rowCount ?? 0,
      detectedLanguages: p.detectedFileLanguages ?? []
    };
  });
}

// ============================================================================
// PROCESSOR PIPELINE
// ============================================================================

test.describe('Processor Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 1. Processor state after import
  // --------------------------------------------------------------------------

  test.describe('Processor state after EN import', () => {
    test('mergedData is populated after EN attributes import', async ({ page }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-en.html');

      const state = await getProcessorState(page);
      expect(state).not.toBeNull();
      expect(state!.mergedDataLength).toBeGreaterThan(0);
    });

    test('fileStack has valid entry after EN attributes import', async ({ page }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-en.html');

      const state = await getProcessorState(page);
      expect(state!.fileStackLength).toBeGreaterThan(0);
      expect(state!.fileStackRowCount).toBeGreaterThan(0);
      expect(FILE_TYPES).toContain(state!.fileStackType);
    });

    test('fileStack rowCount matches mergedData length after single-file import', async ({
      page
    }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-en.html');

      const state = await getProcessorState(page);
      expect(state!.fileStackRowCount).toBe(state!.mergedDataLength);
    });

    test('detectedFileLanguages is populated after EN import', async ({ page }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-en.html');

      const state = await getProcessorState(page);
      expect(state!.detectedLanguages.length).toBeGreaterThan(0);
    });
  });

  test.describe('Processor state after PL import', () => {
    test('mergedData is populated after PL attributes import', async ({ page }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-pl.html');

      const state = await getProcessorState(page);
      expect(state!.mergedDataLength).toBeGreaterThan(0);
    });

    test('fileStack has valid entry after PL attributes import', async ({ page }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-pl.html');

      const state = await getProcessorState(page);
      expect(state!.fileStackLength).toBeGreaterThan(0);
      expect(FILE_TYPES).toContain(state!.fileStackType);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Data correctness
  // --------------------------------------------------------------------------

  test.describe('Data correctness', () => {
    test('EN import: table contains player from fixture (James Richardson)', async ({ page }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-en.html');

      const tableBody = page.locator('#table-body');
      await expect(tableBody).toContainText('James Richardson');
    });

    test('PL import: table contains player from fixture (Krzysztof Lewandowski)', async ({
      page
    }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-pl.html');

      const tableBody = page.locator('#table-body');
      await expect(tableBody).toContainText('Krzysztof Lewandowski');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Error handling
  // --------------------------------------------------------------------------

  test.describe('Error handling', () => {
    test('uploading HTML without a table element shows an error', async ({ page }) => {
      await page
        .locator('#files-input')
        .setInputFiles(path.join(__dirname, 'fixtures', 'no-table.html'));

      // Dismiss language or FV modals if they appear
      await page.waitForTimeout(500);
      await resolveImportStep(page);
      await page.waitForTimeout(500);

      // Error log should appear
      const errorLog = page.locator('#error-log');
      await expect(errorLog).toBeVisible({ timeout: 10_000 });
    });

    test('table does not render after uploading file without a table element', async ({ page }) => {
      await page
        .locator('#files-input')
        .setInputFiles(path.join(__dirname, 'fixtures', 'no-table.html'));

      await page.waitForTimeout(1000);
      await resolveImportStep(page);
      await page.waitForTimeout(500);

      const rows = page.locator('#table-body tr:not(.virtual-spacer)');
      const count = await rows.count();
      expect(count).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Attrs + Stats merge via file stack
  // --------------------------------------------------------------------------

  test.describe('Attrs + Stats merge', () => {
    test('after EN attrs import, attributes are populated and stats are empty', async ({
      page
    }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-en.html');

      const state = await getProcessorState(page);
      expect(state!.attributesLength).toBeGreaterThan(0);
    });

    test('after EN stats import on top of attrs, fileStack has two entries', async ({ page }) => {
      await uploadAndWaitForTable(page, 'sample-attributes-en.html');

      // Upload stats file as second file
      await page
        .locator('#files-input')
        .setInputFiles(path.join(__dirname, 'fixtures', 'sample-stats-en.html'));

      await expect
        .poll(
          async () => {
            await resolveImportStep(page);
            return page.evaluate(() => (window as any).processor?.fileStack?.length ?? 0);
          },
          { intervals: [500, 1000], timeout: 20_000 }
        )
        .toBeGreaterThanOrEqual(2);

      const state = await getProcessorState(page);
      expect(state!.mergedDataLength).toBeGreaterThan(0);
    });
  });
});
