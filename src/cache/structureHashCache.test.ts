import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getStructureHashCache,
  resetStructureHashCache,
  startAutoPrune,
  stopAutoPrune,
  StructureHashCache
} from './structureHashCache';

describe('StructureHashCache', () => {
  let cache: StructureHashCache;

  beforeEach(() => {
    cache = new StructureHashCache({ maxEntries: 5, ttlMs: 10000 });
  });

  describe('set / get', () => {
    it('should store and retrieve an entry', () => {
      cache.set(['Name', 'Club', 'Age'], 'hash-abc');
      const entry = cache.get(['Name', 'Club', 'Age']);
      expect(entry).not.toBeNull();
      expect(entry.hash).toBe('hash-abc');
    });

    it('should return null for missing entry', () => {
      expect(cache.get(['Unknown'])).toBeNull();
    });

    it('should generate same key regardless of header order', () => {
      cache.set(['B', 'A', 'C'], 'hash-1');
      const entry = cache.get(['C', 'A', 'B']);
      expect(entry).not.toBeNull();
      expect(entry.hash).toBe('hash-1');
    });

    it('should increment hitCount on get', () => {
      cache.set(['Name'], 'hash-x');
      cache.get(['Name']);
      cache.get(['Name']);
      const entry = cache.get(['Name']);
      expect(entry.hitCount).toBe(3);
    });

    it('should store correct headers copy', () => {
      const headers = ['A', 'B'];
      cache.set(headers, 'hash-y');
      headers.push('C'); // mutate original
      const entry = cache.get(['A', 'B']);
      expect(entry.headers).toEqual(['A', 'B']);
    });
  });

  describe('TTL expiration', () => {
    it('should return null for expired entry', () => {
      vi.useFakeTimers();
      const ttlCache = new StructureHashCache({ maxEntries: 5, ttlMs: 1000 });
      ttlCache.set(['Name'], 'hash-ttl');
      vi.advanceTimersByTime(1100);
      expect(ttlCache.get(['Name'])).toBeNull();
      vi.useRealTimers();
    });

    it('should call onEvict when entry expires on get', () => {
      vi.useFakeTimers();
      const onEvict = vi.fn();
      const ttlCache = new StructureHashCache({ maxEntries: 5, onEvict, ttlMs: 500 });
      ttlCache.set(['X'], 'hash-e');
      vi.advanceTimersByTime(600);
      ttlCache.get(['X']);
      expect(onEvict).toHaveBeenCalledTimes(1);
      expect(onEvict.mock.calls[0][0].hash).toBe('hash-e');
      vi.useRealTimers();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      for (let i = 0; i < 5; i++) {
        cache.set([`h${i}`], `hash-${i}`);
      }
      // Cache full (5). Add one more.
      cache.set(['h5'], 'hash-5');
      // h0 should be evicted (oldest)
      expect(cache.get(['h0'])).toBeNull();
      expect(cache.get(['h5'])).not.toBeNull();
    });

    it('should update access order on get', () => {
      for (let i = 0; i < 5; i++) {
        cache.set([`h${i}`], `hash-${i}`);
      }
      // Access h0 to make it most recent
      cache.get(['h0']);
      // Add new entry – should evict h1 (now oldest)
      cache.set(['h5'], 'hash-5');
      expect(cache.get(['h0'])).not.toBeNull();
      expect(cache.get(['h1'])).toBeNull();
    });

    it('should call onEvict callback on LRU eviction', () => {
      const onEvict = vi.fn();
      const c = new StructureHashCache({ maxEntries: 2, onEvict, ttlMs: 60000 });
      c.set(['a'], 'h1');
      c.set(['b'], 'h2');
      c.set(['c'], 'h3'); // evicts 'a'
      expect(onEvict).toHaveBeenCalledTimes(1);
      expect(onEvict.mock.calls[0][0].hash).toBe('h1');
    });
  });

  describe('collision detection', () => {
    it('should call onCollision when same headers get different hash', () => {
      const onCollision = vi.fn();
      const c = new StructureHashCache({ maxEntries: 5, onCollision, ttlMs: 60000 });
      c.set(['Name', 'Age'], 'hash-old');
      c.set(['Name', 'Age'], 'hash-new');
      expect(onCollision).toHaveBeenCalledTimes(1);
      expect(onCollision).toHaveBeenCalledWith('hash-old', 'hash-new', ['Name', 'Age']);
    });

    it('should not call onCollision when hash is the same', () => {
      const onCollision = vi.fn();
      const c = new StructureHashCache({ maxEntries: 5, onCollision, ttlMs: 60000 });
      c.set(['Name'], 'hash-same');
      c.set(['Name'], 'hash-same');
      expect(onCollision).not.toHaveBeenCalled();
    });
  });

  describe('has', () => {
    it('should return true for existing entry', () => {
      cache.set(['X'], 'h');
      expect(cache.has(['X'])).toBe(true);
    });

    it('should return false for missing entry', () => {
      expect(cache.has(['Y'])).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove an entry', () => {
      cache.set(['A'], 'h1');
      expect(cache.delete(['A'])).toBe(true);
      expect(cache.get(['A'])).toBeNull();
    });

    it('should return false for non-existent entry', () => {
      expect(cache.delete(['Z'])).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set(['A'], 'h1');
      cache.set(['B'], 'h2');
      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('prune', () => {
    it('should remove expired entries', () => {
      vi.useFakeTimers();
      const c = new StructureHashCache({ maxEntries: 10, ttlMs: 500 });
      c.set(['A'], 'h1');
      c.set(['B'], 'h2');
      vi.advanceTimersByTime(600);
      c.set(['C'], 'h3'); // not expired
      const pruned = c.prune();
      expect(pruned).toBe(2);
      expect(c.getStats().size).toBe(1);
      vi.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      cache.set(['A'], 'h1');
      cache.set(['B'], 'h2');
      cache.get(['A']);
      cache.get(['A']);
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxEntries).toBe(5);
      expect(stats.ttlMs).toBe(10000);
      expect(stats.totalHits).toBe(2);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });

    it('should return null timestamps for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });

  describe('entries', () => {
    it('should return iterable of all entries', () => {
      cache.set(['A'], 'h1');
      cache.set(['B'], 'h2');
      const all = [...cache.entries()];
      expect(all).toHaveLength(2);
    });
  });
});

describe('singleton / module-level functions', () => {
  beforeEach(() => {
    resetStructureHashCache();
  });

  afterEach(() => {
    stopAutoPrune();
    resetStructureHashCache();
  });

  it('getStructureHashCache should return same instance', () => {
    const a = getStructureHashCache();
    const b = getStructureHashCache();
    expect(a).toBe(b);
  });

  it('resetStructureHashCache should clear and null the singleton', () => {
    const c = getStructureHashCache();
    c.set(['X'], 'hash');
    resetStructureHashCache();
    const c2 = getStructureHashCache();
    expect(c2.getStats().size).toBe(0);
  });

  it('startAutoPrune should not throw', () => {
    expect(() => startAutoPrune(100)).not.toThrow();
  });

  it('stopAutoPrune should be idempotent', () => {
    stopAutoPrune();
    stopAutoPrune();
  });
});
