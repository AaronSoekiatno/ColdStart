-- Add major column to candidates table
-- This stores the candidate's major(s) extracted from their education history
-- Stored as TEXT[] to allow multiple majors (e.g., from different degrees)
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS major TEXT[];

-- Add comment to the column
COMMENT ON COLUMN candidates.major IS 'Array of majors extracted from education history in structured_resume_data or resumes.structured_data';

-- Create index on major for faster filtering (using GIN index for array searches)
CREATE INDEX IF NOT EXISTS idx_candidates_major ON candidates USING GIN(major);

