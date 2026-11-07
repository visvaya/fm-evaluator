// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { showAlertModal, showConfirmModal } from './ldcModalHelpers';

const HOSTILE = '<img src=x data-injected="1">';

describe('ldcModalHelpers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['alert', () => showAlertModal(`Usuń "${HOSTILE}"`, HOSTILE)],
    ['confirm', () => showConfirmModal(`Usuń "${HOSTILE}"`, HOSTILE)]
  ])('renders the %s title and message as text, not markup', (_name, open) => {
    open();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('[data-injected]')).toBeNull();
    expect(dialog?.querySelector('h3')?.textContent).toBe(`Usuń "${HOSTILE}"`);
    expect(dialog?.querySelector('p')?.textContent?.trim()).toBe(HOSTILE);
  });
});
