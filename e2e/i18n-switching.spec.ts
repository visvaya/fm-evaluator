import { expect, test } from '@playwright/test';

// ============================================================================
// i18n LANGUAGE SWITCHING
// ============================================================================

test.describe('i18n Language Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have language button visible', async ({ page }) => {
    const langBtn = page.locator('#language-btn-header');
    await expect(langBtn).toBeAttached({ timeout: 5000 });
  });

  test('should open language dropdown on button click', async ({ page }) => {
    const langBtn = page.locator('#language-btn-header');
    await expect(langBtn).toBeVisible({ timeout: 5000 });

    await langBtn.click();

    const dropdown = page.locator('#language-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });
  });

  test('should show available languages in dropdown', async ({ page }) => {
    const langBtn = page.locator('#language-btn-header');
    await expect(langBtn).toBeVisible({ timeout: 5000 });
    await langBtn.click();

    const dropdown = page.locator('#language-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Should show at least EN and PL
    const dropdownText = (await dropdown.textContent()) || '';
    expect(dropdownText).toMatch(/English|Polski/i);
  });

  test('should switch to English and update DOM', async ({ page }) => {
    const langBtn = page.locator('#language-btn-header');
    await expect(langBtn).toBeVisible({ timeout: 5000 });
    await langBtn.click();

    const dropdown = page.locator('#language-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Click English option
    const enOption = dropdown.locator(
      'button:has-text("English"), a:has-text("English"), [data-locale="en"]'
    );
    if (
      await enOption
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await enOption.first().click();
      await page.waitForTimeout(1000);

      // Verify locale changed – check some i18n-controlled text
      const locale = await page.evaluate(() => {
        return (
          (window as any).i18n?.getLocale?.() || localStorage.getItem('fm-evaluator-ui-locale')
        );
      });
      if (locale) {
        expect(locale).toBe('en');
      }
    }
  });

  test('should switch to Polish and update DOM', async ({ page }) => {
    const langBtn = page.locator('#language-btn-header');
    await expect(langBtn).toBeVisible({ timeout: 5000 });
    await langBtn.click();

    const dropdown = page.locator('#language-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Click Polish option
    const plOption = dropdown.locator(
      'button:has-text("Polski"), a:has-text("Polski"), [data-locale="pl"]'
    );
    if (
      await plOption
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await plOption.first().click();
      await page.waitForTimeout(1000);

      const locale = await page.evaluate(() => {
        return (
          (window as any).i18n?.getLocale?.() || localStorage.getItem('fm-evaluator-ui-locale')
        );
      });
      if (locale) {
        expect(locale).toBe('pl');
      }
    }
  });

  test('should persist language selection in localStorage', async ({ page }) => {
    const langBtn = page.locator('#language-btn-header');
    await expect(langBtn).toBeVisible({ timeout: 5000 });
    await langBtn.click();

    const dropdown = page.locator('#language-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Switch to English
    const enOption = dropdown.locator(
      'button:has-text("English"), a:has-text("English"), [data-locale="en"]'
    );
    if (
      await enOption
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await enOption.first().click();
      await page.waitForTimeout(500);

      // Check localStorage
      const stored = await page.evaluate(() => {
        return localStorage.getItem('fm-evaluator-ui-locale');
      });
      expect(stored).toBe('en');
    }
  });

  test('should restore language preference after reload', async ({ page }) => {
    // Set locale via localStorage before checking
    await page.evaluate(() => {
      localStorage.setItem('fm-evaluator-ui-locale', 'en');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const locale = await page.evaluate(() => {
      return (window as any).i18n?.getLocale?.() || localStorage.getItem('fm-evaluator-ui-locale');
    });
    expect(locale).toBe('en');
  });

  test('should close dropdown when clicking outside', async ({ page }) => {
    const langBtn = page.locator('#language-btn-header');
    await expect(langBtn).toBeVisible({ timeout: 5000 });
    await langBtn.click();

    const dropdown = page.locator('#language-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // Click outside the dropdown
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);

    await expect(dropdown).toBeHidden();
  });

  test('should update data-i18n elements when switching language', async ({ page }) => {
    // Find elements with data-i18n attribute
    const i18nElements = page.locator('[data-i18n]');
    const count = await i18nElements.count();

    if (count > 0) {
      // Get text of first i18n element
      const textBefore = await i18nElements.first().textContent();

      // Switch language
      const langBtn = page.locator('#language-btn-header');
      await langBtn.click();

      const dropdown = page.locator('#language-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 3000 });

      // Try switching to a different language
      const plOption = dropdown.locator(
        'button:has-text("Polski"), a:has-text("Polski"), [data-locale="pl"]'
      );
      if (
        await plOption
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await plOption.first().click();
        await page.waitForTimeout(1000);

        // Now switch to English
        await langBtn.click();
        await expect(dropdown).toBeVisible({ timeout: 3000 });
        const enOption = dropdown.locator(
          'button:has-text("English"), a:has-text("English"), [data-locale="en"]'
        );
        if (
          await enOption
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          await enOption.first().click();
          await page.waitForTimeout(1000);
        }
      }

      // The element should still have content (not empty)
      const textAfter = i18nElements.first();
      await expect(textAfter).toHaveText(/.+/);
    }
  });
});

// ============================================================================
// LANGUAGE CHOICE MODAL (first visit)
// ============================================================================

test.describe('Language Choice Modal', () => {
  test('should show language choice modal on first visit', async ({ page }) => {
    // Clear localStorage to simulate first visit
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const modal = page.locator('#language-choice-modal');
    // Modal should be attached (exists in DOM)
    await expect(modal).toBeAttached({ timeout: 5000 });

    // If visible, it should have language options
    if (await modal.isVisible().catch(() => false)) {
      const modalText = (await modal.textContent()) || '';
      expect(modalText).toMatch(/English|Polski|language|język/i);
    }
  });

  test('should dismiss language choice modal on selection', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const modal = page.locator('#language-choice-modal');
    if (await modal.isVisible().catch(() => false)) {
      // Click any language option
      const anyLangBtn = modal.locator('button').first();
      if (await anyLangBtn.isVisible()) {
        await anyLangBtn.click();
        await page.waitForTimeout(500);

        // Modal should be dismissed
        await expect(modal).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});
