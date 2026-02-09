# Quick Setup Guide for Assessment Access Codes

## For Local Development

1. **Create `.env.local` file** (if it doesn't exist):
   ```bash
   touch .env.local
   ```

2. **Add the access codes**:
   ```bash
   echo "ASSESSMENT_ACCESS_CODES=HERMES-2026-BETA,ASSESS-EARLY-ACCESS,INVITE-TECH-EVAL" >> .env.local
   ```

3. **Restart your dev server**:
   ```bash
   npm run dev
   ```

4. **Test it**:
   - Navigate to `/assessment`
   - Enter code: `HERMES-2026-BETA`
   - Should grant access ✅

## For Production (Vercel/Netlify)

### Vercel
1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add new variable:
   - **Name**: `ASSESSMENT_ACCESS_CODES`
   - **Value**: `HERMES-2026-BETA,ASSESS-EARLY-ACCESS,INVITE-TECH-EVAL`
   - **Environment**: Production (or all)
4. Redeploy your application

### Netlify
1. Go to **Site settings** → **Environment variables**
2. Add new variable:
   - **Key**: `ASSESSMENT_ACCESS_CODES`
   - **Value**: `HERMES-2026-BETA,ASSESS-EARLY-ACCESS,INVITE-TECH-EVAL`
3. Trigger a new deploy

## Adding New Codes

Simply update the environment variable:

```bash
# Local (.env.local)
ASSESSMENT_ACCESS_CODES=HERMES-2026-BETA,ASSESS-EARLY-ACCESS,INVITE-TECH-EVAL,NEW-CODE-2026

# Production (via platform dashboard)
# Add the new code to the comma-separated list
```

No code changes needed! Just restart/redeploy.

## Security Notes

✅ **Codes are NOT in source code** - They're in environment variables
✅ **Rate limiting active** - 5 attempts per IP, 15-min lockout
✅ **Server-side only** - No client-side code exposure
✅ **IP tracking** - Prevents brute force attacks

⚠️ **Important**: Never commit `.env.local` to git!
