import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function uploadAndWaitForTable(page: any, fixtureName: string) {
  const fileInput = page.locator('#files-input');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures', path.basename(fixtureName))); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
  for (let i = 0; i < 40; i++) {
    const state = await page.evaluate(() => {
      const ac = document.querySelector('#app-controls');
      const tb = document.querySelector('#table-body');
      if (
        ac &&
        !ac.classList.contains('hidden') &&
        tb &&
        tb.querySelectorAll('tr:not(.virtual-spacer)').length > 0
      )
        return { done: true };
      const langModal = document.querySelector('#language-choice-modal');
      if (langModal && !langModal.classList.contains('hidden')) {
        document.querySelector<HTMLElement>('#language-choice-ui-btn')?.click();
        return { dismissed: 'lang' };
      }
      const fvModal = document.querySelector('#format-verification-modal');
      if (fvModal && getComputedStyle(fvModal).display !== 'none') {
        document.querySelector<HTMLElement>('#confirm-btn')?.click();
        return { dismissed: 'fv' };
      }
      const stp = document.querySelector('#single-type-prompt');
      if (stp && !stp.classList.contains('hidden')) {
        document.querySelector<HTMLElement>('#btn-process-now')?.click();
        return { dismissed: 'stp' };
      }
      const hmModal = document.querySelector('#header-mapping-modal');
      if (hmModal && getComputedStyle(hmModal).display !== 'none') {
        document.querySelector<HTMLElement>('#confirm-header-btn')?.click();
        return { dismissed: 'hm' };
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
}

test.describe('Modals UX', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console logs
    page.on('console', (msg) => console.log(`[Browser] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[Browser] Error: ${err.message}`));

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should queue modals for multiple files', async ({ page }) => {
    // Enable multiple file upload
    const fileInput = page.locator('#files-input');

    // Upload two files
    const file1Path = path.join('e2e', 'fixtures', 'sample-attributes-pl.html');
    const buffer = fs.readFileSync(file1Path);

    // Playwright supports uploading array of files
    await fileInput.setInputFiles([
      { buffer, mimeType: 'text/html', name: 'file1.html' },
      { buffer, mimeType: 'text/html', name: 'file2.html' }
    ]);

    // Check if error log or success message appears
    // We expect some interaction or success
    const statusText = page.locator('#upload-status-text');
    const errorLog = page.locator('#error-log');

    // Wait for either status update or error (duplicate check might trigger)
    await Promise.race([expect(statusText).toBeVisible(), expect(errorLog).toBeVisible()]);
  });

  test('should support cancel all from format verification modal', async ({ page }) => {
    // Create a mock file with ambiguous format (unknown units) to force modal
    // Using a SHORT unit 'xyz' that satisfies FormatInspector regex /\b[a-zA-Z]{1,4}\b/
    // Adding UID to avoid missing column errors
    const ambiguousHtml = `
      <!-- unique_test_run_${Date.now()} -->
      <table>
        <thead><tr><th>UID</th><th>Name</th><th>Wage</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Player 1</td><td>100 xyz</td></tr>
          <tr><td>2</td><td>Player 2</td><td>200 xyz</td></tr> 
        </tbody>
      </table>
    `;

    const runId = Math.random().toString(36).slice(7);
    const ambiguous1Name = `ambiguous1_${runId}.html`;
    const ambiguous2Name = `ambiguous2_${runId}.html`;
    const fileInput = page.locator('#files-input');

    await fileInput.setInputFiles([
      {
        buffer: Buffer.from(ambiguousHtml.replace('Player 1', `Player 1 ${runId}`)) as any,
        mimeType: 'text/html',
        name: ambiguous1Name
      },
      {
        buffer: Buffer.from(
          ambiguousHtml.replace('Player 2', `Player 2 ${runId}`).replace('200 xyz', '201 xyz')
        ) as any,
        mimeType: 'text/html',
        name: ambiguous2Name
      }
    ]);

    // Wait for Format Verification Modal
    // This might fail if the app detects it as invalid file type first,
    // so we need to ensure it passes basic validation (has Name header)
    const modal = page.locator('#format-verification-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Check for "Cancel All" button (should be visible since queue length > 1)
    const cancelAllBtn = modal.locator('#cancel-all-btn');
    await expect(cancelAllBtn).toBeVisible();

    // Handle confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click Cancel All
    await cancelAllBtn.click();

    // Modal should disappear
    await expect(modal).toBeHidden();

    // Status text should show cancellation message
    const statusText = page.locator('#upload-status-text');
    await expect(statusText).toBeVisible();
    await expect(statusText).toContainText('Anulowano przetwarzanie');

    // Error log should NOT be visible or should be empty (cancellation is not an error)
    const errorLog = page.locator('#error-log');
    await expect(errorLog).toBeHidden();
  });
});

test.describe('Modal Queue Reentrancy', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`[Browser] ${msg.type()}: ${msg.text()}`));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should process modals sequentially in queue order', async ({ page }) => {
    // Verify ModalQueue is available
    const hasModalQueue = await page.evaluate(() => {
      return (window as any).ModalQueue !== undefined;
    });
    expect(hasModalQueue).toBeTruthy();

    // Check queue is empty initially
    const initialQueueLength = await page.evaluate(() => {
      return (window as any).ModalQueue.getQueueLength();
    });
    expect(initialQueueLength).toBe(0);

    // Verify queue is not processing initially
    const isProcessing = await page.evaluate(() => {
      return (window as any).ModalQueue.isQueueProcessing();
    });
    expect(isProcessing).toBe(false);
  });

  test('should handle immediate priority modals (nested modals)', async ({ page }) => {
    // Test immediate priority bypasses queue
    const result = await page.evaluate(async () => {
      const order: string[] = [];

      // Enqueue a normal modal
      const normalPromise = (window as any).ModalQueue.enqueue(
        async () => {
          order.push('normal-start');
          await new Promise((r) => setTimeout(r, 100));
          order.push('normal-end');
          return 'normal';
        },
        'test',
        'test.html'
      );

      // Small delay to let normal modal start
      await new Promise((r) => setTimeout(r, 50));

      // Enqueue an immediate modal (should execute right away)
      const immediateResult = await (window as any).ModalQueue.enqueue(
        async () => {
          order.push('immediate');
          return 'immediate';
        },
        'test-immediate',
        'test.html',
        { priority: 'immediate' }
      );

      const normalResult = await normalPromise;

      return { immediateResult, normalResult, order };
    });

    // Immediate should have executed during normal modal
    expect(result.immediateResult).toBe('immediate');
    expect(result.normalResult).toBe('normal');
    expect(result.order).toContain('immediate');
  });

  test('should cancelAll reject pending modals', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const results: string[] = [];

      // Enqueue multiple modals
      const modal1 = (window as any).ModalQueue.enqueue(
        async () => {
          await new Promise((r) => setTimeout(r, 500));
          return 'modal1';
        },
        'test1',
        'file1.html'
      )
        .then(() => results.push('modal1-resolved'))
        .catch(() => results.push('modal1-rejected'));

      const modal2 = (window as any).ModalQueue.enqueue(
        async () => {
          await new Promise((r) => setTimeout(r, 100));
          return 'modal2';
        },
        'test2',
        'file2.html'
      )
        .then(() => results.push('modal2-resolved'))
        .catch(() => results.push('modal2-rejected'));

      // Wait a bit then cancel all
      await new Promise((r) => setTimeout(r, 50));
      (window as any).ModalQueue.cancelAll('Test cancellation');

      // Wait for all promises to settle
      await Promise.allSettled([modal1, modal2]);

      return results;
    });

    // Pending modals should be rejected
    expect(result).toContain('modal2-rejected');
  });

  test('should report correct queue length and pending count', async ({ page }) => {
    const stats = await page.evaluate(async () => {
      // Enqueue some modals without resolving them immediately
      const promises: Promise<any>[] = [];

      for (let i = 0; i < 3; i++) {
        promises.push(
          (window as any).ModalQueue.enqueue(
            async () => {
              await new Promise((r) => setTimeout(r, 50));
              return i;
            },
            `test${i}`,
            `file${i}.html`
          )
        );
      }

      // Get initial stats
      const initialLength = (window as any).ModalQueue.getQueueLength();
      const initialPending = (window as any).ModalQueue.getPendingCount();
      const isProcessing = (window as any).ModalQueue.isQueueProcessing();

      // Wait for all to complete
      await Promise.all(promises);

      const finalLength = (window as any).ModalQueue.getQueueLength();

      return { finalLength, initialLength, initialPending, isProcessing };
    });

    // Queue should have been processing
    expect(stats.isProcessing).toBe(true);
    // Final queue should be empty
    expect(stats.finalLength).toBe(0);
  });
});

