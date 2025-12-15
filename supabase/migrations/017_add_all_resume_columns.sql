-- Add all resume-related columns to candidates table
-- This migration combines 015 and 016 to ensure all columns exist

-- Add resume_latex column if it doesn't exist
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS resume_latex TEXT;

COMMENT ON COLUMN candidates.resume_latex IS 'LaTeX source code generated from resume for editing';

-- Add structured_resume_data column if it doesn't exist
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS structured_resume_data JSONB;

COMMENT ON COLUMN candidates.structured_resume_data IS 'Structured resume data parsed from PDF for template-based editing';

