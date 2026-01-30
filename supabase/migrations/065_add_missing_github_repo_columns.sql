-- Migration: Add missing columns to github_repositories
-- Purpose: Support richer repository metadata from GitHub API

ALTER TABLE public.github_repositories
ADD COLUMN IF NOT EXISTS default_branch TEXT,
ADD COLUMN IF NOT EXISTS homepage TEXT,
ADD COLUMN IF NOT EXISTS license_name TEXT,
ADD COLUMN IF NOT EXISTS has_issues BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_projects BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_wiki BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_pages BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS watchers_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_fork BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS full_data JSONB;

-- Comment on new columns
COMMENT ON COLUMN public.github_repositories.default_branch IS 'Default branch name (e.g. main, master)';
COMMENT ON COLUMN public.github_repositories.full_data IS 'Original full JSON object from GitHub API';
COMMENT ON COLUMN public.github_repositories.synced_at IS 'Timestamp when this record was last synced from GitHub';
