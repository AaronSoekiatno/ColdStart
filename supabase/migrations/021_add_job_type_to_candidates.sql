-- Add job_type column to candidates table
-- This stores the user's preferred job type: full-time, part-time, or internship
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS job_type TEXT CHECK (job_type IN ('full-time', 'part-time', 'internship'));

-- Create index on job_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_candidates_job_type ON candidates(job_type);

-- Add comment to document the schema
COMMENT ON COLUMN candidates.job_type IS 'Preferred job type: full-time, part-time, or internship. Used for personalized email generation.';
