# GitHub OAuth Setup Guide

This guide explains how to configure GitHub OAuth for both localhost and production environments.

## Overview

GitHub OAuth is managed through Supabase. The application dynamically determines the correct redirect URL based on the request origin (`http://localhost:3000` for local, production URL for prod).

## Setup Steps

### 1. GitHub OAuth App Configuration

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click on your OAuth App (or create one if needed)
3. Configure the following:

**Application name:** Hermes (or your preferred name)

**Homepage URL:** 
- Production: `https://your-production-domain.com`
- (GitHub only allows one homepage URL, use production)

**Authorization callback URLs:** (Add BOTH)
```
http://localhost:3000/api/auth/github/callback
https://your-production-domain.com/api/auth/github/callback
```

4. Save your **Client ID** and **Client Secret**

### 2. Supabase Configuration

#### A. Enable GitHub Provider

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `npqjuljzpjvcqmrgpyqj`
3. Navigate to **Authentication** → **Providers**
4. Find **GitHub** and click to configure
5. Enable the provider
6. Enter your GitHub OAuth credentials:
   - **Client ID**: (from GitHub OAuth app)
   - **Client Secret**: (from GitHub OAuth app)
7. Click **Save**

#### B. Configure Redirect URLs

1. In Supabase Dashboard → **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL: `https://your-production-domain.com`
3. Add **Redirect URLs** (whitelist):
   ```
   http://localhost:3000/**
   https://your-production-domain.com/**
   ```

### 3. Environment Variables

Ensure these are set in both local and production:

**Local (`.env.local`):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://npqjuljzpjvcqmrgpyqj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Production (Vercel/Fly.io):**
Same variables as above, configured in your deployment platform's environment settings.

## How It Works

### Authentication Flow

1. User clicks "Connect GitHub" or "Sign in with GitHub"
2. App redirects to `/api/auth/github/connect` or `/api/auth/github/signin`
3. These routes call Supabase's `signInWithOAuth()` with:
   ```typescript
   redirectTo: `${requestUrl.origin}/api/auth/github/callback?redirect=...`
   scopes: 'repo,read:user'
   ```
4. Supabase redirects to GitHub for authorization
5. GitHub redirects back to `/api/auth/github/callback`
6. Callback route:
   - Exchanges code for session
   - Stores GitHub access token in `candidates` table
   - Fetches GitHub username
   - Optionally triggers repository sync
   - Redirects user back to the app

### Key Files

- `/app/api/auth/github/connect/route.ts` - GitHub connection during onboarding
- `/app/api/auth/github/signin/route.ts` - GitHub sign-in/sign-up
- `/app/api/auth/github/callback/route.ts` - OAuth callback handler
- `/components/modals/OnboardingModal.tsx` - Triggers GitHub connection
- `/components/modals/SignInModal.tsx` - GitHub sign-in button
- `/components/modals/SignUpModal.tsx` - GitHub sign-up button

## Testing

### Local Development

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Click "Connect GitHub" or "Sign in with GitHub"
4. Should redirect to GitHub, then back to localhost

**Expected flow:**
```
http://localhost:3000
  → /api/auth/github/signin
  → https://github.com/login/oauth/authorize?...
  → http://localhost:3000/api/auth/github/callback
  → http://localhost:3000/matches (or /onboarding)
```

### Production

1. Deploy to production
2. Navigate to your production URL
3. Click "Connect GitHub" or "Sign in with GitHub"
4. Should redirect to GitHub, then back to production URL

**Expected flow:**
```
https://your-domain.com
  → /api/auth/github/signin
  → https://github.com/login/oauth/authorize?...
  → https://your-domain.com/api/auth/github/callback
  → https://your-domain.com/matches (or /onboarding)
```

## Troubleshooting

### "Redirect URI mismatch" Error

**Cause:** The callback URL doesn't match what's configured in GitHub OAuth app

**Solution:**
1. Check GitHub OAuth app callback URLs include both localhost and production
2. Verify the exact URL format matches (including `/api/auth/github/callback`)

### Works in Production but Not Localhost

**Cause:** Localhost URL not added to GitHub OAuth app

**Solution:**
Add `http://localhost:3000/api/auth/github/callback` to GitHub OAuth app's callback URLs

### "Invalid redirect URL" from Supabase

**Cause:** URL not whitelisted in Supabase

**Solution:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add `http://localhost:3000/**` and your production URL to Redirect URLs

### Blank Screen After GitHub Authorization

**Cause:** Invalid OAuth scopes (we fixed this - was `rad:user` instead of `read:user`)

**Solution:**
- Already fixed in recent commits
- Scopes are now correctly set to `repo,read:user`

### GitHub Token Not Saved

**Cause:** Service role key not configured or callback handler error

**Solution:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in environment
2. Check logs in `/api/auth/github/callback` for errors
3. Ensure `candidates` table has GitHub-related columns

## Security Notes

1. **Never commit** GitHub Client Secret to version control
2. **Service Role Key** should only be used server-side (never exposed to client)
3. GitHub tokens are stored encrypted in Supabase `candidates` table
4. Tokens have `repo` and `read:user` scopes - only request what you need

## Recent Fixes

- ✅ Fixed typo: `rad:user` → `read:user` in OAuth scopes
- ✅ Added `redirectTo` parameter support in sign-in/sign-up modals
- ✅ Improved error handling in callback route
