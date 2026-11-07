// Phase 5D: Generic modal helpers (reusable beyond LDC)
// Extracted from main.js L9067-9120
import { escapeHtmlAttribute } from '../utils/escapeHtmlAttribute';

export function showAlertModal(title: string, message: string, onClose?: () => void): void {
  const modal = showModal(
    title,
    `
                <p class="text-sm leading-6 text-text-secondary">${escapeHtmlAttribute(message)}</p>
            `,
    `
                <button
                    id="modal-ok-btn"
                    class="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover"
                    type="button"
                >
                    OK
                </button>
            `
  );

  document.querySelector('#modal-ok-btn').addEventListener('click', () => {
    modal.remove();
    if (onClose) onClose();
  });
}

export function showConfirmModal(
  title: string,
  message: string,
  onConfirm?: () => void,
  onCancel?: () => void
): void {
  const modal = showModal(
    title,
    `
                <p class="text-sm leading-6 text-text-secondary">${escapeHtmlAttribute(message)}</p>
            `,
    `
                <button
                    id="modal-cancel-btn"
                    class="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface"
                    type="button"
                >
                    Anuluj
                </button>
                <button
                    id="modal-confirm-btn"
                    class="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover"
                    type="button"
                >
                    OK
                </button>
            `
  );
  let isSettled = false;
  const settle = (confirmed: boolean) => {
    if (isSettled) {
      return;
    }

    isSettled = true;
    modal.remove();
    if (confirmed) {
      onConfirm?.();
    } else {
      onCancel?.();
    }
  };

  modal.querySelector('#modal-confirm-btn')?.addEventListener('click', () => {
    settle(true);
  });

  modal.querySelector('#modal-cancel-btn')?.addEventListener('click', () => {
    settle(false);
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      settle(false);
    }
  });
}

export function showConfirmModalAsync(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    showConfirmModal(
      title,
      message,
      () => resolve(true),
      () => resolve(false)
    );
  });
}

/**
 * Creates a lightweight confirm/alert modal aligned with the current React UI shell.
 * Clicking outside the panel closes (removes) the modal.
 */
export function showModal(title: string, content: string, buttons: string): HTMLDivElement {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[160] flex items-center justify-center bg-background/70 px-4';
  modal.innerHTML = `
                <div
                    class="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="ldc-helper-modal-title"
                >
                    <div class="border-b border-border px-5 py-4">
                        <h3 id="ldc-helper-modal-title" class="text-lg font-semibold text-text-primary">${escapeHtmlAttribute(title)}</h3>
                    </div>
                    <div class="max-h-[60vh] overflow-y-auto px-5 py-4">
                        ${content}
                    </div>
                    <div class="flex justify-end gap-2 border-t border-border px-5 py-4">${buttons}</div>
                </div>
            `;

  document.body.append(modal);

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  return modal;
}
