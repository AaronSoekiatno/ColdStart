/**
 * Session Cache Layer
 * 
 * LRU cache to minimize Supabase egress costs by keeping
 * hot session data in memory during active interviews.
 */

import { LRUCache } from 'lru-cache';

// Cache configuration
const CACHE_OPTIONS = {
    max: 500, // Maximum 500 active sessions in cache
    ttl: 1000 * 60 * 30, // 30 minutes TTL
    updateAgeOnGet: true, // Reset TTL on access (keep active sessions hot)
    updateAgeOnHas: false,
    allowStale: false
};

// Create cache instance
const sessionCache = new LRUCache(CACHE_OPTIONS);

/**
 * Cache operations
 */
export const cache = {
    /**
     * Get session from cache
     */
    get(sessionId) {
        return sessionCache.get(sessionId);
    },

    /**
     * Set session in cache
     */
    set(sessionId, sessionData) {
        sessionCache.set(sessionId, sessionData);
        return sessionData;
    },

    /**
     * Check if session exists in cache
     */
    has(sessionId) {
        return sessionCache.has(sessionId);
    },

    /**
     * Delete session from cache
     */
    delete(sessionId) {
        sessionCache.delete(sessionId);
    },

    /**
     * Clear entire cache
     */
    clear() {
        sessionCache.clear();
    },

    /**
     * Get cache statistics
     */
    stats() {
        return {
            size: sessionCache.size,
            maxSize: CACHE_OPTIONS.max,
            hitRate: sessionCache.calculatedSize / (sessionCache.calculatedSize + sessionCache.missCount || 1)
        };
    },

    /**
     * Update specific fields without replacing entire session
     */
    update(sessionId, updates) {
        const cached = sessionCache.get(sessionId);
        if (cached) {
            const updated = { ...cached, ...updates };
            sessionCache.set(sessionId, updated);
            return updated;
        }
        return null;
    }
};

export default cache;
