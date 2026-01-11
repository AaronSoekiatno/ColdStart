-- Migration: Unify candidate identification (SIMPLIFIED)
-- Adds github_username to interview_sessions for display purposes
-- Updates log_session_commit function with clearer parameter names

-- 1. Add github_username column to interview_sessions (optional, for display)
ALTER TABLE public.interview_sessions
ADD COLUMN IF NOT EXISTS github_username TEXT;

-- 2. Create index for github_username lookups
CREATE INDEX IF NOT EXISTS idx_interview_sessions_github_username
ON public.interview_sessions(github_username);

-- 3. Add comments for clarity
COMMENT ON COLUMN public.interview_sessions.github_username IS 'GitHub username (for display purposes). Populated when session is created. NOT used for lookups.';
COMMENT ON COLUMN public.interview_sessions.candidate_id IS 'UUID foreign key to public.candidates(id). This is the canonical candidate identifier in the database.';

-- 4. Update log_session_commit function to use clearer parameter names
-- This function looks up sessions by repo_name (which works), not by GitHub username
CREATE OR REPLACE FUNCTION public.log_session_commit(
  p_github_username TEXT,        -- GitHub username (stored in session_commits for display)
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
  p_session_id TEXT DEFAULT NULL  -- Optional: directly provide session_id
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commit_id UUID;
  v_session_id TEXT;
BEGIN
  -- Try to find matching interview session if session_id not provided
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

  -- Insert session commit
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
  
  -- Return success with the created commit ID and linked session
  RETURN json_build_object(
    'success', true,
    'commit_id', v_commit_id,
    'session_id', v_session_id,
    'message', 'Session commit logged successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Return error details
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

-- Add function comment
COMMENT ON FUNCTION public.log_session_commit IS 'Logs a session commit. Looks up session by repo_name. p_github_username is stored for display purposes only.';
