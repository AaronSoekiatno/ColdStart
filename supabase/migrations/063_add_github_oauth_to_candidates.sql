-- Migration: Add GitHub OAuth fields to candidates table
-- Purpose: Store GitHub OAuth tokens for API access

-- Add GitHub OAuth fields if they don't exist
DO $$
BEGIN
  -- Add github_access_token column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_access_token'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_access_token TEXT;
  END IF;

  -- Add github_refresh_token column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_refresh_token'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_refresh_token TEXT;
  END IF;

  -- Add github_username column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_username'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_username TEXT;
  END IF;

  -- Add github_connected_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_connected_at'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_connected_at TIMESTAMPTZ;
  END IF;

  -- Add github_token_expires_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_token_expires_at'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_token_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.candidates.github_access_token IS 'GitHub OAuth access token for API access';
COMMENT ON COLUMN public.candidates.github_refresh_token IS 'GitHub OAuth refresh token';
COMMENT ON COLUMN public.candidates.github_username IS 'GitHub username';
COMMENT ON COLUMN public.candidates.github_connected_at IS 'Timestamp when GitHub was connected';
COMMENT ON COLUMN public.candidates.github_token_expires_at IS 'Timestamp when GitHub token expires';
