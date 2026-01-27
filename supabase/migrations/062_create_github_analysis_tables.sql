-- Migration: Create GitHub Analysis Tables
-- Purpose: Store GitHub repository analysis data for candidates

-- Table: github_repositories
-- Stores basic repository metadata from GitHub
CREATE TABLE IF NOT EXISTS public.github_repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  github_repo_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL, -- owner/repo format
  html_url TEXT,
  description TEXT,
  language TEXT,
  languages JSONB, -- Language breakdown from GitHub API
  topics TEXT[],
  is_private BOOLEAN DEFAULT false,
  stargazers_count INTEGER DEFAULT 0,
  forks_count INTEGER DEFAULT 0,
  is_selected BOOLEAN DEFAULT false,
  category_tags TEXT[], -- Role categories (PM, SWE, ML, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(candidate_id, github_repo_id)
);

-- Table: github_code_extracts
-- Tracks the extraction/analysis status for each repository
CREATE TABLE IF NOT EXISTS public.github_code_extracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  extraction_status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  UNIQUE(candidate_id, repository_id)
);

-- Table: github_code_analyses
-- Stores analysis results for each repository
CREATE TABLE IF NOT EXISTS public.github_code_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  overall_score INTEGER, -- Quality score 0-100
  code_quality_metrics JSONB, -- Detailed metrics (languages, complexity, etc.)
  architecture_analysis JSONB, -- Architecture patterns detected
  extraction_status TEXT NOT NULL DEFAULT 'completed', -- completed, failed
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(candidate_id, repository_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_github_repositories_candidate ON public.github_repositories(candidate_id);
CREATE INDEX IF NOT EXISTS idx_github_repositories_selected ON public.github_repositories(candidate_id, is_selected) WHERE is_selected = true;

CREATE INDEX IF NOT EXISTS idx_github_code_extracts_candidate ON public.github_code_extracts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_github_code_extracts_status ON public.github_code_extracts(extraction_status);

CREATE INDEX IF NOT EXISTS idx_github_code_analyses_candidate ON public.github_code_analyses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_github_code_analyses_score ON public.github_code_analyses(overall_score DESC);

-- RLS Policies
ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_code_extracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_code_analyses ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own repositories
CREATE POLICY "Users can view their own repositories"
  ON public.github_repositories
  FOR SELECT
  USING (candidate_id IN (
    SELECT id FROM public.candidates WHERE email = auth.jwt() ->> 'email'
  ));

-- Allow users to insert their own repositories
CREATE POLICY "Users can insert their own repositories"
  ON public.github_repositories
  FOR INSERT
  WITH CHECK (candidate_id IN (
    SELECT id FROM public.candidates WHERE email = auth.jwt() ->> 'email'
  ));

-- Allow users to update their own repositories
CREATE POLICY "Users can update their own repositories"
  ON public.github_repositories
  FOR UPDATE
  USING (candidate_id IN (
    SELECT id FROM public.candidates WHERE email = auth.jwt() ->> 'email'
  ));

-- Allow users to view their own extracts
CREATE POLICY "Users can view their own extracts"
  ON public.github_code_extracts
  FOR SELECT
  USING (candidate_id IN (
    SELECT id FROM public.candidates WHERE email = auth.jwt() ->> 'email'
  ));

-- Allow users to view their own analyses
CREATE POLICY "Users can view their own analyses"
  ON public.github_code_analyses
  FOR SELECT
  USING (candidate_id IN (
    SELECT id FROM public.candidates WHERE email = auth.jwt() ->> 'email'
  ));

-- Comments for documentation
COMMENT ON TABLE public.github_repositories IS 'Stores GitHub repository metadata for candidates';
COMMENT ON TABLE public.github_code_extracts IS 'Tracks extraction/analysis status for repositories';
COMMENT ON TABLE public.github_code_analyses IS 'Stores code quality analysis results for repositories';

COMMENT ON COLUMN public.github_repositories.languages IS 'Language breakdown from GitHub API (bytes per language)';
COMMENT ON COLUMN public.github_repositories.category_tags IS 'Role categories for this repository (PM, SWE, ML, etc.)';
COMMENT ON COLUMN public.github_code_analyses.code_quality_metrics IS 'Detailed code quality metrics (languages, total_bytes, etc.)';
COMMENT ON COLUMN public.github_code_analyses.overall_score IS 'Overall quality score from 0-100';
