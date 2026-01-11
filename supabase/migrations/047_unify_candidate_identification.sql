-- Migration: Unify candidate identification
-- Adds github_username to interview_sessions and clarifies candidate_id usage

-- 1. Add github_username column to interview_sessions
ALTER TABLE public.interview_sessions
ADD COLUMN IF NOT EXISTS github_username TEXT;

-- 2. Create index for github_username lookups
CREATE INDEX IF NOT EXISTS idx_interview_sessions_github_username
ON public.interview_sessions(github_username);

-- 3. Add comment for clarity
COMMENT ON COLUMN public.interview_sessions.github_username IS 'GitHub username of the candidate (for git commits and repo ownership). This is separate from candidate_id which is the UUID.';
COMMENT ON COLUMN public.interview_sessions.candidate_id IS 'UUID foreign key to public.candidates(id). This is the canonical candidate identifier in the database.';

-- 4. Backfill github_username from repo_name where possible
-- Assuming repo_name format is like "AbsurdLangChain-username" or similar
-- This is optional and depends on your naming convention
-- UPDATE public.interview_sessions
-- SET github_username = split_part(repo_name, '-', 2)
-- WHERE github_username IS NULL AND repo_name IS NOT NULL;

-- 5. Update log_session_commit function to use clearer parameter names
CREATE OR REPLACE FUNCTION public.log_session_commit(
  p_github_username TEXT,        -- GitHub username (renamed from p_candidate_id for clarity)
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
  -- Use repo_name for lookup since github_username might not be populated yet
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

-- 6. Create helper function to get candidate UUID from GitHub username
CREATE OR REPLACE FUNCTION public.get_candidate_id_from_github(p_github_username TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_candidate_id UUID;
BEGIN
  -- This assumes you have a way to map GitHub username to candidate UUID
  -- You might need to add a github_username column to the candidates table
  -- For now, this returns NULL if no mapping exists
  
  -- Example: If you store GitHub username in candidates table
  -- SELECT id INTO v_candidate_id
  -- FROM public.candidates
  -- WHERE github_username = p_github_username
  -- LIMIT 1;
  
  RETURN v_candidate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_candidate_id_from_github TO anon;
GRANT EXECUTE ON FUNCTION public.get_candidate_id_from_github TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_candidate_id_from_github TO service_role;

COMMENT ON FUNCTION public.log_session_commit IS 'Logs a session commit. p_github_username is the GitHub username (TEXT), not the candidate UUID.';
COMMENT ON FUNCTION public.get_candidate_id_from_github IS 'Helper function to map GitHub username to candidate UUID. Customize based on your schema.';
