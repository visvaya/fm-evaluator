/**
 * Structure Hash Cache with TTL and LRU eviction
 * Caches parsed structure hashes to avoid re-computing for identical file structures
 */
import { type StructureHashCacheEntry, StructureHashCacheEntrySchema } from '../schema/contracts';
import { compareCodeUnits } from '../utils/compareCodeUnits';

export interface StructureHashCacheConfig {
  maxEntries: number;
  onCollision?: (existingHash: string, newHash: string, headers: string[]) => void;
  onEvict?: (entry: StructureHashCacheEntry) => void;
  ttlMs: number;
}

const DEFAULT_CONFIG: StructureHashCacheConfig = {
  maxEntries: 100,
  ttlMs: 30 * 60 * 1000 // 30 minutes
};

export class StructureHashCache {
  private accessOrder: string[] = [];
  private cache = new Map<string, StructureHashCacheEntry>();
  private config: StructureHashCacheConfig;

  constructor(config: Partial<StructureHashCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  delete(headers: string[]): boolean {
    const key = this.generateCacheKey(headers);
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    return this.cache.delete(key);
  }

  entries(): IterableIterator<[string, StructureHashCacheEntry]> {
    return this.cache.entries();
  }

  get(headers: string[]): null | StructureHashCacheEntry {
    const key = this.generateCacheKey(headers);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      const idx = this.accessOrder.indexOf(key);
      if (idx !== -1) {
        this.accessOrder.splice(idx, 1);
      }
      if (this.config.onEvict) {
        this.config.onEvict(entry);
      }
      return null;
    }

    // Update hit count and access order
    entry.hitCount++;
    this.updateAccessOrder(key);

    return entry;
  }

  getStats(): {
    maxEntries: number;
    newestEntry: null | number;
    oldestEntry: null | number;
    size: number;
    totalHits: number;
    ttlMs: number;
  } {
    let totalHits = 0;
    let oldestEntry: null | number = null;
    let newestEntry: null | number = null;

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      if (oldestEntry === null || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (newestEntry === null || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    return {
      maxEntries: this.config.maxEntries,
      newestEntry,
      oldestEntry,
      size: this.cache.size,
      totalHits,
      ttlMs: this.config.ttlMs
    };
  }

  has(headers: string[]): boolean {
    return this.get(headers) !== null;
  }

  prune(): number {
    return this.cleanExpired();
  }

  set(headers: string[], hash: string): StructureHashCacheEntry {
    const key = this.generateCacheKey(headers);
    const now = Date.now();

    // Check for collision (same headers, different hash)
    const existing = this.cache.get(key);
    if (existing && existing.hash !== hash && !this.isExpired(existing)) {
      if (this.config.onCollision) {
        this.config.onCollision(existing.hash, hash, headers);
      }
      console.warn(
        `[StructureHashCache] Hash collision detected for headers. ` +
          `Existing: ${existing.hash.slice(0, 16)}..., New: ${hash.slice(0, 16)}...`
      );
    }

    // Evict if at capacity
    if (!this.cache.has(key) && this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const entry: StructureHashCacheEntry = {
      createdAt: now,
      expiresAt: now + this.config.ttlMs,
      hash,
      headers: [...headers],
      hitCount: 0
    };

    // Validate entry with Zod
    const validation = StructureHashCacheEntrySchema.safeParse(entry);
    if (!validation.success) {
      console.error('[StructureHashCache] Invalid entry:', validation.error);
      throw new Error('Invalid cache entry');
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);

    return entry;
  }

  private cleanExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        const idx = this.accessOrder.indexOf(key);
        if (idx !== -1) {
          this.accessOrder.splice(idx, 1);
        }
        if (this.config.onEvict) {
          this.config.onEvict(entry);
        }
        cleaned++;
      }
    }

    return cleaned;
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const oldestKey = this.accessOrder.shift();
    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      if (entry && this.config.onEvict) {
        this.config.onEvict(entry);
      }
    }
  }

  private generateCacheKey(headers: string[]): string {
    return headers.toSorted(compareCodeUnits).join('|');
  }

  private isExpired(entry: StructureHashCacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  private updateAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(key);
  }
}

// Singleton instance with default config
let defaultInstance: null | StructureHashCache = null;

export function getStructureHashCache(
  config?: Partial<StructureHashCacheConfig>
): StructureHashCache {
  if (!defaultInstance) {
    defaultInstance = new StructureHashCache(config);
  }
  return defaultInstance;
}

export function resetStructureHashCache(): void {
  if (defaultInstance) {
    defaultInstance.clear();
  }
  defaultInstance = null;
}

// Auto-prune expired entries every 5 minutes
let pruneIntervalId: null | ReturnType<typeof setInterval> = null;

export function startAutoPrune(intervalMs = 5 * 60 * 1000): void {
  if (pruneIntervalId) return;
  pruneIntervalId = setInterval(() => {
    if (defaultInstance) {
      const pruned = defaultInstance.prune();
      if (pruned > 0) {
        console.log(`[StructureHashCache] Auto-pruned ${pruned} expired entries`);
      }
    }
  }, intervalMs);
}

export function stopAutoPrune(): void {
  if (pruneIntervalId) {
    clearInterval(pruneIntervalId);
    pruneIntervalId = null;
  }
}
