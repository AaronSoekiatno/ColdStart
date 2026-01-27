-- Migration 051: Add candidate_id UUID to session_commits
-- This adds a direct foreign key reference to public.candidates(id)
-- Eliminates the need for indirect lookups through interview_sessions

DO $$ 
BEGIN 
    -- Check if column already exists (migration already applied)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'session_commits' 
        AND column_name = 'candidate_id'
    ) THEN
        RAISE NOTICE 'candidate_id column already exists, skipping migration';
        RETURN;
    END IF;

    -- Step 1: Add candidate_id column (nullable initially for existing records)
    ALTER TABLE public.session_commits 
    ADD COLUMN candidate_id UUID;

    -- Step 2: Backfill existing records by joining with interview_sessions
    -- This populates candidate_id for all existing session_commits
    UPDATE public.session_commits sc
    SET candidate_id = iss.candidate_id
    FROM public.interview_sessions iss
    WHERE sc.session_id = iss.session_id
      AND sc.candidate_id IS NULL;

    -- Step 3: Add foreign key constraint to candidates table
    -- Check if constraint already exists first
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_session_commits_candidate_id'
    ) THEN
        ALTER TABLE public.session_commits
        ADD CONSTRAINT fk_session_commits_candidate_id
        FOREIGN KEY (candidate_id) REFERENCES public.candidates(id)
        ON DELETE CASCADE;
    END IF;

    -- Step 4: Create index on candidate_id for query performance
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'session_commits' 
        AND indexname = 'idx_session_commits_candidate_id'
    ) THEN
        CREATE INDEX idx_session_commits_candidate_id 
        ON public.session_commits(candidate_id);
    END IF;

    RAISE NOTICE 'Successfully added candidate_id column to session_commits';

END $$;

-- Add comment to document the new column
COMMENT ON COLUMN public.session_commits.candidate_id IS 'Foreign key reference to public.candidates(id). Provides direct candidate relationship without joining through interview_sessions.';

-- Drop the existing function first (required to change parameter names or add new columns)
DROP FUNCTION IF EXISTS public.log_session_commit(text,text,integer,integer,text,text,text,text,timestamp with time zone,text,bigint,text,text);
DROP FUNCTION IF EXISTS public.log_session_commit(text,text,integer,integer,text,text,text,text,timestamp with time zone,text,bigint,text);

-- Update the log_session_commit function to populate candidate_id
-- This function looks up sessions by repo_name and populates candidate_id
-- NOTE: p_candidate_id is the GitHub username (TEXT), NOT the candidate UUID
CREATE FUNCTION public.log_session_commit(
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

-- Update function comment
COMMENT ON FUNCTION public.log_session_commit IS 'Logs a session commit. Looks up session by repo_name and populates both session_id and candidate_id (UUID). p_candidate_id (TEXT) is stored as candidate_github_username for display purposes.';
