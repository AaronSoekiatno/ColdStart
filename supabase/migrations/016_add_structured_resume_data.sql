-- Add structured_resume_data column to candidates table
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS structured_resume_data JSONB;

COMMENT ON COLUMN candidates.structured_resume_data IS 'Structured resume data parsed from PDF for template-based editing';

