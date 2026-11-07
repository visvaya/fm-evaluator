// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updatePageInfo } from './pagination';

describe('pagination', () => {
  beforeEach(() => {
    vi.stubGlobal('i18n', { t: (key: string) => key });

    document.body.innerHTML = `
            <input id="page-number" type="number" value="1" />
            <span id="page-total-display"></span>
            <button id="page-first">First</button>
            <button id="page-prev">Prev</button>
            <button id="page-next">Next</button>
            <button id="page-last">Last</button>
        `;
  });

  describe('updatePageInfo', () => {
    it('should set page number input value', () => {
      updatePageInfo(3, 10);
      const input = document.querySelector<HTMLInputElement>('#page-number');
      expect(input.value).toBe('3');
    });

    it('should set max attribute on input', () => {
      updatePageInfo(1, 5);
      const input = document.querySelector<HTMLInputElement>('#page-number');
      expect(input.max).toBe('5');
    });

    it('should display total pages', () => {
      updatePageInfo(1, 10);
      const display = document.querySelector('#page-total-display');
      expect(display?.textContent).toContain('10');
    });

    it('should disable prev/first on page 1', () => {
      updatePageInfo(1, 5);
      const first = document.querySelector<HTMLButtonElement>('#page-first');
      const prev = document.querySelector<HTMLButtonElement>('#page-prev');
      expect(first.disabled).toBe(true);
      expect(prev.disabled).toBe(true);
    });

    it('should enable prev/first on middle pages', () => {
      updatePageInfo(3, 5);
      const first = document.querySelector<HTMLButtonElement>('#page-first');
      const prev = document.querySelector<HTMLButtonElement>('#page-prev');
      expect(first.disabled).toBe(false);
      expect(prev.disabled).toBe(false);
    });

    it('should disable next/last on last page', () => {
      updatePageInfo(5, 5);
      const next = document.querySelector<HTMLButtonElement>('#page-next');
      const last = document.querySelector<HTMLButtonElement>('#page-last');
      expect(next.disabled).toBe(true);
      expect(last.disabled).toBe(true);
    });

    it('should enable next/last on middle pages', () => {
      updatePageInfo(3, 5);
      const next = document.querySelector<HTMLButtonElement>('#page-next');
      const last = document.querySelector<HTMLButtonElement>('#page-last');
      expect(next.disabled).toBe(false);
      expect(last.disabled).toBe(false);
    });

    it('should handle 0 maxPage (no data)', () => {
      updatePageInfo(0, 0);
      const input = document.querySelector<HTMLInputElement>('#page-number');
      expect(input.value).toBe('0');

      const first = document.querySelector<HTMLButtonElement>('#page-first');
      const next = document.querySelector<HTMLButtonElement>('#page-next');
      expect(first.disabled).toBe(true);
      expect(next.disabled).toBe(true);
    });

    it('should clamp page to maxPage when over', () => {
      updatePageInfo(15, 5);
      const input = document.querySelector<HTMLInputElement>('#page-number');
      expect(input.value).toBe('5');
    });

    it('should clamp page to 1 when below', () => {
      updatePageInfo(-1, 5);
      const input = document.querySelector<HTMLInputElement>('#page-number');
      expect(input.value).toBe('1');
    });
  });
});
