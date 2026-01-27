-- Create github_verifications table for storing verification results
CREATE TABLE IF NOT EXISTS public.github_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  verified_by TEXT NOT NULL, -- Admin email
  verified_at TIMESTAMPTZ DEFAULT now(),

  -- Snapshot of resume at verification time (immutable)
  resume_snapshot JSONB NOT NULL,

  -- Results
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'completed', 'failed')),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Detailed results
  project_matches JSONB, -- Array of matches
  project_discrepancies JSONB, -- Array of issues
  experience_timeline_analysis JSONB, -- Timeline gaps

  processing_duration_ms INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_github_verifications_candidate_id ON public.github_verifications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_github_verifications_verified_at ON public.github_verifications(verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_verifications_status ON public.github_verifications(verification_status);

-- Enable RLS
ALTER TABLE public.github_verifications ENABLE ROW LEVEL SECURITY;

-- Only service role can access (admin-only via API)
CREATE POLICY "Service role can manage github_verifications" ON public.github_verifications
  FOR ALL USING (auth.role() = 'service_role');
