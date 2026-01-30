-- Migration: Add GitHub user ID and profile fields to candidates table
-- Purpose: Store permanent GitHub user ID and additional profile data from GitHub OAuth

DO $$
BEGIN
  -- Add github_user_id column (permanent ID that doesn't change even if username changes)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_user_id'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_user_id BIGINT;
  END IF;

  -- Add github_name column (full name from GitHub profile)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_name'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_name TEXT;
  END IF;

  -- Add github_avatar_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_avatar_url'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_avatar_url TEXT;
  END IF;

  -- Add github_profile_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_profile_url'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_profile_url TEXT;
  END IF;

  -- Add github_email column (public email from GitHub)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'candidates'
    AND column_name = 'github_email'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN github_email TEXT;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.candidates.github_user_id IS 'GitHub user ID (permanent, does not change even if username changes)';
COMMENT ON COLUMN public.candidates.github_name IS 'Full name from GitHub profile';
COMMENT ON COLUMN public.candidates.github_avatar_url IS 'Avatar URL from GitHub profile';
COMMENT ON COLUMN public.candidates.github_profile_url IS 'GitHub profile URL (e.g., https://github.com/username)';
COMMENT ON COLUMN public.candidates.github_email IS 'Public email from GitHub profile (may differ from login email)';

-- Add index on github_user_id for lookups
CREATE INDEX IF NOT EXISTS idx_candidates_github_user_id ON public.candidates(github_user_id);
