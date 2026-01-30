# GitHub OAuth Setup Checklist

## ✅ Completed Steps

### 1. Supabase Configuration
- ✅ GitHub provider enabled in Supabase
- ✅ Client ID configured: `Ov23liTheiLi2ZADBI93`
- ✅ Client Secret configured: `c4cd2c4038fa48172d8785f2ecd5d83770eaceff`
- ✅ Callback URL: `https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback`

## 🔲 Remaining Steps

### 2. GitHub OAuth App Configuration

Go to: https://github.com/settings/developers

**Application Settings:**

```
Application name: Hermes
Homepage URL: https://www.joinhermes.co
Application description: AI-powered job matching platform for developers
```

**Authorization callback URLs** (Add ALL three):
```
https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback
http://localhost:3000/api/auth/github/callback
https://www.joinhermes.co/api/auth/github/callback
```

**Verify Credentials Match:**
- Client ID: `Ov23liTheiLi2ZADBI93`
- Client Secret: `c4cd2c4038fa48172d8785f2ecd5d83770eaceff`

### 3. Supabase URL Configuration

Go to: https://supabase.com/dashboard/project/npqjuljzpjvcqmrgpyqj/auth/url-configuration

**Site URL:**
```
https://www.joinhermes.co
```
(or `http://localhost:3000` for local testing)

**Redirect URLs:**
```
http://localhost:3000/**
https://www.joinhermes.co/**
```

### 4. Test the Integration

#### Local Testing:
1. Start dev server: `npm run dev`
2. Navigate to: http://localhost:3000
3. Click "Sign in with GitHub" or "Connect GitHub"
4. Should redirect to GitHub authorization
5. After authorizing, should redirect back to localhost

**Expected Flow:**
```
http://localhost:3000
  → /api/auth/github/signin
  → Supabase OAuth handler
  → https://github.com/login/oauth/authorize
  → https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback
  → http://localhost:3000/api/auth/github/callback
  → http://localhost:3000/matches (or /onboarding)
```

#### Production Testing:
1. Deploy to production
2. Navigate to: https://www.joinhermes.co
3. Click "Sign in with GitHub" or "Connect GitHub"
4. Should redirect to GitHub authorization
5. After authorizing, should redirect back to production

**Expected Flow:**
```
https://www.joinhermes.co
  → /api/auth/github/signin
  → Supabase OAuth handler
  → https://github.com/login/oauth/authorize
  → https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback
  → https://www.joinhermes.co/api/auth/github/callback
  → https://www.joinhermes.co/matches (or /onboarding)
```

## Troubleshooting

### "Redirect URI mismatch" Error
**Cause:** Callback URL not configured in GitHub OAuth app

**Solution:** 
1. Go to GitHub OAuth app settings
2. Verify all three callback URLs are added:
   - `https://npqjuljzpjvcqmrgpyqj.supabase.co/auth/v1/callback`
   - `http://localhost:3000/api/auth/github/callback`
   - `https://www.joinhermes.co/api/auth/github/callback`

### Blank Screen After Authorization
**Cause:** Invalid OAuth scopes (already fixed in code)

**Solution:** Already fixed - scopes are now `repo,read:user`

### "Invalid redirect URL" from Supabase
**Cause:** URL not whitelisted in Supabase

**Solution:**
1. Go to Supabase → Authentication → URL Configuration
2. Add to Redirect URLs:
   - `http://localhost:3000/**`
   - `https://www.joinhermes.co/**`

### GitHub Token Not Saved
**Cause:** Missing service role key or database error

**Solution:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
2. Check `/api/auth/github/callback` logs for errors
3. Verify `candidates` table has GitHub columns:
   - `github_access_token`
   - `github_refresh_token`
   - `github_username`
   - `github_connected_at`

## Environment Variables

Your `.env.local` should have (already configured):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://npqjuljzpjvcqmrgpyqj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** You do NOT need to add GitHub Client ID/Secret to `.env.local` - Supabase handles this.

## Production Deployment

When deploying to production (Vercel/Fly.io):

1. Set environment variables in your deployment platform:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Update Supabase Site URL to production:
   - Go to Supabase → Authentication → URL Configuration
   - Change Site URL to: `https://www.joinhermes.co`

3. Verify GitHub OAuth app has production callback URL:
   - `https://www.joinhermes.co/api/auth/github/callback`

## Quick Reference

**Supabase Project:** npqjuljzpjvcqmrgpyqj
**Production URL:** https://www.joinhermes.co
**Local URL:** http://localhost:3000

**GitHub OAuth App:**
- Client ID: `Ov23liTheiLi2ZADBI93`
- Managed at: https://github.com/settings/developers

**Supabase Dashboard:**
- https://supabase.com/dashboard/project/npqjuljzpjvcqmrgpyqj
