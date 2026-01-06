/**
 * API Key Pool Manager
 * 
 * Manages a rotated pool of Google API keys to prevent rate limiting
 * and enable key rotation. Supports both comma-separated pool and
 * individual key environment variables.
 */

interface KeyUsage {
  key: string;
  usageCount: number;
  lastUsed: Date;
}

class ApiKeyPool {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private usage: Map<string, KeyUsage> = new Map();

  constructor() {
    this.initializeKeys();
  }

  /**
   * Initialize keys from environment variables
   * Supports:
   * - GEMINI_API_KEY_POOL (comma-separated)
   * - GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc. (individual keys)
   * - GEMINI_API_KEY (fallback single key)
   */
  private initializeKeys(): void {
    // Try comma-separated pool first
    const poolEnv = process.env.GEMINI_API_KEY_POOL;
    if (poolEnv) {
      this.keys = poolEnv
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0);
    }

    // If no pool, try individual keys (GEMINI_API_KEY_1, GEMINI_API_KEY_2, ...)
    if (this.keys.length === 0) {
      let index = 1;
      while (true) {
        const key = process.env[`GEMINI_API_KEY_${index}`];
        if (!key) break;
        this.keys.push(key.trim());
        index++;
      }
    }

    // Fallback to single key
    if (this.keys.length === 0) {
      const singleKey = process.env.GEMINI_API_KEY;
      if (singleKey) {
        this.keys.push(singleKey.trim());
      }
    }

    // Initialize usage tracking
    this.keys.forEach(key => {
      this.usage.set(key, {
        key,
        usageCount: 0,
        lastUsed: new Date(0), // Epoch
      });
    });

    if (this.keys.length === 0) {
      console.warn(
        '[ApiKeyPool] No API keys found. Set GEMINI_API_KEY_POOL, ' +
        'GEMINI_API_KEY_1/GEMINI_API_KEY_2, or GEMINI_API_KEY environment variable.'
      );
    } else {
      console.log(`[ApiKeyPool] Initialized with ${this.keys.length} key(s)`);
    }
  }

  /**
   * Get the next available API key using round-robin selection
   * @returns API key string
   * @throws Error if no keys are available
   */
  getNextKey(): string {
    if (this.keys.length === 0) {
      throw new Error(
        'No API keys available in pool. ' +
        'Please configure GEMINI_API_KEY_POOL or GEMINI_API_KEY environment variables.'
      );
    }

    // Round-robin selection
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;

    // Update usage tracking
    const usage = this.usage.get(key);
    if (usage) {
      usage.usageCount++;
      usage.lastUsed = new Date();
    }

    return key;
  }

  /**
   * Get a random key from the pool
   * @returns API key string
   * @throws Error if no keys are available
   */
  getRandomKey(): string {
    if (this.keys.length === 0) {
      throw new Error(
        'No API keys available in pool. ' +
        'Please configure GEMINI_API_KEY_POOL or GEMINI_API_KEY environment variables.'
      );
    }

    const randomIndex = Math.floor(Math.random() * this.keys.length);
    const key = this.keys[randomIndex];

    // Update usage tracking
    const usage = this.usage.get(key);
    if (usage) {
      usage.usageCount++;
      usage.lastUsed = new Date();
    }

    return key;
  }

  /**
   * Get usage statistics for all keys
   * @returns Array of key usage information
   */
  getUsageStats(): KeyUsage[] {
    return Array.from(this.usage.values());
  }

  /**
   * Get the total number of keys in the pool
   * @returns Number of keys
   */
  getKeyCount(): number {
    return this.keys.length;
  }

  /**
   * Check if the pool has any keys
   * @returns True if keys are available
   */
  hasKeys(): boolean {
    return this.keys.length > 0;
  }
}

// Singleton instance
let poolInstance: ApiKeyPool | null = null;

/**
 * Get the API key pool instance (singleton)
 * @returns ApiKeyPool instance
 */
export function getApiKeyPool(): ApiKeyPool {
  if (!poolInstance) {
    poolInstance = new ApiKeyPool();
  }
  return poolInstance;
}

/**
 * Get the next available API key (convenience function)
 * @returns API key string
 * @throws Error if no keys are available
 */
export function getNextApiKey(): string {
  return getApiKeyPool().getNextKey();
}

