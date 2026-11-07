// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import './formatVerificationModal.js';

const HOSTILE = '<img src=x data-injected="1">';

type FormatVerificationModalCtor = new () => {
  show: (formatContext: Record<string, unknown>) => Promise<unknown>;
};

describe('FormatVerificationModal', () => {
  beforeEach(() => {
    vi.stubGlobal('ModalQueue', undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('renders the file name and detected units as text, not markup', async () => {
    const { FormatVerificationModal } = window as unknown as {
      FormatVerificationModal: FormatVerificationModalCtor;
    };
    const choice = new FormatVerificationModal().show({
      decimalSeparator: '.',
      fileId: `${HOSTILE}_123`,
      thousandSeparator: ',',
      unknownUnits: [{ example: `12 ${HOSTILE}`, unit: HOSTILE }],
      wageFrequencies: new Set([HOSTILE])
    });

    const root = document.querySelector('#format-verification-modal');
    expect(root).not.toBeNull();
    expect(root?.querySelector('[data-injected]')).toBeNull();
    expect(root?.textContent).toContain(HOSTILE);
    expect(root?.textContent).toContain(`12 ${HOSTILE}`);

    document.querySelector<HTMLButtonElement>('#cancel-btn')?.click();
    await expect(choice).resolves.toBeNull();
  });
});
