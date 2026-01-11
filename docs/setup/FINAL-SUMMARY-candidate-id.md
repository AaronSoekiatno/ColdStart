# Final Summary: CANDIDATE_ID Unification

## What We Did

### 1. Removed CANDIDATE_UUID (Redundant) ✅

**Problem**: `CANDIDATE_UUID` was just an alias for `CANDIDATE_ID` - both contained the same UUID value.

**Solution**: Removed `CANDIDATE_UUID` from:
- Fly.io provisioning
- Docker scripts
- Docker Compose
- API responses
- Entrypoint script

**Result**: Only `CANDIDATE_ID` (UUID) is now used throughout the system.

---

### 2. Identified Unnecessary Function ✅

**Your Question**: "Why are we matching candidate IDs from GitHub username? I don't think we have access to all the GitHub usernames."

**You Were Right!** The `get_candidate_id_from_github` function was:
- ❌ Unnecessary (we already have UUIDs when creating sessions)
- ❌ Non-functional (returns NULL)
- ❌ Solving a problem that doesn't exist

**Actual Data Flow**:
1. Container gets `CANDIDATE_ID` (UUID) from provision endpoint
2. Session is created with `candidate_id` (UUID) from candidates table
3. Commits are tracked using `repo_name` for lookup (NOT GitHub username)
4. GitHub username is only stored for display purposes

---

## Corrected Migration

**Use**: `supabase/migrations/047_unify_candidate_identification_simplified.sql`

**What it does**:
1. Adds `github_username` column to `interview_sessions` (optional, for display)
2. Updates `log_session_commit` function with clearer parameter names
3. Adds helpful comments

**What it does NOT do**:
- ❌ Create unnecessary `get_candidate_id_from_github` function
- ❌ Try to map GitHub usernames to UUIDs
- ❌ Add `github_username` to candidates table

---

## Current State

### Environment Variables
- `CANDIDATE_ID` (UUID) - The only identifier needed ✅
- ~~`CANDIDATE_UUID`~~ - REMOVED ❌

### Database Schema
```sql
-- Candidates table
candidates (
  id UUID PRIMARY KEY  -- The canonical identifier
)

-- Interview sessions table
interview_sessions (
  session_id TEXT PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id),  -- UUID link
  github_username TEXT,  -- Optional, for display only
  repo_name TEXT  -- Used for session lookups
)

-- Session commits table
session_commits (
  session_id TEXT REFERENCES interview_sessions(session_id),
  candidate_github_username TEXT,  -- For display
  repo_name TEXT  -- For lookups
)
```

### How Lookups Work
1. **Session → Candidate**: Use `interview_sessions.candidate_id` (UUID)
2. **Commit → Session**: Use `repo_name` (TEXT)
3. **GitHub username**: Stored for display, NOT used for lookups

---

## Why This Matters

### Before (Confusing)
- Two names for same thing: `CANDIDATE_ID` and `CANDIDATE_UUID`
- Unclear what "candidate_id" means (UUID or GitHub username?)
- Unnecessary function that doesn't work

### After (Clear)
- One name: `CANDIDATE_ID` (always UUID)
- Clear separation: UUID for database, GitHub username for display
- No unnecessary code

---

## Next Steps

1. **Apply the simplified migration**:
   ```bash
   # Use the simplified version
   supabase db push
   ```

2. **Delete the old migration** (optional):
   ```bash
   rm supabase/migrations/047_unify_candidate_identification.sql
   # Keep: 047_unify_candidate_identification_simplified.sql
   ```

3. **Test**:
   - New containers receive only `CANDIDATE_ID`
   - Session commits work correctly
   - No errors in logs

---

## Key Takeaway

**Your instinct was correct!** We don't need to map GitHub usernames to candidate UUIDs because:
- We already have the UUID when creating sessions
- Lookups use `repo_name`, not GitHub username
- GitHub username is only for display purposes

The simplified migration does exactly what's needed and nothing more.
