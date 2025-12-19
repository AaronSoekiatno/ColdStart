-- Add years_of_experience column to candidates table
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS years_of_experience TEXT;

-- Add comment to the column
COMMENT ON COLUMN candidates.years_of_experience IS 'Years of experience range (e.g. "0-1", "1-2", "3-5", "5+")';
