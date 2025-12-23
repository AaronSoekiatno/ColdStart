/**
 * Simple in-memory cache utility with TTL support
 * Used to reduce database egress by caching frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number;
  private defaultTTL: number;

  /**
   * @param maxSize Maximum number of entries in cache (LRU eviction)
   * @param defaultTTL Default TTL in milliseconds
   */
  constructor(maxSize: number = 100, defaultTTL: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get a value from cache
   * @returns The cached value or undefined if not found/expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data as T;
  }

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional TTL in milliseconds (defaults to constructor default)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Evict oldest entry if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const freshData = await fetchFn();
    this.set(key, freshData, ttl);
    return freshData;
  }
}

// Singleton instances for different cache purposes
// Matches cache: 12 hour TTL, 100 entries (matches are generated overnight, don't need frequent refresh)
export const matchesCache = new MemoryCache(100, 12 * 60 * 60 * 1000);

// Startups cache: 10 minute TTL, 500 entries (startup data changes rarely)
export const startupsCache = new MemoryCache(500, 10 * 60 * 1000);

// Email limit cache: 1 minute TTL, 50 entries (needs to be relatively fresh)
export const emailLimitCache = new MemoryCache(50, 60 * 1000);

export default MemoryCache;
