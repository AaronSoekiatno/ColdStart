# Onboarding Modal Refactor - Complete

## Changes Made

### 1. Removed Deleted Steps
- **Removed**: Steps 5, 8, 9, 10 (these were deleted but still referenced in code)
- **Valid Steps Now**: 1, 2, 3, 4, 6, 7, 11

### 2. Updated Step Type
```typescript
// Before:
const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11>(1);

// After:
const [step, setStep] = useState<1 | 2 | 3 | 4 | 6 | 7 | 11>(1);
```

### 3. Fixed Navigation Logic

#### GitHub Connection Flow
- **Before**: Step 7 (GitHub) → Step 8 (deleted, caused blank screen)
- **After**: Step 7 (GitHub) → Step 11 (Completion)

#### Back Button Logic
- Removed reference to step 8 in back button navigation
- Flow now correctly goes: 7 → 6 or 4 (depending on skipResumeUpload)

### 4. Fixed Progress Indicator
```typescript
// Before:
const steps = skipResumeUpload
  ? [1, 2, 3, 4, 7, 8, 11]
  : [1, 2, 3, 4, 6, 7, 8, 11];

// After:
const steps = skipResumeUpload
  ? [1, 2, 3, 4, 7, 11]
  : [1, 2, 3, 4, 6, 7, 11];
```

### 5. Disabled Step 8 UseEffects
- Commented out GitHub repo fetching logic (was for step 8)
- Commented out suggested matches fetching logic (was for step 8)
- These can be removed entirely in future cleanup

### 6. Fixed Type Assertions
- Updated all `setStep()` calls to only use valid step numbers
- Removed invalid step numbers from type assertions
- Fixed `targetStep` variable that was typed as `8 | 9`

## Complete Onboarding Flow

### With Resume Upload (Default):
```
Step 1: Objectives
  ↓
Step 2: Job Type
  ↓
Step 3: Role Types
  ↓
Step 4: Years of Experience
  ↓
Step 6: Resume Upload (optional, can skip)
  ↓
Step 7: GitHub Connection (auto-detected if signed up via GitHub)
  ↓
Step 11: Completion → Redirect to /matches
```

### Without Resume Upload (skipResumeUpload = true):
```
Step 1: Objectives
  ↓
Step 2: Job Type
  ↓
Step 3: Role Types
  ↓
Step 4: Years of Experience
  ↓
Step 7: GitHub Connection
  ↓
Step 11: Completion → Redirect to /matches
```

## Step Details

### Step 1: Objectives
- **Title**: "Welcome to Hermes!"
- **Question**: "Which of the following choices best describe your objective with Hermes?"
- **Input**: Multi-select checkboxes
- **Options**: Looking for a job, Exploring opportunities, Networking, Learning about startups

### Step 2: Job Type
- **Title**: "What type of position are you looking for?"
- **Input**: Single-select buttons
- **Options**: Full-Time, Part-Time, Internship

### Step 3: Role Types
- **Title**: "What roles are you interested in?"
- **Input**: Multi-select checkboxes
- **Options**: ML/AI Engineer, Data Engineer, DevOps, Frontend, Backend, Full Stack, Mobile, Security, QA, Design, Product Design, Other

### Step 4: Years of Experience
- **Title**: "How many years of experience do you have?"
- **Input**: Single-select buttons
- **Options**: 0-1 years, 1-3 years, 3-5 years, 5-10 years, 10+ years
- **Action**: Saves all onboarding data to database

### Step 6: Resume Upload (Optional)
- **Title**: "Upload your resume"
- **Input**: File upload (PDF, DOCX)
- **Actions**: Upload, Skip
- **Note**: Can be skipped entirely

### Step 7: GitHub Connection
- **Title**: "Connect your GitHub"
- **Input**: Connect GitHub button
- **States**:
  - Not connected: Shows connect button
  - Already connected: Shows success message with checkmark
- **Note**: Auto-detected if user signed up via GitHub

### Step 11: Completion
- **Title**: "You're all set!"
- **Action**: "View Matches" button → Redirects to /matches
- **Backend**: Marks `onboarding_completed = true` in database

## GitHub Sign-Up Integration

When users sign up via GitHub:
1. GitHub OAuth completes
2. Redirects to homepage (`/`)
3. `onAuthStateChange` detects new sign-in
4. Checks `/api/candidate/check-onboarding`
5. If `needsOnboarding: true`, shows OnboardingModal at step 1
6. User completes steps 1-4
7. Step 6 (Resume): Optional
8. Step 7 (GitHub): Auto-shows as "Already Connected" ✓
9. Clicking "Continue" on step 7 goes to step 11 (Completion)
10. Clicking "View Matches" redirects to `/matches`

## Bug Fixes

### Fixed: Blank Modal After GitHub Connection
- **Problem**: After step 7, modal tried to go to step 8 which had no UI
- **Solution**: Step 7 now goes directly to step 11 (Completion)

### Fixed: Invalid Step References
- **Problem**: Code referenced steps 5, 8, 9 which were deleted
- **Solution**: Removed all references and updated type definitions

### Fixed: Progress Indicator
- **Problem**: Showed 8 dots including deleted step 8
- **Solution**: Now shows 6 or 7 dots (depending on skipResumeUpload)

## Testing

### Test New User Flow:
1. Clear browser data or use incognito
2. Go to http://localhost:3000
3. Click "Sign up" → "Sign up with GitHub"
4. Complete GitHub authorization
5. **Expected**: OnboardingModal appears at step 1
6. Complete all steps
7. **Expected**: Redirected to /matches

### Test Returning User:
1. Sign out
2. Go to http://localhost:3000
3. Click "Sign in" → "Sign in with GitHub"
4. **Expected**: Directly redirected to /matches (no onboarding)

## Files Modified

1. `/components/modals/OnboardingModal.tsx`
   - Updated step type definition
   - Removed obsolete safeguard
   - Fixed all step references
   - Updated progress indicator
   - Fixed GitHub connection flow
   - Disabled step 8 useEffects

## Next Steps (Optional Cleanup)

1. **Remove commented code**: Delete the disabled useEffects for step 8
2. **Remove unused state**: `githubRepos`, `repoSelections`, `suggestedMatches` are no longer used
3. **Remove unused functions**: `handleRepoToggle`, `saveSelectedRepos`, etc.
4. **Simplify**: Consider removing the `skipResumeUpload` prop if always false

## TypeScript Errors Fixed

All TypeScript lint errors related to invalid step numbers have been resolved:
- ✅ Step type updated to only valid steps
- ✅ All `setStep()` calls use valid step numbers
- ✅ Progress indicator uses valid steps
- ✅ Type assertions updated
- ✅ `targetStep` variable removed
