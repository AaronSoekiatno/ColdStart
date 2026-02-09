# Verification Service Migration

## Overview
The GitHub verification service has been successfully migrated from a separate Express server to integrated Next.js API routes.

## What Changed

### Before:
- **Separate Express server** running on port 3001
- **Separate environment file** at `services/top-candidates/api/.env`
- **External service call** from admin panel to `http://localhost:3001/api/verifications`
- **Duplicate dependencies** and configuration

### After:
- **Integrated Next.js API route** at `/app/api/verifications/route.ts`
- **Unified environment variables** in `.env.local`
- **Internal API call** to `/api/verifications`
- **Shared dependencies** and configuration

## File Structure

### New Files Created:
```
/app/api/verifications/route.ts          # Main verification API endpoint
/services/verification/                   # Verification service modules
  ├── verification.ts                     # Core verification logic
  ├── github.ts                           # GitHub API integration
  ├── repositoryEvaluator.ts              # AI-powered code evaluation
  ├── storage.ts                          # Supabase storage integration
  ├── extraction.ts                       # Code extraction utilities
  ├── velocity.ts                         # Development velocity analysis
  ├── jobMatcher.ts                       # Job matching logic
  ├── types/                              # TypeScript type definitions
  └── utils/                              # Utility functions
```

### Modified Files:
```
/app/api/admin/github/verify/route.ts    # Updated to call local API
/.env.local                               # Added ANTHROPIC_MODEL
```

## Environment Variables

All verification-related environment variables are now in `.env.local`:

```bash
# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://npqjuljzpjvcqmrgpyqj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Anthropic Claude API (for code evaluation)
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# App URL (for internal API calls)
NEXT_PUBLIC_APP_URL=https://joinhermes.co/
```

## API Endpoints

### POST `/api/verifications`
Run comprehensive GitHub verification for a candidate.

**Request Body:**
```json
{
  "candidate_id": "uuid",
  "repository_ids": ["uuid", "uuid"],  // optional
  "assessment_data": {                  // optional
    "skillLevel": "junior|mid|senior",
    "technicalScore": 85,
    "codingScore": 90
  },
  "skip_ai": false                      // optional
}
```

**Response:**
```json
{
  "message": "Verification completed successfully",
  "verification_id": "uuid",
  "verification": {
    "verificationStatus": "verified|not_verified|needs_review",
    "criteria": { ... },
    "totalCriteriaPassed": 4,
    "totalCriteriaChecked": 5
  }
}
```

## How It Works

1. **Admin triggers verification** via `/api/admin/github/verify`
2. **Admin endpoint calls** `/api/verifications` (internal Next.js API route)
3. **Verification service**:
   - Fetches candidate's GitHub data
   - Analyzes repositories and commits
   - Uses Claude AI to evaluate code quality
   - Calculates verification score
   - Stores results in `github_verifications` table
4. **Results returned** to admin panel

## Benefits of Migration

1. **Simplified Deployment**: One server instead of two
2. **Unified Configuration**: Single `.env.local` file
3. **Better Development Experience**: No need to run separate service
4. **Reduced Complexity**: Fewer moving parts
5. **Easier Debugging**: All logs in one place
6. **Shared Dependencies**: No duplicate packages

## Deprecated

The following are no longer needed and can be removed:
- `services/top-candidates/api/` directory (Express server)
- Separate `npm run dev` command for verification service
- Port 3001 configuration
- `VERIFICATION_SERVICE_URL` environment variable

## Testing

To test the integrated verification:

1. **Start the main Next.js server**:
   ```bash
   npm run dev
   ```

2. **Access admin panel**:
   ```
   https://joinhermes.co/admin/candidates
   ```

3. **Click "Verify" on any candidate** with GitHub connected

4. **Monitor logs** in the main terminal for verification progress

## Production Deployment

No additional configuration needed! The verification service is now part of the main Next.js deployment.

Environment variables to ensure are set in production:
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
