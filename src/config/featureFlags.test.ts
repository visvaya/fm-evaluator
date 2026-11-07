// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FeatureFlags,
  type FeatureName,
  getFeatureFlags,
  isFeatureEnabled,
  killSwitchFeatures,
  killSwitchHeavyFeatures,
  setFeatureOverride
} from './featureFlags';

// Reset singleton between tests
let ff: FeatureFlags;

function resetSingleton() {
  // Access the module-level variable to reset it
  // We create a fresh instance each time via direct constructor
  ff = new FeatureFlags();
}

describe('FeatureFlags', () => {
  beforeEach(() => {
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('indexedDB', {});
    vi.stubGlobal('navigator', {
      ...navigator,
      connection: undefined,
      hardwareConcurrency: 8,
      language: 'en',
      languages: ['en'],
      onLine: true
    });
    localStorage.clear();
    resetSingleton();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('profile detection', () => {
    it('should detect full profile when cross-origin isolated + IDB', () => {
      expect(ff.getProfile()).toBe('full');
    });

    it('should detect ts-only when no cross-origin isolation', () => {
      vi.stubGlobal('crossOriginIsolated', false);
      ff = new FeatureFlags();
      expect(ff.getProfile()).toBe('ts-only');
    });

    it('should detect ts-only when no indexedDB', () => {
      vi.stubGlobal('indexedDB', undefined);
      ff = new FeatureFlags();
      expect(ff.getProfile()).toBe('ts-only');
    });

    it('should detect lite when saveData is true', () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        connection: { saveData: true },
        hardwareConcurrency: 8,
        language: 'en',
        languages: ['en'],
        onLine: true
      });
      ff = new FeatureFlags();
      expect(ff.getProfile()).toBe('lite');
    });

    it('should detect lite when slow connection', () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        connection: { effectiveType: 'slow-2g' },
        hardwareConcurrency: 8,
        language: 'en',
        languages: ['en'],
        onLine: true
      });
      ff = new FeatureFlags();
      expect(ff.getProfile()).toBe('lite');
    });

    it('should detect lite when low hardware concurrency', () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        connection: undefined,
        hardwareConcurrency: 2,
        language: 'en',
        languages: ['en'],
        onLine: true
      });
      ff = new FeatureFlags();
      expect(ff.getProfile()).toBe('lite');
    });
  });

  describe('isEnabled', () => {
    it('should enable structureHashCache by default (defaultState: enabled)', () => {
      expect(ff.isEnabled('structureHashCache')).toBe(true);
    });

    it('should disable webVitals by default (defaultState: disabled)', () => {
      expect(ff.isEnabled('webVitals')).toBe(false);
    });

    it('should enable workerParser in auto mode with full profile', () => {
      expect(ff.isEnabled('workerParser')).toBe(true);
    });

    it('should disable features requiring COOP when not isolated', () => {
      vi.stubGlobal('crossOriginIsolated', false);
      vi.stubGlobal('indexedDB', {});
      vi.stubGlobal('navigator', {
        ...navigator,
        connection: undefined,
        hardwareConcurrency: 8,
        language: 'en',
        languages: ['en'],
        onLine: true
      });
      ff = new FeatureFlags();
      expect(ff.isEnabled('pyodide')).toBe(false);
      expect(ff.isEnabled('ocr')).toBe(false);
      expect(ff.isEnabled('workerParser')).toBe(false);
    });

    it('should disable heavyViz when hwConcurrency < minHardwareConcurrency', () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        connection: undefined,
        hardwareConcurrency: 2,
        language: 'en',
        languages: ['en'],
        onLine: true
      });
      ff = new FeatureFlags();
      expect(ff.isEnabled('heavyViz')).toBe(false);
    });
  });

  describe('overrides', () => {
    it('should allow setting an override', () => {
      ff.setOverride('webVitals', 'enabled');
      expect(ff.isEnabled('webVitals')).toBe(true);
    });

    it('should allow disabling via override', () => {
      expect(ff.isEnabled('structureHashCache')).toBe(true);
      ff.setOverride('structureHashCache', 'disabled');
      expect(ff.isEnabled('structureHashCache')).toBe(false);
    });

    it('should clear an override with null', () => {
      ff.setOverride('webVitals', 'enabled');
      expect(ff.isEnabled('webVitals')).toBe(true);
      ff.setOverride('webVitals', null);
      expect(ff.isEnabled('webVitals')).toBe(false);
    });

    it('should clearOverride by name', () => {
      ff.setOverride('webVitals', 'enabled');
      ff.clearOverride('webVitals');
      expect(ff.isEnabled('webVitals')).toBe(false);
    });

    it('should clearAllOverrides', () => {
      ff.setOverride('webVitals', 'enabled');
      ff.setOverride('structureHashCache', 'disabled');
      ff.clearAllOverrides();
      expect(ff.isEnabled('webVitals')).toBe(false);
      expect(ff.isEnabled('structureHashCache')).toBe(true);
    });

    it('should persist override to localStorage', () => {
      ff.setOverride('webVitals', 'enabled');
      const stored = JSON.parse(localStorage.getItem('fm-feature-flags'));
      expect(stored.overrides.webVitals).toBe('enabled');
    });

    it('should not allow enabling when hard requirement missing (COOP)', () => {
      vi.stubGlobal('crossOriginIsolated', false);
      ff = new FeatureFlags();
      ff.setOverride('pyodide', 'enabled');
      // Hard requirement blocks even explicit enable
      expect(ff.isEnabled('pyodide')).toBe(false);
    });
  });

  describe('killSwitch', () => {
    it('should disable specified features', () => {
      ff.killSwitch(['beeswarm', 'radar']);
      expect(ff.isEnabled('beeswarm')).toBe(false);
      expect(ff.isEnabled('radar')).toBe(false);
    });

    it('killSwitchHeavy should disable pyodide, ocr, heavyViz, beeswarm, radar, pitch', () => {
      ff.killSwitchHeavy();
      const heavyFeatures: FeatureName[] = [
        'pyodide',
        'ocr',
        'heavyViz',
        'beeswarm',
        'radar',
        'pitch'
      ];
      for (const name of heavyFeatures) {
        expect(ff.isEnabled(name)).toBe(false);
      }
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on override change', () => {
      const spy = vi.fn();
      ff.subscribe(spy);
      ff.setOverride('webVitals', 'enabled');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const spy = vi.fn();
      const unsub = ff.subscribe(spy);
      unsub();
      ff.setOverride('webVitals', 'enabled');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getState / getDefinitions', () => {
    it('should return current state for a feature', () => {
      expect(ff.getState('structureHashCache')).toBe('enabled');
      expect(ff.getState('pyodide')).toBe('auto');
    });

    it('should return all definitions', () => {
      const defs = ff.getDefinitions();
      expect(defs.length).toBeGreaterThanOrEqual(10);
      expect(defs[0]).toHaveProperty('name');
      expect(defs[0]).toHaveProperty('description');
    });

    it('should return definition by name', () => {
      const def = ff.getDefinition('pyodide');
      expect(def).toBeDefined();
      expect(def.requiresCrossOriginIsolated).toBe(true);
    });

    it('should return undefined for unknown definition', () => {
      expect(ff.getDefinition('nonexistent' as FeatureName)).toBeUndefined();
    });
  });

  describe('getSnapshot', () => {
    it('should return a snapshot of current state', () => {
      const snapshot = ff.getSnapshot();
      expect(snapshot).toHaveProperty('flags');
      expect(snapshot).toHaveProperty('overrides');
      expect(snapshot).toHaveProperty('computed');
      expect(snapshot).toHaveProperty('profile');
      expect(snapshot).toHaveProperty('lastUpdated');
    });
  });

  describe('refresh', () => {
    it('should re-detect profile on refresh', () => {
      expect(ff.getProfile()).toBe('full');
      vi.stubGlobal('crossOriginIsolated', false);
      ff.refresh();
      expect(ff.getProfile()).toBe('ts-only');
    });

    it('should notify listeners when profile changes on refresh', () => {
      const spy = vi.fn();
      ff.subscribe(spy);
      vi.stubGlobal('crossOriginIsolated', false);
      ff.refresh();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should not notify when profile unchanged', () => {
      const spy = vi.fn();
      ff.subscribe(spy);
      ff.refresh();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('toDebugString', () => {
    it('should return formatted debug output', () => {
      const debug = ff.toDebugString();
      expect(debug).toContain('Profile:');
      expect(debug).toContain('Features:');
      expect(debug).toContain('pyodide');
      expect(debug).toContain('structureHashCache');
    });
  });

  describe('load from storage', () => {
    it('should load overrides from localStorage on init', () => {
      localStorage.setItem(
        'fm-feature-flags',
        JSON.stringify({
          overrides: { webVitals: 'enabled' }
        })
      );
      ff = new FeatureFlags();
      expect(ff.isEnabled('webVitals')).toBe(true);
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('fm-feature-flags', '{invalid json');
      expect(() => new FeatureFlags()).not.toThrow();
    });
  });
});
