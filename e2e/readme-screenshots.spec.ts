// Writes the README screenshots (docs/images/) from a golden fixture, so they can be redone after
// a visible change: `pnpm run screenshots:readme`. playwright.config.ts leaves it out of ordinary
// E2E runs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(APP_DIR, 'goldens', 'fixtures', 'fm-export-en-uk.html');
const IMAGES_DIR = path.join(APP_DIR, 'docs', 'images');
const ROLE = 'MC';

test.use({
  colorScheme: 'light',
  locale: 'en-GB',
  reducedMotion: 'reduce',
  viewport: { height: 900, width: 1440 }
});

test('README screenshots', async ({ page }) => {
  await page.goto('/');
  await page.locator('#files-input').setInputFiles(FIXTURE);
  const rows = page.locator('#table-body tr:not(.virtual-spacer)');
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });

  await page.locator('#position-select').selectOption(ROLE);
  await page.locator('#run-analysis').click();
  await expect(page.locator('th[data-col-id="totalScore"]')).toHaveCount(1);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(IMAGES_DIR, 'ranking.png') });

  await rows.first().click();
  const drawer = page.locator('[data-testid="player-details-drawer"]');
  await expect(drawer.locator('[data-testid="player-details-score-cards"]')).toBeVisible();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(IMAGES_DIR, 'player-details.png') });
});
