import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const fileName = fileURLToPath(import.meta.url);
const directoryName = path.dirname(fileName);
const importFlowTimeout = 20_000;

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

function remapFixtureUidBlock(baseFixture: string, prefix: '91' | '92') {
  let next = baseFixture;
  for (let index = 1; index <= 5; index += 1) {
    next = next.replaceAll(`9000000${index}`, `${prefix}00000${index}`);
  }

  return next;
}

async function openNameFilterWithShortcut(page: Page) {
  await page.keyboard.press('Control+k');
  const nameFilter = page.locator('#filter-name');
  if (
    !(await nameFilter.evaluate((element) => element.classList.contains('show')).catch(() => false))
  ) {
    await page.keyboard.press('Meta+k');
  }

  await expect
    .poll(() =>
      page.locator('#filter-name').evaluate((element) => element.classList.contains('show'))
    )
    .toBe(true);
}

test.describe('React Workspace Flows', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
  });

  test('Ctrl/Cmd + K opens Nazwisko column filter', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await openNameFilterWithShortcut(page);

    await expect(page.locator('#filter-name #filter-input-name')).toBeVisible();
  });

  test('typing surname in Nazwisko column filter narrows table rows', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await openNameFilterWithShortcut(page);

    const input = page.locator('#filter-name #filter-input-name');
    await input.fill('Richardson');
    await page
      .locator('.filter-popup.show [data-fm-action="applyFilter"][data-fm-id="name"]')
      .click();

    await expect.poll(() => page.locator('#table-body tr:not(.virtual-spacer)').count()).toBe(1);
    await expect(page.locator('#table-body')).toContainText('Richardson');
  });

  test('copy from Nazwisko cell writes player name to clipboard', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    const firstNameCell = page
      .locator('#table-body tr:not(.virtual-spacer)')
      .first()
      .locator('[data-col-id="name"]');
    const nameCellText = ((await firstNameCell.textContent()) || '').trim();

    await firstNameCell.locator('[data-testid="player-name-copy"]').click();

    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).not.toBe('');
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    await expect.poll(() => nameCellText.includes(clipboardText)).toBe(true);
  });

  test('Escape closes either column filter or detail drawer', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');

    await openNameFilterWithShortcut(page);
    await page.keyboard.press('Escape');
    await expect
      .poll(async () =>
        page.locator('#filter-name').evaluate((element) => element.classList.contains('show'))
      )
      .toBe(false);

    // The drawer needs the comparison runtime, which exists only after an analysis run.
    await page.locator('#position-select').selectOption({ index: 1 });
    await page.locator('#run-analysis').click();
    await page.locator('#table-body tr:not(.virtual-spacer)').first().click();
    await expect(page.locator('[data-testid="player-details-drawer"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="player-details-drawer"]')).toHaveCount(0);
  });

  test('pagination first/last/jump controls work', async ({ page }) => {
    await uploadAndWaitForTable(page, 'sample-attributes-en.html');
    const baseFixture = fs.readFileSync(
      path.join(directoryName, 'fixtures', 'sample-attributes-en.html'),
      'utf8'
    );
    const expandedA = remapFixtureUidBlock(baseFixture, '91');
    const expandedB = remapFixtureUidBlock(baseFixture, '92');

    await page.locator('#files-input').setInputFiles({
      buffer: Buffer.from(expandedA) as any,
      mimeType: 'text/html',
      name: 'sample-expanded-a.html'
    });

    await expect
      .poll(
        async () => {
          await resolveImportStep(page);
          return page.evaluate(
            () =>
              (window as Window & { processor?: { mergedData?: unknown[] } }).processor?.mergedData
                ?.length ?? 0
          );
        },
        {
          intervals: [250, 500, 1000],
          timeout: importFlowTimeout
        }
      )
      .toBeGreaterThan(5);

    await page.locator('#files-input').setInputFiles({
      buffer: Buffer.from(expandedB) as any,
      mimeType: 'text/html',
      name: 'sample-expanded-b.html'
    });

    await expect
      .poll(
        async () => {
          await resolveImportStep(page);
          return page.evaluate(
            () =>
              (window as Window & { processor?: { mergedData?: unknown[] } }).processor?.mergedData
                ?.length ?? 0
          );
        },
        {
          intervals: [250, 500, 1000],
          timeout: importFlowTimeout
        }
      )
      .toBeGreaterThan(10);

    await page.locator('[data-testid="pagination-rows-per-page"]').selectOption('10');
    const jumpInput = page.locator('[data-testid="pagination-page-input"]');
    const maxPage = (await jumpInput.getAttribute('max')) || '1';
    await page.locator('[data-testid="pagination-last"]').click();
    await expect(jumpInput).toHaveValue(maxPage);

    await page.locator('[data-testid="pagination-first"]').click();
    await expect(jumpInput).toHaveValue('1');

    await jumpInput.fill(maxPage === '1' ? '1' : '2');
    await jumpInput.press('Enter');
    await expect(jumpInput).toHaveValue(maxPage === '1' ? '1' : '2');
  });
});
