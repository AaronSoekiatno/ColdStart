# GitHub Analysis Integration - Implementation Summary

## Overview

This implementation adds GitHub repository analysis to the Hermes onboarding flow. After candidates select their repositories in step 8, the system automatically analyzes their code in the background without blocking the user experience.

## Architecture

**No microservice required!** The implementation calls GitHub APIs directly from Next.js API routes.

### Flow

1. **Onboarding (Step 8)** - User selects repositories
2. **Trigger** - Fire-and-forget API call to `/api/github/analyze/batch`
3. **Background Processing** - Fetches language data from GitHub API
4. **Storage** - Saves analysis results to Supabase
5. **Display** - Companies see results in match cards

## Implementation Details

### 1. API Endpoints

#### `/app/api/github/analyze/batch/route.ts`
**Purpose:** Trigger background analysis for selected repositories

**How it works:**
- Validates candidate has GitHub OAuth token
- Fetches repository metadata from database
- Spawns background process to analyze each repo
- Returns immediately (fire-and-forget)
- Never blocks user flow

**Background process:**
- Fetches language data from `https://api.github.com/repos/{owner}/{repo}/languages`
- Calculates quality score based on:
  - Code size (logarithmic scale)
  - Language diversity (more languages = higher score)
  - Popular language bonus (TypeScript, Python, Go, etc.)
- Stores results in `github_code_analyses` table

#### `/app/api/github/analyze/status/route.ts`
**Purpose:** Check analysis progress

**Returns:**
```json
{
  "status": "completed",
  "progress": 100,
  "total_repositories": 5,
  "completed_repositories": 5,
  "failed_repositories": 0
}
```

#### `/app/api/github/analyze/results/[candidate_id]/route.ts`
**Purpose:** Fetch completed analysis results

**Returns:**
```json
{
  "repositories": [...],
  "aggregate_stats": {
    "total_repositories": 5,
    "top_languages": [
      { "language": "TypeScript", "bytes": 45000, "percentage": 45 },
      { "language": "Python", "bytes": 30000, "percentage": 30 }
    ],
    "average_quality_score": 78
  },
  "has_results": true
}
```

### 2. Database Schema

**Three new tables:**

```sql
-- Stores repository metadata
github_repositories (
  id, candidate_id, github_repo_id, name, full_name,
  language, languages, stargazers_count, is_selected, ...
)

-- Tracks analysis status
github_code_extracts (
  id, candidate_id, repository_id,
  extraction_status, error_message, ...
)

-- Stores analysis results
github_code_analyses (
  id, candidate_id, repository_id,
  overall_score, code_quality_metrics, ...
)
```

**Migration files:**
- `062_create_github_analysis_tables.sql` - Creates tables and RLS policies
- `063_add_github_oauth_to_candidates.sql` - Adds GitHub OAuth fields to candidates

### 3. Frontend Integration

