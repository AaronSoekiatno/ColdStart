# GitHub Sign-Up Onboarding Flow

## Overview

Users who sign up through GitHub now go through the same onboarding process as email/Google sign-ups.

## Flow Diagram

### New GitHub User (First Time):
```
User clicks "Sign up with GitHub"
  ↓
GitHub authorization
  ↓
Supabase creates auth user
  ↓
Redirect to app
  ↓
onAuthStateChange detects new sign-in
  ↓
Check /api/candidate/check-onboarding
  ↓
Response: { needsOnboarding: true }
  ↓
Show OnboardingModal
  ↓
User completes onboarding steps:
  1. Objectives
  2. Job Type
  3. Role Type
  4. Years of Experience
  5. Resume Upload
  6. GitHub Connection (auto-skip if already connected)
  ↓
Mark onboarding_completed = true
  ↓
Redirect to /matches
```

### Returning GitHub User (Already Onboarded):
```
User clicks "Sign in with GitHub"
  ↓
GitHub authorization
  ↓
Supabase validates existing user
  ↓
Redirect to app
  ↓
onAuthStateChange detects sign-in
  ↓
Check /api/candidate/check-onboarding
  ↓
Response: { needsOnboarding: false }
  ↓
Redirect to /matches (skip onboarding)
```

## Implementation Details

### 1. Auth State Change Handler
**File:** `components/landing/NewLandingPage.tsx`

```typescript
// For all new sign-ins (email, Google, GitHub), check if onboarding is needed
if (isNewSignIn && typeof window !== 'undefined') {
  // Check onboarding status for all new users
  const response = await fetch('/api/candidate/check-onboarding', {
    credentials: 'include',
  });
  
  if (response.ok) {
    const data = await response.json();
    if (data.needsOnboarding) {
      // New user needs onboarding - show the modal
      setShowOnboarding(true);
    } else {
      // Existing user who completed onboarding - go to matches
      router.push('/matches');
    }
  }
}
```

### 2. Onboarding Check Endpoint
**File:** `app/api/candidate/check-onboarding/route.ts`

Checks if user has:
- ✅ `job_type` (string, not empty)
- ✅ `role_type` (array with at least one item)
- ✅ `objectives` (array with at least one item)
- ✅ `years_of_experience` (string, not empty)
- ✅ `onboarding_completed` (boolean, true)

If ANY of these are missing or invalid, returns `{ needsOnboarding: true }`

### 3. GitHub Connection Step
**File:** `components/modals/OnboardingModal.tsx`

- If user signed up via GitHub, they already have GitHub connected
- The onboarding modal will auto-detect this and skip the GitHub connection step
- Or show it as already connected

## Testing

### Test New GitHub Sign-Up:

1. **Clear your browser data** (or use incognito)
2. Go to http://localhost:3000
3. Click "Sign up"
4. Click "Sign up with GitHub"
5. Authorize the app on GitHub
6. **Expected:** OnboardingModal appears
7. Complete all onboarding steps
8. **Expected:** Redirected to /matches

### Test Returning GitHub User:

1. Sign out
2. Go to http://localhost:3000
3. Click "Sign in"
4. Click "Sign in with GitHub"
5. **Expected:** Immediately redirected to /matches (no onboarding)

## Edge Cases Handled

### 1. User Signs Up with GitHub, Then Closes Browser Mid-Onboarding
- ✅ Next time they sign in, onboarding modal appears again
- ✅ They can complete where they left off

### 2. User Signs Up with Email, Then Connects GitHub During Onboarding
- ✅ GitHub connection is saved
- ✅ Onboarding continues normally

### 3. User Signs Up with GitHub, Completes Onboarding, Then Signs In Again
- ✅ Goes directly to /matches
- ✅ No onboarding modal shown

### 4. API Error When Checking Onboarding Status
- ✅ Defaults to showing onboarding (safe fallback)
- ✅ Better to show onboarding unnecessarily than skip it

## Database Schema

The `candidates` table tracks onboarding completion:

```sql
CREATE TABLE candidates (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  
  -- Onboarding fields
  objectives TEXT[],
  job_type TEXT,
  role_type TEXT[],
  years_of_experience TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  -- GitHub OAuth fields
  github_access_token TEXT,
  github_username TEXT,
  github_connected_at TIMESTAMP,
  
  -- Other fields...
);
```

## Benefits

1. **Consistent Experience**: All users go through the same onboarding, regardless of sign-up method
2. **Better Data Quality**: Ensures we collect objectives, job type, role type, and experience from all users
3. **Improved Matching**: Can't skip to matches without providing preferences
4. **GitHub Integration**: GitHub sign-ups automatically have GitHub connected after onboarding

## Future Improvements

- [ ] Pre-fill onboarding data from GitHub profile (name, location, etc.)
- [ ] Show "Already connected" badge on GitHub step for GitHub sign-ups
- [ ] Add analytics to track onboarding completion rates by sign-up method
