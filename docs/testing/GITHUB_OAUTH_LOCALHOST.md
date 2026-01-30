# Testing GitHub OAuth on Localhost

## Quick Setup Guide

### Step 1: Configure Supabase OAuth Settings

1. **Go to Supabase Dashboard**:
   - Navigate to: https://supabase.com/dashboard
   - Select your project
   - Go to **Authentication** → **URL Configuration**

2. **Add Localhost URLs**:
   
   **IMPORTANT**: Keep your Site URL as production! Only add localhost to Redirect URLs.
   
   **Site URL** (keep as production):
   ```
   https://your-production-domain.com
   ```
   
   **Redirect URLs** (add BOTH production and localhost):
   ```
   https://your-production-domain.com/**
   http://localhost:3000/**
   ```
   
   The wildcard `/**` allows any path under that domain.

3. **Save Changes**

   ✅ Now both production and localhost will work simultaneously!

### Step 2: Verify Environment Variables

Make sure your `.env.local` file has:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Step 3: Test the Flow

1. **Start your dev server** (already running):
   ```bash
   npm run dev
   ```

2. **Test GitHub Sign-In**:
   - Go to `http://localhost:3000`
   - Click "Apply" or "Get Started"
   - Choose "Sign in with GitHub"
   - You'll be redirected to GitHub
   - After authorization, you'll be redirected back to `http://localhost:3000/api/auth/github/callback`
   - Then redirected to the onboarding flow or matches page

3. **Test GitHub Connect (during onboarding)**:
   - Go through onboarding
   - When you reach the GitHub connection step
   - Click "Connect GitHub"
   - Same flow as above

### Step 4: Debugging

If you encounter issues, check:

1. **Browser Console**: Look for any errors
2. **Server Logs**: Check your terminal running `npm run dev`
3. **Supabase Logs**: Go to Supabase Dashboard → Logs → Auth Logs

Common issues:
- **"Invalid redirect URL"**: Make sure you added `http://localhost:3000/**` to Supabase redirect URLs
- **"Unauthorized"**: Clear cookies and try again
- **Infinite redirect loop**: Check that `onboarding_completed` logic is working correctly

### Alternative: Test with Production URL

If you don't want to modify Supabase settings, you can:

1. Deploy your changes to production
2. Test on your production URL
3. Once verified, you can add localhost URLs for future testing

### Rollback Instructions

If you need to remove localhost URLs after testing:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Remove the localhost URLs
3. Set Site URL back to your production URL
