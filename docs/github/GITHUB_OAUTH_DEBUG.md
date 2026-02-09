# GitHub OAuth Debugging Checklist

## Error: "Unable to exchange external code"

This error means Supabase couldn't complete the OAuth flow with GitHub.

## Common Causes & Fixes:

### 1. Client ID/Secret Mismatch ⚠️ MOST COMMON

**Check:**
- GitHub OAuth app Client ID matches Supabase exactly
- GitHub OAuth app Client Secret matches Supabase exactly
- No extra spaces or characters when copying

**How to verify:**

**In GitHub:**
1. Go to: https://github.com/settings/developers
2. Click on "Hermes" OAuth app
3. Copy the Client ID (should start with "Ov" or "Iv")
4. Generate a NEW Client Secret (old one might be wrong)

**In Supabase:**
1. Go to: https://supabase.com/dashboard/project/npqjuljzpjvcqmrgpyqj/auth/providers
2. Click "GitHub"
3. Paste the EXACT Client ID from GitHub
4. Paste the NEW Client Secret from GitHub
5. Click "Save"

### 2. Callback URL Mismatch

**Check GitHub OAuth app has this EXACT callback URL:**
```
https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback
```

**NOT:**
- ❌ http://localhost:3000/api/auth/github/callback
- ❌ https://www.joinhermes.co/api/auth/github/callback
- ✅ https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback

### 3. OAuth App Belongs to Wrong Account

**Check:**
- Is the OAuth app under your friend's account or yours?
- If it was transferred, did you update the Client Secret after transfer?
- GitHub regenerates secrets on transfer sometimes

### 4. Rate Limiting

**Check:**
- Have you tried multiple times in quick succession?
- Wait 1-2 minutes and try again

## Step-by-Step Fix:

1. **Get fresh credentials from GitHub:**
   - Go to GitHub OAuth app settings
   - Copy Client ID
   - Click "Generate a new client secret"
   - Copy the new secret immediately

2. **Update Supabase:**
   - Go to Supabase → Authentication → Providers → GitHub
   - Paste new Client ID
   - Paste new Client Secret
   - Click "Save"

3. **Verify callback URL in GitHub:**
   - Should be: `https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback`

4. **Clear browser cache and try again:**
   - Open incognito/private window
   - Try signing in with GitHub again

## Still Not Working?

Check these:

**GitHub OAuth App Settings:**
- Application name: Hermes
- Homepage URL: https://www.joinhermes.co
- Authorization callback URL: https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback
- ✅ "Enable Device Flow" can be unchecked

**Supabase Settings:**
- GitHub provider is enabled (toggle is ON)
- Client ID matches GitHub exactly
- Client Secret matches GitHub exactly
- Callback URL shows: https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback

## Test Again:

After making changes:
1. Wait 30 seconds for Supabase to update
2. Open a new incognito window
3. Go to http://localhost:3000
4. Try "Sign in with GitHub" again