#### OnboardingModal (`components/modals/OnboardingModal.tsx`)
Added `triggerGitHubAnalysis()` function that:
- Runs after repository selection in step 8
- Fires API call in background (doesn't await)
- Never blocks user progression to assessment

#### Matches Page (`app/matches/page.tsx`)
- Fetches analysis data on page load
- Passes data to MatchCard component
- Handles missing data gracefully

#### MatchCard Component (`components/features/matches/MatchCard.tsx`)
Displays analysis in beautiful card format:
- **Aggregate stats**: Total repos, quality score, top language
- **Language breakdown**: Top 5 languages with percentages
- **Repository list**: First 5 repos with scores and stars
- **Pending state**: Shows "processing..." if not complete

## Key Features

✅ **Direct GitHub API calls** - No microservice dependency
✅ **Non-blocking** - Never interrupts user flow
✅ **Fire-and-forget** - Background processing
✅ **Graceful degradation** - Works even if GitHub API is down
✅ **Beautiful UI** - Professional display with gradients and badges
✅ **Real-time data** - Fetches from GitHub API on demand

## Setup Instructions

### 1. Run Database Migrations

```bash
# Apply migrations to create tables
npx supabase db push

# Or run migrations manually
psql $DATABASE_URL -f supabase/migrations/062_create_github_analysis_tables.sql
psql $DATABASE_URL -f supabase/migrations/063_add_github_oauth_to_candidates.sql
```

### 2. Environment Variables

No additional environment variables needed! The implementation uses:
- `NEXT_PUBLIC_SUPABASE_URL` (already configured)
- `SUPABASE_SERVICE_ROLE_KEY` (already configured)
- GitHub OAuth token (stored in database per user)

### 3. Testing

1. **Complete onboarding** with GitHub connected
2. **Select repositories** in step 8
3. **Check network tab** - Should see POST to `/api/github/analyze/batch`
4. **Check database**:
   ```sql
   -- View extraction status
   SELECT * FROM github_code_extracts WHERE candidate_id = 'your-id';

   -- View analysis results
   SELECT * FROM github_code_analyses WHERE candidate_id = 'your-id';
   ```
5. **View matches page** - Analysis section should appear in cards

## How GitHub API Calls Work

The implementation uses the GitHub REST API v3:

```typescript
// Fetch language data for a repository
const response = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/languages`,
  {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  }
);

// Response format:
// {
//   "TypeScript": 45000,
//   "Python": 30000,
//   "JavaScript": 15000
// }
```

**Rate limits:**
- Authenticated requests: 5,000 per hour per user
- More than enough for our use case

## Quality Score Calculation

Simple algorithm based on observable metrics:

```typescript
function calculateQualityScore(languages: Record<string, number>): number {
  const totalBytes = sum(Object.values(languages));
  const languageCount = Object.keys(languages).length;

  // Size score (0-50): Logarithmic scale
  let sizeScore = Math.min(50, Math.log10(totalBytes) * 10);

  // Diversity score (0-30): More languages = better
  let diversityScore = Math.min(30, languageCount * 5);

  // Popularity score (0-20): Bonus for TypeScript, Python, Go, etc.
  let popularityScore = hasPopularLanguage ? 20 : 10;

  return Math.round(sizeScore + diversityScore + popularityScore);
}
```

**Score ranges:**
- 0-30: Beginner (small projects, limited languages)
- 31-60: Intermediate (moderate size, some diversity)
- 61-80: Advanced (large projects, diverse tech stack)
- 81-100: Expert (very large, highly diverse, popular languages)

## Error Handling

**Graceful degradation at every level:**

1. **No GitHub token** → Skip analysis, continue onboarding
2. **GitHub API fails** → Log error, mark as failed, don't crash
3. **Individual repo fails** → Continue with other repos
4. **Analysis incomplete** → Show "processing..." in UI
5. **No results** → Hide analysis section

## Future Enhancements

Potential improvements (not implemented):

- **Code complexity analysis** - Parse AST to detect patterns
- **Test coverage** - Check for test files and estimate coverage
- **Documentation score** - Analyze README quality
- **Security scanning** - Check for known vulnerabilities
- **Dependency analysis** - Evaluate package.json, requirements.txt
- **Commit frequency** - Analyze contribution patterns
- **Real-time updates** - WebSocket notifications when analysis completes

## Troubleshooting

### Analysis not starting
- Check candidate has `github_access_token` in database
- Check repository IDs are valid UUIDs
- Check browser console for API errors

### Analysis stuck "in_progress"
- Check `github_code_extracts` table for error messages
- GitHub API may have rate limited - wait and retry
- Token may have expired - reconnect GitHub

### Results not showing
- Check `github_code_analyses` table has data
- Check frontend is fetching from correct candidate_id
- Check RLS policies allow access

## Summary

This implementation provides a **production-ready GitHub analysis system** that:
- ✅ Works without external microservices
- ✅ Integrates seamlessly with existing onboarding
- ✅ Provides valuable insights to companies
- ✅ Handles errors gracefully
- ✅ Scales with your user base

The entire system is built on **simple, maintainable code** using Next.js API routes and direct GitHub API calls.
