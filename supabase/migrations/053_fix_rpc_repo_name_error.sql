-- Migration 053: Fix log_session_commit RPC to stop referencing deleted interview_sessions.repo_name
-- This resolves the "column repo_name does not exist" error while keeping the session_commits table structure intact.

CREATE OR REPLACE FUNCTION public.log_session_commit(
  p_candidate_id TEXT,           -- GitHub username or Candidate ID
  p_event TEXT,                  -- 'push' or 'pull_request'
  p_added_lines INTEGER,
  p_deleted_lines INTEGER,
  p_commit_message TEXT,
  p_repo_name TEXT DEFAULT NULL, -- Kept for signature compatibility
  p_commit_hash TEXT DEFAULT NULL,
  p_commit_author TEXT DEFAULT NULL,
  p_commit_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_snapshot_storage_path TEXT DEFAULT NULL,
  p_snapshot_size_bytes BIGINT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_diff_content TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commit_id UUID;
  v_session_id TEXT;
  v_candidate_uuid UUID;
BEGIN
  -- We rely directly on p_session_id. 
  -- Removed the lookup block that referenced interview_sessions.repo_name (which was dropped)
  
  v_session_id := p_session_id;

  -- Look up candidate_id from the session if we have session_id
  IF v_session_id IS NOT NULL THEN
    SELECT candidate_id INTO v_candidate_uuid
    FROM public.interview_sessions
    WHERE session_id = v_session_id;
  END IF;

  -- Insert session commit
  -- We include repo_name in the insert since the column exists in session_commits (restored), 
  -- but we don't query it from interview_sessions.
  INSERT INTO public.session_commits (
    session_id,
    candidate_id,
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
    v_candidate_uuid,
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
  
  RETURN json_build_object(
    'success', true,
    'commit_id', v_commit_id,
    'session_id', v_session_id,
    'candidate_id', v_candidate_uuid,
    'message', 'Session commit logged successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
