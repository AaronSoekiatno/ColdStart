-- Add assessment repository fields to candidates table
-- These fields track the GitHub repository created for the candidate's assessment

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS assessment_repo_url TEXT,
ADD COLUMN IF NOT EXISTS assessment_repo_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assessment_started_at TIMESTAMP WITH TIME ZONE;

-- Create index on assessment_repo_url for efficient lookups
CREATE INDEX IF NOT EXISTS idx_candidates_assessment_repo_url ON candidates(assessment_repo_url);

-- Add comments to document the columns
COMMENT ON COLUMN candidates.assessment_repo_url IS 'The URL of the private GitHub repository created for the candidate''s assessment workspace.';
COMMENT ON COLUMN candidates.assessment_repo_created_at IS 'Timestamp when the assessment repository was created.';
COMMENT ON COLUMN candidates.assessment_started_at IS 'Timestamp when the candidate started the assessment.';

