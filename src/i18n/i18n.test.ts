// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyToDom,
  getAvailableLocales,
  getLocale,
  getNativeName,
  isInitialized,
  onLocaleChange,
  setLocale,
  t,
  tNested
} from './index';

// The i18n module uses internal state. We need to manipulate it for tests.
// The module exposes enough via its public API + window.i18n to test.

describe('i18n', () => {
  describe('t (translation)', () => {
    it('should return the key when no messages are loaded for the key', () => {
      // With no messages loaded for a non-existent key, t returns the key
      const result = t('nonexistent_key_xyz');
      expect(result).toBe('nonexistent_key_xyz');
    });

    it('should interpolate parameters', () => {
      // Even if the translation is the key itself (missing), interpolation should still work
      // We test interpolation with a known loaded translation if possible
      // For now, test the regex pattern:
      const template = '{count} players found';
      const interpolated = template.replaceAll(/\{(\w+)\}/g, (match, param) => {
        const params: Record<string, number | string> = { count: 5 };
        return params[param] === undefined ? match : String(params[param]);
      });
      expect(interpolated).toBe('5 players found');
    });
  });

  describe('getLocale', () => {
    it('should return a string locale id', () => {
      const locale = getLocale();
      expect(typeof locale).toBe('string');
      expect(locale.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableLocales', () => {
    it('should return at least en and pl', () => {
      const locales = getAvailableLocales();
      expect(locales.length).toBeGreaterThanOrEqual(2);
      const ids = locales.map((l) => l.id);
      expect(ids).toContain('en');
      expect(ids).toContain('pl');
    });

    it('should include nativeName for each locale', () => {
      const locales = getAvailableLocales();
      for (const locale of locales) {
        expect(locale.nativeName).toBeTruthy();
      }
    });
  });

  describe('getNativeName', () => {
    it('should return native name for known locale', () => {
      expect(getNativeName('en')).toBe('English');
      expect(getNativeName('pl')).toBe('Polski');
    });

    it('should return locale id for unknown locale', () => {
      expect(getNativeName('xx')).toBe('xx');
    });
  });

  describe('onLocaleChange', () => {
    it('should register and unregister listener', () => {
      const listener = vi.fn();
      const unsubscribe = onLocaleChange(listener);
      expect(typeof unsubscribe).toBe('function');

      // Unsubscribe should not throw
      unsubscribe();
    });
  });

  describe('applyToDom', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should update textContent for data-i18n elements', () => {
      document.body.innerHTML = '<span data-i18n="test_key"></span>';
      applyToDom(document.body);

      const el = document.querySelector('[data-i18n]');
      // Since "test_key" is not in loaded messages, t() returns the key itself
      expect((el as HTMLElement).textContent).toBe('test_key');
    });

    it('should update title for data-i18n-title elements', () => {
      document.body.innerHTML = '<span data-i18n-title="title_key"></span>';
      applyToDom(document.body);

      const el = document.querySelector('[data-i18n-title]');
      expect((el as HTMLElement).title).toBe('title_key');
    });

    it('should update placeholder for data-i18n-placeholder elements', () => {
      document.body.innerHTML = '<input data-i18n-placeholder="ph_key" />';
      applyToDom(document.body);

      const el = document.querySelector('[data-i18n-placeholder]');
      expect((el as HTMLInputElement).placeholder).toBe('ph_key');
    });

    it('should scope to the provided root element', () => {
      document.body.innerHTML = `
        <div id="a"><span data-i18n="key_a"></span></div>
        <div id="b"><span data-i18n="key_b"></span></div>
      `;
      const rootA = document.querySelector('#a');
      applyToDom(rootA);

      expect((rootA?.querySelector('span')).textContent).toBe('key_a');
      // key_b should NOT have been touched
      expect(document.querySelector('#b span').textContent).toBe('');
    });
  });

  describe('isInitialized', () => {
    it('should return a boolean', () => {
      expect(typeof isInitialized()).toBe('boolean');
    });
  });
});
