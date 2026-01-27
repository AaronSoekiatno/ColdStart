# Environment Variables Architecture - Explained

## Your Question
> "If the docker contains all of the environment variables why are we passing so little?"

Great question! Here's what's actually happening:

## The Two Scenarios

### Scenario 1: Production (Fly.io) ✅ COMPLETE
When a user starts an interview via the web app:

```typescript
// 1. /api/topcandidates/provision returns credentials
{
  SUPABASE_URL: "https://xxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
  SUPABASE_PRIVATE_KEY: "eyJ...", // Schema-specific JWT
  GEMINI_BASE_URL: "https://yourapp.com/api/proxy/gemini"
}

// 2. /api/topcandidates/provision-container passes ALL to Fly.io
await fly.machines.launch({
  env: {
    CANDIDATE_ID: candidate.id,
    SESSION_ID: session.id,
    TELEMETRY_URL: appUrl,
    SUPABASE_URL: credentials.SUPABASE_URL,        // ✅ Passed
    SUPABASE_ANON_KEY: credentials.SUPABASE_ANON_KEY,  // ✅ Passed
    SUPABASE_PRIVATE_KEY: credentials.SUPABASE_PRIVATE_KEY, // ✅ Passed
    GEMINI_BASE_URL: credentials.GEMINI_BASE_URL   // ✅ Passed
  }
});

// 3. Container entrypoint.sh writes to .env.local
// All credentials available in workspace!
```

### Scenario 2: Local Dev (Your Current Setup) ⚠️ INCOMPLETE

When you run `./docker/start-assessment.sh test-user-123`:

```bash
# start-assessment.sh tries to pass variables:
docker run -d \
    -e "SUPABASE_URL=${SUPABASE_URL:-}" \    # ❌ Empty! Not set in your shell
    -e "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-}" \  # ❌ Empty!
    -e "SUPABASE_PRIVATE_KEY=${SUPABASE_PRIVATE_KEY:-}" \  # ❌ Empty!
    ...
```

The script **tries** to pass them, but they're **not set in your environment**, so they default to empty strings!

## Why This Happens

The `start-assessment.sh` script expects you to either:

**Option A:** Set environment variables before running:
```bash
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_ANON_KEY="eyJ..."
export SUPABASE_PRIVATE_KEY="eyJ..."
./docker/start-assessment.sh test-user-123
```

**Option B:** Call the provision API first to get credentials:
```bash
# This is what the web app does automatically
curl http://localhost:3000/api/topcandidates/provision
# Returns all credentials, then passes them to container
```

## The Architecture Decision

### Why Not Hardcode Credentials in the Container?

**Security!** You don't want:
- Supabase credentials baked into the Docker image
- API keys visible in `docker inspect`
- Secrets committed to Git

### Why Pass Via Environment Variables?

**Flexibility:**
- Each user gets their own schema-specific JWT
- Credentials can be rotated without rebuilding images
- Different environments (dev/staging/prod) use different keys

## What's Actually Missing in Your Local Setup

When you run the test script, you see:
```
⚠️  No credentials found in environment to inject
```

This means the container **didn't receive** the Supabase/API credentials, so it can't write them to `/workspace/.env.local`.

## The Solution for Local Development

### Quick Fix: Source .env.local

```bash
# 1. Load your app's environment variables
cd /Users/aidannguyen/Downloads/Hermes
source .env.local  # or: export $(cat .env.local | xargs)

# 2. Now run the container
./docker/start-assessment.sh test-user-123
```

### Better Fix: Enhanced Start Script

I can create an enhanced version that:
1. Calls `/api/topcandidates/provision` to get credentials
2. Passes them to the container automatically
3. Mimics the production flow

## Summary

| Environment | Credentials Source | Status |
|-------------|-------------------|--------|
| **Production (Fly.io)** | `/api/topcandidates/provision` → Container | ✅ Complete |
| **Local Dev (Manual)** | Your shell environment → Container | ⚠️ Incomplete |

The script **is designed** to pass all credentials, but in local dev, you need to provide them first!

---

## Want me to create an enhanced local dev script?

I can make a script that:
1. Authenticates as you
2. Calls the provision API
3. Gets all credentials
4. Passes them to the container automatically

This would match the production flow exactly!
