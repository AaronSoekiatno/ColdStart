import Redis from 'ioredis';

// Redis connection for persistent caching across serverless functions
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not configured, caching disabled');
    return null;
  }
  
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
      },
    });
    
    redis.on('error', (err: Error) => {
      console.error('[Redis] Connection error:', err);
    });
    
    console.log('[Redis] Connected successfully');
    return redis;
  } catch (error) {
    console.error('[Redis] Failed to connect:', error);
    return null;
  }
}

/**
 * Get cached data from Redis
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;
  
  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('[Redis] Get error:', error);
    return null;
  }
}

/**
 * Set data in Redis cache with TTL
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  
  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('[Redis] Set error:', error);
  }
}

/**
 * Delete cache key
 */
export async function deleteCache(key: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  
  try {
    await client.del(key);
  } catch (error) {
    console.error('[Redis] Delete error:', error);
  }
}