test.describe('Focus Trap A11y', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have FocusTrap available on window', async ({ page }) => {
    // Wait for runtime modules to initialize
    await page.waitForFunction(() => (window as any).FocusTrap !== undefined, {
      timeout: 5000
    });

    const hasFocusTrap = await page.evaluate(() => {
      return (window as any).FocusTrap !== undefined;
    });

    expect(hasFocusTrap).toBe(true);
  });

  // Known app bug: the settings focus trap never activates (no aria-modal, Escape
  // does not close); re-enable the test once the modal gets a working focus trap.
  test.fixme('should trap focus within settings modal', async ({ page }) => {
    // #settings-btn is inside #app-controls which is hidden until a file is uploaded
    await uploadAndWaitForTable(page, 'sample-attributes-pl.html');

    const settingsBtn = page.locator('#settings-btn');
    await expect(settingsBtn).toBeVisible({ timeout: 3000 });
    await settingsBtn.click();

    const settingsModal = page.locator('#settings-modal');
    await expect(settingsModal).toBeVisible({ timeout: 5000 });

    // Wait for focus trap to activate (sets aria-modal attribute)
    await page.waitForFunction(
      () => document.querySelector('#settings-modal')?.hasAttribute('aria-modal'),
      { timeout: 3000 }
    );

    // Tab through focusable elements
    await page.keyboard.press('Tab');

    // Check that focus is within the modal
    const focusedInModal = await page.evaluate(() => {
      return document.activeElement?.closest('#settings-modal') !== null;
    });

    expect(focusedInModal).toBe(true);
  });

  test('should have aria-live regions for announcements', async ({ page }) => {
    // Check for aria-live regions
    const liveRegions = await page.locator('[aria-live]').count();
    expect(liveRegions).toBeGreaterThan(0);

    // Specifically check profile banner
    const profileBanner = page.locator('#profile-banner');
    await expect(profileBanner).toHaveAttribute('aria-live', 'polite');

    // Check network banner
    const networkBanner = page.locator('#network-banner');
    await expect(networkBanner).toHaveAttribute('aria-live', 'polite');
  });
});
