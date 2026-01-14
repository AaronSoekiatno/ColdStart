-- Migration 052-reverse: Reverse the changes from 052_fix_missing_repo_name_in_rpc.sql
-- Restoring repo_name parameter handling (even if we don't rely on it effectively)
-- And ensuring the column exists if it was dropped.

-- 1. Add repo_name column back to session_commits if it was dropped
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'session_commits' 
    AND column_name = 'repo_name'
  ) THEN
    ALTER TABLE public.session_commits ADD COLUMN repo_name TEXT;
    RAISE NOTICE 'Added repo_name column back to session_commits';
  END IF;
END $$;

-- 2. Drop the current function signature
DROP FUNCTION IF EXISTS public.log_session_commit(text,text,integer,integer,text,text,text,text,timestamp with time zone,text,bigint,text,text);

-- 3. Restore log_session_commit that handles repo_name (mostly copying from 051)
CREATE OR REPLACE FUNCTION public.log_session_commit(
  p_candidate_id TEXT,           -- GitHub username (for display, backward compatible name)
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
  p_session_id TEXT DEFAULT NULL,  -- Optional: directly provide session_id
  p_diff_content TEXT DEFAULT NULL -- Optional: git diff content
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
  -- Try to find matching interview session if session_id not provided
  -- Lookup by repo_name (this is what actually works)
  IF p_session_id IS NULL AND p_repo_name IS NOT NULL THEN
    SELECT session_id, candidate_id INTO v_session_id, v_candidate_uuid
    FROM public.interview_sessions
    WHERE repo_name = p_repo_name
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    v_session_id := p_session_id;
    
    -- Look up candidate_id from the session if we have session_id
    IF v_session_id IS NOT NULL THEN
      SELECT candidate_id INTO v_candidate_uuid
      FROM public.interview_sessions
      WHERE session_id = v_session_id;
    END IF;
  END IF;

  -- Insert session commit with candidate_id
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
  
  -- Return success with the created commit ID and linked session
  RETURN json_build_object(
    'success', true,
    'commit_id', v_commit_id,
    'session_id', v_session_id,
    'candidate_id', v_candidate_uuid,
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
