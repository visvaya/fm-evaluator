// @vitest-environment jsdom
/**
 * Tests for LanguageConfigLoader
 *
 * LanguageConfigLoader fetches language configuration JSON files,
 * implements caching, deduplication of in-flight requests, and preloading.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import './languageConfigLoader.js';

let loader: any;

const mockConfig = (id: string) => ({
  headers: { basic_name: ['Name'], basic_uid: ['UID'] },
  id
});

beforeEach(() => {
  loader = new (window as any).LanguageConfigLoader();
  // Mock global fetch
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchFailure(status: number, statusText: string) {
  (fetch as any).mockResolvedValue({
    ok: false,
    status,
    statusText
  });
}

function mockFetchSuccess(config: any) {
  (fetch as any).mockResolvedValue({
    json: async () => config,
    ok: true
  });
}

describe('LanguageConfigLoader', () => {
  describe('loadLanguageConfig', () => {
    it('should fetch and return config for a language', async () => {
      const config = mockConfig('en');
      mockFetchSuccess(config);

      const result = await loader.loadLanguageConfig('en');
      expect(result).toEqual(config);
      expect(fetch).toHaveBeenCalledWith('/config/languages/en.json');
    });

    it('should cache the result after first load', async () => {
      const config = mockConfig('pl');
      mockFetchSuccess(config);

      await loader.loadLanguageConfig('pl');
      const result = await loader.loadLanguageConfig('pl');

      expect(result).toEqual(config);
      // fetch should only be called once (second call uses cache)
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent requests for the same language', async () => {
      const config = mockConfig('de');
      mockFetchSuccess(config);

      const [r1, r2] = await Promise.all([
        loader.loadLanguageConfig('de'),
        loader.loadLanguageConfig('de')
      ]);

      expect(r1).toEqual(config);
      expect(r2).toEqual(config);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on HTTP error', async () => {
      mockFetchFailure(404, 'Not Found');
      await expect(loader.loadLanguageConfig('xx')).rejects.toThrow(
        'Failed to load language config for xx: 404 Not Found'
      );
    });

    it('should throw on invalid config structure (missing headers)', async () => {
      (fetch as any).mockResolvedValue({
        json: async () => ({ id: 'bad' }), // no headers
        ok: true
      });
      await expect(loader.loadLanguageConfig('bad')).rejects.toThrow(
        'Invalid language config for bad'
      );
    });

    it('should throw on invalid config structure (missing id)', async () => {
      (fetch as any).mockResolvedValue({
        json: async () => ({ headers: {} }), // no id
        ok: true
      });
      await expect(loader.loadLanguageConfig('noid')).rejects.toThrow(
        'Invalid language config for noid'
      );
    });

    it('should reject configs with invalid nested header aliases', async () => {
      (fetch as any).mockResolvedValue({
        json: async () => ({
          headers: { basic_name: ['Name', ''] },
          id: 'broken'
        }),
        ok: true
      });

      await expect(loader.loadLanguageConfig('broken')).rejects.toThrow(
        'Invalid language config for broken'
      );
    });

    it('should clean up loading promise on failure', async () => {
      mockFetchFailure(500, 'Internal Server Error');

      await expect(loader.loadLanguageConfig('fail')).rejects.toThrow();
      // loadingPromises should be cleaned up
      expect(loader.loadingPromises.has('fail')).toBe(false);
    });

    it('should wrap fetch TypeError with CORS-friendly message', async () => {
      (fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(loader.loadLanguageConfig('cors')).rejects.toThrow(
        'Cannot load language config for cors'
      );
    });
  });

  describe('getCachedConfig', () => {
    it('should return null when not cached', () => {
      expect(loader.getCachedConfig('en')).toBeNull();
    });

    it('should return cached config after load', async () => {
      const config = mockConfig('en');
      mockFetchSuccess(config);

      await loader.loadLanguageConfig('en');
      expect(loader.getCachedConfig('en')).toEqual(config);
    });
  });

  describe('clearCache', () => {
    it('should clear specific language from cache', async () => {
      const config = mockConfig('en');
      mockFetchSuccess(config);

      await loader.loadLanguageConfig('en');
      loader.clearCache('en');
      expect(loader.getCachedConfig('en')).toBeNull();
    });

    it('should clear all languages when no argument', async () => {
      mockFetchSuccess(mockConfig('en'));
      await loader.loadLanguageConfig('en');

      mockFetchSuccess(mockConfig('pl'));
      await loader.loadLanguageConfig('pl');

      loader.clearCache();
      expect(loader.getCachedConfig('en')).toBeNull();
      expect(loader.getCachedConfig('pl')).toBeNull();
    });
  });

  describe('preloadConfigs', () => {
    it('should load multiple languages in parallel', async () => {
      const enConfig = mockConfig('en');
      const plConfig = mockConfig('pl');

      (fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('en.json')) return { json: async () => enConfig, ok: true };
        if (url.includes('pl.json')) return { json: async () => plConfig, ok: true };
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      const result = await loader.preloadConfigs(['en', 'pl']);
      expect(result.en).toEqual(enConfig);
      expect(result.pl).toEqual(plConfig);
    });

    it('should cache all preloaded configs', async () => {
      const enConfig = mockConfig('en');
      const plConfig = mockConfig('pl');

      (fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('en.json')) return { json: async () => enConfig, ok: true };
        if (url.includes('pl.json')) return { json: async () => plConfig, ok: true };
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      await loader.preloadConfigs(['en', 'pl']);
      expect(loader.getCachedConfig('en')).toEqual(enConfig);
      expect(loader.getCachedConfig('pl')).toEqual(plConfig);
    });
  });
});
