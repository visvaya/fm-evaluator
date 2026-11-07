// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFilterRuntime = vi.hoisted(() =>
  vi.fn(() => ({
    calculatedScores: []
  }))
);

vi.mock('@/lib/filterRuntime', () => ({
  getFilterRuntime
}));

import { updateUI } from './updateUi';

describe('updateUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div data-i18n="hello"></div>
      <div id="language-dropdown"></div>
      <div id="results-count"></div>
    `;
    (window as any).i18n = {
      currentLanguage: 'en',
      t: (key: string) => (key === 'hello' ? 'Hello' : key)
    };
    (window as any).updateResultsMeta = vi.fn();
    (window as any).updatePageInfo = vi.fn();
    (window as any).store = { currentPage: 2 };
    (window as any).maxPage = 5;
    (window as any).COLUMNS = [];
    (window as any).renderTableHeaders = vi.fn();
    (window as any).scheduleTableRender = vi.fn();
  });

  it('refreshes results meta from the shared runtime row count', () => {
    getFilterRuntime.mockReturnValue({
      calculatedScores: [{ uid: '1' }, { uid: '2' }, { uid: '3' }]
    });

    updateUI();

    expect((window as any).updateResultsMeta).toHaveBeenCalledWith(3);
    expect(document.querySelector('[data-i18n="hello"]')?.textContent).toBe('Hello');
  });
});
