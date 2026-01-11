# CANDIDATE_ID Schema - Corrected Analysis

## You're Right - The Function is Unnecessary!

The `get_candidate_id_from_github` function in migration 047 is **completely unnecessary** because:

1. **We don't store GitHub usernames in the candidates table**
2. **We already have candidate_id (UUID) when creating interview sessions**
3. **The function returns NULL anyway** - it's just a placeholder

## Actual Data Flow

### How It Really Works

1. **Container Provisioning** (`/api/topcandidates/provision-container`):
   ```typescript
   // We have the candidate UUID from the database
   const candidate = await supabase
     .from('candidates')
     .select('id, email')
     .eq('email', user.email)
     .single();
   
   // We pass it to the container
   CANDIDATE_ID=${candidate.id}  // This is the UUID
   ```

2. **Interview Session Creation**:
   ```sql
   INSERT INTO interview_sessions (
     session_id,
     candidate_id,  -- UUID from candidates table
     repo_name,
     ...
   )
   ```

3. **Commit Tracking** (GitHub Actions):
   - GitHub Actions calls `/api/test` endpoint
   - Uses `session_id` from `.hermes/config.json`
   - **Never uses GitHub username for lookup**

4. **Session Commits**:
   ```sql
   -- The function looks up by repo_name, NOT by GitHub username!
   SELECT session_id 
   FROM interview_sessions
   WHERE repo_name = p_repo_name  -- ✅ This works
   -- NOT: WHERE github_username = p_github_username  -- ❌ This would fail
   ```

## What We Actually Need

### Minimal Schema Changes

1. **Add `github_username` to `interview_sessions`** (optional, for display purposes only)
   - Populated when creating the session
   - Used for showing "Repo owner: username" in UI
   - NOT used for lookups

2. **Keep `log_session_commit` simple**
   - Lookup by `repo_name` (already works)
   - Store `candidate_github_username` for display
   - Don't try to map back to UUID

### What We DON'T Need

1. ❌ `get_candidate_id_from_github` function - **DELETE THIS**
2. ❌ GitHub username → UUID mapping - **NOT NEEDED**
3. ❌ `github_username` column in `candidates` table - **NOT NEEDED**

## Simplified Migration

Here's what migration 047 should actually be:

```sql
-- 1. Add github_username to interview_sessions (optional, for display)
ALTER TABLE public.interview_sessions
ADD COLUMN IF NOT EXISTS github_username TEXT;

CREATE INDEX IF NOT EXISTS idx_interview_sessions_github_username
ON public.interview_sessions(github_username);

-- 2. Add comments for clarity
COMMENT ON COLUMN public.interview_sessions.github_username IS 'GitHub username (for display purposes). Populated when session is created.';
COMMENT ON COLUMN public.interview_sessions.candidate_id IS 'UUID foreign key to public.candidates(id). This is the canonical candidate identifier.';

-- 3. Update log_session_commit to use clearer parameter names
CREATE OR REPLACE FUNCTION public.log_session_commit(
  p_github_username TEXT,        -- GitHub username (for display in session_commits)
  p_event TEXT,                  -- 'push' or 'pull_request'
  p_added_lines INTEGER,
  p_deleted_lines INTEGER,
  p_commit_message TEXT,
  p_repo_name TEXT DEFAULT NULL,
  p_commit_hash TEXT DEFAULT NULL,
  p_commit_author TEXT DEFAULT NULL,
  p_commit_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_snapshot_storage_path TEXT DEFAULT NULL,
  p_snapshot_size_bytes BIGINT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commit_id UUID;
  v_session_id TEXT;
BEGIN
  -- Lookup by repo_name (this is what actually works)
  IF p_session_id IS NULL AND p_repo_name IS NOT NULL THEN
    SELECT session_id INTO v_session_id
    FROM public.interview_sessions
    WHERE repo_name = p_repo_name
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    v_session_id := p_session_id;
  END IF;

  -- Insert commit record
  INSERT INTO public.session_commits (
    session_id,
    candidate_github_username,
    repo_name,
    event_type,
    commit_hash,
    commit_message,
    commit_author,
    commit_timestamp,
    added_lines,
    deleted_lines,
    snapshot_storage_path,
    snapshot_size_bytes
  ) VALUES (
    v_session_id,
    p_github_username,
    COALESCE(p_repo_name, 'unknown'),
    p_event,
    p_commit_hash,
    p_commit_message,
    p_commit_author,
    COALESCE(p_commit_timestamp, NOW()),
    COALESCE(p_added_lines, 0),
    COALESCE(p_deleted_lines, 0),
    p_snapshot_storage_path,
    p_snapshot_size_bytes
  )
  RETURNING id INTO v_commit_id;
  
  RETURN json_build_object(
    'success', true,
    'commit_id', v_commit_id,
    'session_id', v_session_id,
    'message', 'Session commit logged successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_session_commit TO anon;
GRANT EXECUTE ON FUNCTION public.log_session_commit TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_session_commit TO service_role;

-- That's it! No unnecessary helper functions.
```

## Summary

**The Original Problem**: CANDIDATE_UUID was redundant

**The Solution**: Remove CANDIDATE_UUID ✅ (already done)

**The Mistake**: Adding `get_candidate_id_from_github` function that:
- Doesn't work (returns NULL)
- Isn't needed (we already have UUIDs)
- Solves a problem that doesn't exist

**The Fix**: Remove that function from migration 047
