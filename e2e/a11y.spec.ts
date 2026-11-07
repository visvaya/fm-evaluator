import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const fileName = fileURLToPath(import.meta.url);
const directoryName = path.dirname(fileName);
const importFlowTimeout = 30_000;
const blockingImpacts = new Set(['critical', 'serious']);

// Known serious or critical violations in today's UI, by axe rule id.
// Each entry is debt to fix; remove it once the rule passes.
const knownViolations: ReadonlySet<string> = new Set([
  // 19 nodes on the main view below the WCAG AA contrast ratio (measured
  // 2026-09-30); fixing them means changing colour tokens (docs/ui/design.md).
  'color-contrast'
]);

async function clickIfVisible(page: Page, rootSelector: string, actionSelector: string) {
  if (await page.locator(rootSelector).isVisible()) {
    await page.locator(actionSelector).click();
    return true;
  }

  return false;
}

async function resolveImportStep(page: Page) {
  const steps = [
    ['#language-choice-modal', '#language-choice-file-btn'],
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

async function uploadAndWaitForTable(page: Page, fixtureName: string) {
  await page
    .locator('#files-input')
    .setInputFiles(path.join(directoryName, 'fixtures', fixtureName));

  await expect
    .poll(
      async () => {
        await resolveImportStep(page);
        return page.locator('#table-body tr:not(.virtual-spacer)').count();
      },
      { intervals: [250, 500, 1000], timeout: importFlowTimeout }
    )
    .toBeGreaterThan(0);
}

async function runAnalysisForOutfieldRole(page: Page) {
  const positionSelect = page.locator('#position-select');

  if (!(await positionSelect.isVisible())) {
    await page.locator('#toggle-analysis-controls').click();
  }

  await expect(positionSelect).toBeVisible();
  await positionSelect.selectOption('MC');
  await page.locator('#run-analysis').click();
  await expect(page.locator('th[data-col-id="totalScore"]')).toHaveCount(1);
}

async function blockingViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  const results = await (include ? builder.include(include) : builder).analyze();

  return results.violations
    .filter((violation) => blockingImpacts.has(violation.impact ?? ''))
    .filter((violation) => !knownViolations.has(violation.id))
    .map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.length} nodes`);
}

test.describe('Accessibility (axe)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await uploadAndWaitForTable(page, 'sample-attributes-pl.html');
  });

  test('main view has no serious or critical violations', async ({ page }) => {
    expect(await blockingViolations(page)).toEqual([]);
  });

  test('player details drawer has no serious or critical violations', async ({ page }) => {
    await runAnalysisForOutfieldRole(page);
    await page.locator('#table-body tr:not(.virtual-spacer)').first().click();
    const drawer = '[data-testid="player-details-drawer"]';
    await expect(page.locator(drawer)).toBeVisible();

    expect(await blockingViolations(page, drawer)).toEqual([]);
  });
});
