# CANDIDATE_ID vs CANDIDATE_UUID Schema Analysis

## Problem Summary

There's a discrepancy in how candidate identification is handled across the codebase:

1. **Database Schema (`interview_sessions`)**: Uses `candidate_id UUID` referencing `public.candidates(id)`
2. **RPC Functions**: Use `p_candidate_id TEXT` expecting GitHub username
3. **Environment Variables**: Use both `CANDIDATE_ID` and `CANDIDATE_UUID` interchangeably
4. **Application Code**: Sometimes treats candidate_id as UUID, sometimes as TEXT

## Current State

### Database Schema (public schema)

**`candidates` table:**
- `id` UUID PRIMARY KEY - The canonical candidate identifier

**`interview_sessions` table:**
- `session_id` TEXT PRIMARY KEY
- `candidate_id` UUID REFERENCES public.candidates(id)

**`session_commits` table:**
- `candidate_github_username` TEXT - GitHub username
- `session_id` TEXT REFERENCES interview_sessions(session_id)

### RPC Functions

**`log_session_commit` (migration 043, 045):**
```sql
p_candidate_id TEXT  -- GitHub username (NOT UUID)
```
- Line 103: `WHERE candidate_id = p_candidate_id` ❌ **TYPE MISMATCH**
- Tries to compare UUID column with TEXT parameter

### Environment Variables

**Container provisioning passes:**
- `CANDIDATE_ID` = UUID from candidates table
- `CANDIDATE_UUID` = Same UUID (alias for compatibility)

**Workspace scripts expect:**
- Either `CANDIDATE_ID` or `CANDIDATE_UUID` (treats them as same)

## The Core Issue

### Issue 1: Type Mismatch in RPC Functions

The `log_session_commit` function has a fundamental type mismatch:

```sql
-- interview_sessions.candidate_id is UUID
-- p_candidate_id is TEXT (GitHub username)
WHERE candidate_id = p_candidate_id  -- This will NEVER match!
```

This was partially addressed in migration 045 which removed the candidate_id comparison, but the parameter name is still misleading.

### Issue 2: Semantic Confusion

- **`CANDIDATE_ID`** should mean: UUID from `public.candidates(id)`
- **`CANDIDATE_UUID`** is redundant - it's the same as CANDIDATE_ID
- **GitHub username** is a separate concept and should not be called "candidate_id"

### Issue 3: Missing Column

The `interview_sessions` table doesn't store the GitHub username/repo owner, making it impossible to link sessions to commits without the repo_name.

## Recommended Solution

### Option 1: Unify on UUID (Recommended)

**Rationale:** The database uses UUIDs as the canonical identifier. GitHub usernames can change.

**Changes needed:**

1. **Rename environment variable:**
   - Keep: `CANDIDATE_ID` (UUID)
   - Remove: `CANDIDATE_UUID` (redundant)
   - Add: `GITHUB_USERNAME` (for git commits, telemetry)

2. **Update interview_sessions table:**
   ```sql
   ALTER TABLE interview_sessions 
   ADD COLUMN github_username TEXT;
   
   CREATE INDEX idx_interview_sessions_github_username 
   ON interview_sessions(github_username);
   ```

3. **Fix RPC functions:**
   ```sql
   CREATE OR REPLACE FUNCTION log_session_commit(
     p_github_username TEXT,  -- Renamed for clarity
     p_session_id TEXT,       -- Direct session lookup
     ...
   )
   ```

4. **Update container provisioning:**
   - Pass `CANDIDATE_ID` (UUID)
   - Pass `GITHUB_USERNAME` (for commits)
   - Remove `CANDIDATE_UUID`

### Option 2: Keep Both (Current State)

**If we must keep both for backward compatibility:**

1. **Clarify naming:**
   - `CANDIDATE_ID` = UUID (database primary key)
   - `GITHUB_USERNAME` = TEXT (git username)
   - Remove `CANDIDATE_UUID` entirely

2. **Fix RPC functions:**
   - Rename parameters to match their actual type
   - Use repo_name for session lookup (current workaround)

3. **Document clearly:**
   - CANDIDATE_ID is always UUID
   - Never compare CANDIDATE_ID with GitHub username

## Impact Analysis

### Files Affected by Option 1

1. **Database Migrations:**
   - New migration to add `github_username` to `interview_sessions`
   - Update RPC functions to use correct parameter names

2. **Container Provisioning:**
   - `lib/container-orchestration/flyio.ts`
   - `docker/start-assessment.sh`
   - `docker/docker-compose.assessment.yml`

3. **API Endpoints:**
   - `app/api/topcandidates/provision/route.ts`
   - `app/api/topcandidates/provision-container/route.ts`

4. **Workspace Scripts:**
   - `docker/workspace/scripts/provision-key.js`
   - `docker/workspace/scripts/auto-setup.js`
   - `docker/scripts/entrypoint.sh`

5. **Documentation:**
   - All environment variable documentation
   - API documentation

## Immediate Action Items

### Quick Fix (Minimal Changes)

1. **Remove CANDIDATE_UUID** from new code:
   - It's just an alias for CANDIDATE_ID
   - Causes confusion about what it represents
   - Keep only for backward compatibility in workspace scripts

2. **Document clearly:**
   - CANDIDATE_ID = UUID from public.candidates(id)
   - Used for database lookups and API authentication
   - NOT the same as GitHub username

3. **Fix RPC function comments:**
   - Update migration 045 comments to clarify parameter types
   - Document that session lookup uses repo_name, not candidate_id

### Long-term Fix (Recommended)

1. **Add github_username column** to interview_sessions
2. **Rename RPC parameters** to match their actual semantics
3. **Remove CANDIDATE_UUID** environment variable
4. **Add GITHUB_USERNAME** environment variable
5. **Update all documentation**

## Current Workaround

The current code works because:
1. Session lookup uses `repo_name` instead of `candidate_id`
2. CANDIDATE_UUID is just an alias for CANDIDATE_ID (both are UUID)
3. GitHub username is stored in `session_commits.candidate_github_username`

But this is fragile and confusing for developers.
