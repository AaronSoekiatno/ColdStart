-- Migration: Add diff_content column to session_commits
-- This stores the actual code changes (git diff) for each commit

ALTER TABLE public.session_commits
ADD COLUMN IF NOT EXISTS diff_content TEXT;

COMMENT ON COLUMN public.session_commits.diff_content IS 'Git diff output showing actual code changes in this commit';

-- Update the RPC function to accept diff content
CREATE OR REPLACE FUNCTION public.log_session_commit(
  p_candidate_id TEXT,           -- GitHub username
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
  p_session_id TEXT DEFAULT NULL,
  p_diff_content TEXT DEFAULT NULL  -- NEW: Git diff content
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
  IF p_session_id IS NULL AND p_repo_name IS NOT NULL THEN
    SELECT session_id INTO v_session_id
    FROM public.interview_sessions
    WHERE repo_name = p_repo_name
      AND candidate_id = p_candidate_id
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
    snapshot_size_bytes,
    diff_content
  ) VALUES (
    v_session_id,
    p_candidate_id,
    COALESCE(p_repo_name, 'unknown'),
    p_event,
    p_commit_hash,
    p_commit_message,
    p_commit_author,
    COALESCE(p_commit_timestamp, NOW()),
    COALESCE(p_added_lines, 0),
    COALESCE(p_deleted_lines, 0),
    p_snapshot_storage_path,
    p_snapshot_size_bytes,
    p_diff_content
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
