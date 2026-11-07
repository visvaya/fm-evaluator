import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const fileName = fileURLToPath(import.meta.url);
const directoryName = path.dirname(fileName);
const importFlowTimeout = 30_000;

async function clickIfVisible(page: Page, rootSelector: string, actionSelector: string) {
  const root = page.locator(rootSelector);
  if (await root.isVisible()) {
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
      {
        intervals: [250, 500, 1000],
        timeout: importFlowTimeout
      }
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

async function openFirstRenderableComparison(page: Page) {
  const chart = page.locator('[data-testid="player-beeswarm-chart"]');
  const comparisonButtons = page.locator(
    '[data-testid="player-details-drawer"] button[aria-expanded="false"]'
  );
  const buttonCount = await comparisonButtons.count();

  expect(buttonCount).toBeGreaterThan(0);

  for (let index = 0; index < buttonCount; index += 1) {
    await comparisonButtons.first().click();

    if ((await chart.locator('circle').count()) > 0) {
      return;
    }
  }

  throw new Error('No player detail comparison rendered a beeswarm chart.');
}

async function expectPlayerDetailsSections(page: Page) {
  await expect(page.locator('[data-testid="player-details-score-cards"]')).toBeVisible();
  await expect(page.locator('[data-testid="player-details-role-requirements"]')).toBeVisible();
  await expect(page.locator('[data-testid="player-details-market-value"]')).toBeVisible();
  await expect(page.locator('[data-testid="player-details-attribute-analysis"]')).toBeVisible();
  await expect(page.locator('[data-testid="player-details-attribute-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="player-details-statistics-analysis"]')).toBeVisible();
  await expect(page.locator('[data-testid="player-details-stat-table"]')).toBeVisible();

  const dataQualitySection = page.locator('[data-testid="player-details-data-quality"]');
  if ((await dataQualitySection.count()) > 0) {
    await expect(dataQualitySection).toBeVisible();
  }
}

test.describe('PlayerDetails metric comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('renders React beeswarm comparison without loading legacy d3', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');
    await runAnalysisForOutfieldRole(page);

    await page.locator('#table-body tr:not(.virtual-spacer)').first().click();
    await expect(page.locator('[data-testid="player-details-drawer"]')).toBeVisible();
    await expectPlayerDetailsSections(page);

    await openFirstRenderableComparison(page);

    const chart = page.locator('[data-testid="player-beeswarm-chart"]');
    await expect(chart).not.toHaveCount(0);
    await expect(chart.locator('circle')).not.toHaveCount(0);

    const hasD3Global = await page.evaluate(
      () => (window as Window & { d3?: unknown }).d3 !== undefined
    );
    expect(hasD3Global).toBe(false);

    const d3Resources = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('d3.v7'))
    );
    expect(d3Resources).toEqual([]);
  });
});
