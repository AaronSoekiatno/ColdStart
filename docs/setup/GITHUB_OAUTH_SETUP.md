# GitHub OAuth Setup Guide

This guide explains how to set up GitHub OAuth integration for local development to enable users to connect their GitHub accounts.

## Prerequisites

1. GitHub account
2. Local Supabase instance running
3. Next.js development server

## Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "OAuth Apps" in the left sidebar
3. Click "New OAuth App"
4. Fill in the application details:
   - **Application name**: "Hermes Local" (or any name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: 
     - For local Supabase: `http://127.0.0.1:54321/auth/v1/callback`
     - Or check your Supabase local URL (usually `http://127.0.0.1:54321` or `http://localhost:54321`)
5. Click "Register application"
6. Copy your credentials:
   - **Client ID** (shown immediately)
   - **Client secret** (click "Generate a new client secret" if needed)

## Step 2: Configure Supabase Local Environment

The GitHub OAuth configuration is already added to `supabase/config.toml`. You need to set the environment variables that Supabase will use.

### Option A: Using Supabase CLI Environment Variables

Create or update your `.env` file in the project root (or wherever Supabase CLI reads environment variables):

```env
# GitHub OAuth for Supabase Auth
SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=your_github_client_id_here
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=your_github_client_secret_here
```

### Option B: Using Supabase Local Environment

If you're running Supabase locally, you may need to set these in your Supabase environment. Check your Supabase CLI documentation for how to set environment variables.

You can also set them when starting Supabase:

```bash
SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=your_client_id \
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=your_client_secret \
supabase start
```

## Step 3: Restart Supabase

After setting the environment variables, restart your local Supabase instance:

```bash
supabase stop
supabase start
```

Or if you're using Docker directly:

```bash
docker-compose down
docker-compose up -d
```

## Step 4: Verify Configuration

1. Check that GitHub OAuth is enabled in `supabase/config.toml`:
   ```toml
   [auth.external.github]
   enabled = true
   client_id = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID)"
   secret = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
   ```

2. Verify redirect URLs are configured in `supabase/config.toml`:
   ```toml
   additional_redirect_urls = [
     "http://localhost:3000",
     "http://127.0.0.1:3000",
     "http://localhost:3000/api/auth/github/callback",
     "http://127.0.0.1:3000/api/auth/github/callback"
   ]
   ```

## Step 5: Test the Integration

1. Start your Next.js development server:
   ```bash
   npm run dev
   ```

2. Start your Supabase local instance (if not already running):
   ```bash
   supabase start
   ```

3. Sign in to your app (if not already signed in)

4. Navigate to the onboarding flow or wherever the GitHub connect button is

5. Click "Connect GitHub" - you should be redirected to GitHub's authorization page

6. Authorize the application

7. You should be redirected back to your app with GitHub connected

## Troubleshooting

### "Failed to initiate GitHub connection" error

- **Check environment variables**: Ensure `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET` are set correctly
- **Restart Supabase**: After setting environment variables, you must restart Supabase
- **Check Supabase logs**: Run `supabase logs` to see if there are any errors

### Button does nothing / No redirect

- **GitHub OAuth not configured**: Check that `[auth.external.github]` is enabled in `supabase/config.toml`
- **Environment variables not loaded**: Ensure Supabase can access the environment variables
- **Wrong Supabase URL**: Verify `NEXT_PUBLIC_SUPABASE_URL` points to your local Supabase instance (usually `http://127.0.0.1:54321`)

### "Redirect URI mismatch" error from GitHub

- **Check callback URL**: The callback URL in your GitHub OAuth app must match Supabase's callback URL
- **Local Supabase URL**: Usually `http://127.0.0.1:54321/auth/v1/callback` or `http://localhost:54321/auth/v1/callback`
- **Check Supabase port**: Run `supabase status` to see your local Supabase URL

### GitHub info not updating in database

- **Check callback route**: Verify `/api/auth/github/callback` is working
- **Check Supabase connection**: Ensure your app can connect to Supabase
- **Check browser console**: Look for errors in the browser console
- **Check server logs**: Look for errors in your Next.js server logs

### Environment variables not working

If Supabase isn't picking up the environment variables:

1. **Check Supabase CLI version**: Update to the latest version
2. **Use `.env` file**: Some Supabase CLI versions read from `.env` in the project root
3. **Check Supabase config**: Verify the config.toml uses `env()` syntax correctly
4. **Manual config**: As a last resort, you can hardcode values in `config.toml` (NOT recommended for production)

## How It Works

1. User clicks "Connect GitHub" button
2. App calls `/api/auth/github/connect`
3. Route uses `supabase.auth.signInWithOAuth({ provider: 'github' })`
4. Supabase redirects to GitHub OAuth authorization page
5. User authorizes the application
6. GitHub redirects back to Supabase callback URL
7. Supabase exchanges code for tokens
8. Supabase redirects to `/api/auth/github/callback` with the session
9. Callback route extracts GitHub token from session
10. Callback route stores GitHub info in `candidates` table
11. User is redirected back to the app with success status

## Production Setup

For production, you'll need to:

1. Create a production GitHub OAuth App with production callback URLs
2. Set environment variables in your production Supabase project (via Supabase Dashboard)
3. Update `supabase/config.toml` for production (if using self-hosted Supabase)
4. Ensure production redirect URLs are in `additional_redirect_urls`

## Security Notes

- Never commit GitHub OAuth secrets to git
- Use environment variables for all secrets
- GitHub tokens are stored in the `candidates` table
- Tokens expire after 7 hours (as configured in the callback route)
- Users can revoke access from their GitHub settings

