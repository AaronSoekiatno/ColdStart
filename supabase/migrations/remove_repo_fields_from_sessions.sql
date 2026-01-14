-- Migration: Remove repo_url and repo_name from interview_sessions table
-- These fields are no longer used since sessionId is stored in .hermes/config.json

-- Drop the index on repo_name (no longer needed)
DROP INDEX IF EXISTS idx_sessions_repo_name;

-- Drop the columns and remove comments (using DO block to check existence first)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'interview_sessions' 
    AND column_name = 'repo_name'
  ) THEN
    ALTER TABLE interview_sessions DROP COLUMN repo_name;
    RAISE NOTICE 'Dropped column repo_name';
  ELSE
    RAISE NOTICE 'Column repo_name does not exist, skipping';
  END IF;

  -- Drop repo_url column if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'interview_sessions' 
    AND column_name = 'repo_url'
  ) THEN
    ALTER TABLE interview_sessions DROP COLUMN repo_url;
    RAISE NOTICE 'Dropped column repo_url';
  ELSE
    RAISE NOTICE 'Column repo_url does not exist, skipping';
  END IF;
END $$;
