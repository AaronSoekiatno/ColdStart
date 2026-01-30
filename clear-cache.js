// Clear Redis cache for a specific user - useful for testing
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error('❌ No REDIS_URL found in environment');
  process.exit(1);
}

async function clearCache() {
  const email = process.argv[2] || 'aidan.nt76@gmail.com';

  console.log(`🗑️  Clearing cache for: ${email}\n`);

  const redis = new Redis(redisUrl);

  try {
    const cacheKey = `candidate_info:${email}`;
    const deleted = await redis.del(cacheKey);

    if (deleted) {
      console.log(`✅ Cache cleared: ${cacheKey}`);
    } else {
      console.log(`ℹ️  No cache found for: ${cacheKey}`);
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
  } finally {
    await redis.quit();
  }
}

clearCache();
