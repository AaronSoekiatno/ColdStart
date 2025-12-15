-- Add resume_latex column to candidates table
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS resume_latex TEXT;

COMMENT ON COLUMN candidates.resume_latex IS 'LaTeX source code generated from resume for editing';
