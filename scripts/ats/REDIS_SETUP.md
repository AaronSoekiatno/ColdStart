# Redis Caching Setup Guide

This guide will walk you through setting up Redis caching for the ATS Filter using Upstash's free tier.

## Step 1: Create Upstash Redis Database (FREE)

1. **Go to Upstash**: https://upstash.com
2. **Sign up/Login** (free GitHub/Google auth)
3. **Create a new Redis database**:
   - Click "Create Database"
   - Name: `hermes-ats-cache` (or any name you want)
   - Type: **Regional** (cheaper, good for single region)
   - Region: Choose closest to your server (e.g., `us-west-1` if on Vercel/AWS US West)
   - **TLS**: Leave enabled (recommended)
   - Click "Create"

4. **Get your connection URL**:
   - On the database page, copy the **`UPSTASH_REDIS_REST_URL`**
   - It looks like: `rediss://default:xxxxx@flying-whale-12345.upstash.io:6379`

## Step 2: Add Environment Variables

Add these to your `.env.local` file:

```bash
# Redis Cache Configuration (Upstash)
REDIS_URL=rediss://default:xxxxx@flying-whale-12345.upstash.io:6379
CACHE_TTL_SECONDS=3600  # 1 hour (adjust as needed)
```

**TTL Recommendations:**
- `3600` (1 hour) - Default, good for most use cases
- `7200` (2 hours) - If resumes rarely change
- `1800` (30 min) - If you want fresher data

## Step 3: Install Python Dependencies

```bash
cd scripts/ats
pip install -r requirements.txt
```

This installs:
- `redis==5.0.1` - Redis client
- `hiredis==2.3.2` - Fast C parser for Redis (optional but recommended)

## step 4: Test the Cache

### Option A: Start the ATS API

```bash
cd scripts/ats
sh start_ats_api_dev.sh
```

You should see:
```
✓ Redis connection successful
✓ ATS Filter initialized successfully
```

### Option B: Test Directly

Create a test script:

```python
from cache_manager import CacheManager

cache = CacheManager()
print(f"Cache enabled: {cache.cache_enabled}")

# Test set/get
cache.set_resume_keywords("test-id", {"python", "javascript", "react"})
keywords = cache.get_resume_keywords("test-id")
print(f"Retrieved: {keywords}")
```

## Step 5: Verify Caching Works

### Check Cache Stats

Visit: `http://localhost:8001/api/cache-stats`

Expected response:
```json
{
  "success": true,
  "stats": {
    "enabled": true,
    "keyspace_hits": 42,
    "keyspace_misses": 15,
    "connected_clients": 1
  }
}
```

### Monitor Cache Hits in Logs

When running the ATS API, you'll see:
```
  ⚠️  Cache MISS for candidate abc-123  (first request)
  ✓ Cached keywords for candidate abc-123

  ✓ Cache HIT for candidate abc-123   (subsequent requests)
```

## Step 6: Integrate with Next.js

### Call Cache Warming After Resume Upload

In `app/api/resumes/upload/route.ts` (or wherever you handle uploads):

```typescript
// After uploading resume to Supabase
const candidateId = "...";

// Warm the cache (non-blocking)
fetch(`${process.env.ATS_API_URL}/api/warm-cache/${candidateId}`, {
  method: 'POST'
}).catch(err => console.error('Cache warming failed:', err));
```

### Call Cache Invalidation on Resume Update

```typescript
// After updating/deleting resume
fetch(`${process.env.ATS_API_URL}/api/invalidate-cache/${candidateId}`, {
  method: 'DELETE'
}).catch(err => console.error('Cache invalidation failed:', err));
```

## Upstash Free Tier Limits

- **Storage**: 256 MB
- **Bandwidth**: 10K requests/day
- **Connections**: 100 concurrent
- **Max Key Size**: 512 KB

### Estimated Usage (500 DAU):
- **Keys stored**: ~500 candidates × 5KB/candidate = 2.5 MB
- **Daily requests**: ~500 candidates × 10 matches/day = 5,000 requests
- **Cost**: **$0 (well within free tier)**

### When to Upgrade:
- **1,000-3,000 DAU**: Still free tier
- **3,000-5,000 DAU**: Consider Pro ($10/mo for 10GB + 1M commands/day)
- **5,000+ DAU**: Definitely Pro tier

## Troubleshooting

### "Failed to connect to Redis"
- Check your `REDIS_URL` is correct
- Verify Upstash database is active (not paused)
- Check TLS is enabled in URL (`rediss://` not `redis://`)

### Cache not working (always shows "Cache MISS")
- Check logs for "Redis connection successful"
- Verify `CACHE_TTL_SECONDS` is set
- Check Upstash dashboard for connection errors

### High cache miss rate
- Increase `CACHE_TTL_SECONDS` (e.g., to 7200 for 2 hours)
- Ensure cache warming is called after resume uploads
- Check if candidate IDs are consistent

## Performance Impact

### Before Caching (Baseline):
- **Resume keyword extraction**: ~200-500ms per candidate
- **10 job matches**: ~2-5 seconds total
- **100 concurrent users**: Likely slowdowns/timeouts

### After Caching (Expected):
- **First request (cache MISS)**: ~200-500ms (same as before)
- **Subsequent requests (cache HIT)**: ~5-10ms (50-100x faster!)
- **10 job matches**: ~50-100ms total (20-50x faster!)
- **100 concurrent users**: No problem (cache serves most requests)

## Next Steps

1. Deploy with Redis URL in production environment variables
2. Monitor cache hit rates in Upstash dashboard
3. Adjust TTL based on actual usage patterns
4. Consider adding cache warming for popular candidates
