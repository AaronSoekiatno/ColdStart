-- Migration: Create session_commits table and log_session_commit RPC function
-- This tracks candidate coding session activity from GitHub Actions
-- Links to interview_sessions via session_id for complete session tracking

-- Create session_commits table
CREATE TABLE IF NOT EXISTS public.session_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to interview session (nullable - populated after lookup or later)
  session_id TEXT REFERENCES public.interview_sessions(session_id) ON DELETE SET NULL,
  
  -- Candidate identification
  candidate_github_username TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  
  -- Event metadata
  event_type TEXT NOT NULL, -- 'push' or 'pull_request'
  commit_hash TEXT,
  commit_message TEXT,
  commit_author TEXT,
  commit_timestamp TIMESTAMP WITH TIME ZONE,
  
  -- Code metrics
  added_lines INTEGER DEFAULT 0,
  deleted_lines INTEGER DEFAULT 0,
  net_lines INTEGER GENERATED ALWAYS AS (added_lines - deleted_lines) STORED,
  
  -- Storage reference
  snapshot_storage_path TEXT, -- Path in Supabase Storage bucket
  snapshot_size_bytes BIGINT, -- Size of the compressed snapshot
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint for event types
  CONSTRAINT session_commits_event_type_check CHECK (event_type IN ('push', 'pull_request'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_session_commits_session_id ON public.session_commits(session_id);
CREATE INDEX IF NOT EXISTS idx_session_commits_candidate ON public.session_commits(candidate_github_username);
CREATE INDEX IF NOT EXISTS idx_session_commits_repo ON public.session_commits(repo_name);
CREATE INDEX IF NOT EXISTS idx_session_commits_created_at ON public.session_commits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_commits_candidate_repo ON public.session_commits(candidate_github_username, repo_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_commits_commit_hash ON public.session_commits(commit_hash);

-- Add comments
COMMENT ON TABLE public.session_commits IS 'Tracks candidate coding session commits from GitHub Actions during assessments. Links to interview_sessions for complete session tracking.';
COMMENT ON COLUMN public.session_commits.session_id IS 'Foreign key to interview_sessions.session_id - links commits to the parent interview session';
COMMENT ON COLUMN public.session_commits.candidate_github_username IS 'GitHub username of the candidate (repo owner)';
COMMENT ON COLUMN public.session_commits.repo_name IS 'Name of the assessment repository';
COMMENT ON COLUMN public.session_commits.event_type IS 'GitHub event type: push or pull_request';
COMMENT ON COLUMN public.session_commits.commit_hash IS 'Git SHA of the commit';
COMMENT ON COLUMN public.session_commits.snapshot_storage_path IS 'Path to code snapshot in session-snapshots Storage bucket';
COMMENT ON COLUMN public.session_commits.snapshot_size_bytes IS 'Size of the compressed snapshot in bytes';

-- Enable RLS
ALTER TABLE public.session_commits ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anon/service role to insert (for GitHub Actions)
CREATE POLICY "Allow anon to insert session commits"
  ON public.session_commits
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Allow authenticated users to read all (admin access for now)
CREATE POLICY "Allow authenticated to read all session commits"
  ON public.session_commits
  FOR SELECT
  TO authenticated
  USING (true);

-- Create the RPC function for logging session commits
-- Automatically looks up session_id from interview_sessions if not provided
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
    snapshot_size_bytes
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.log_session_commit TO anon;
GRANT EXECUTE ON FUNCTION public.log_session_commit TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_session_commit TO service_role;
