-- Add objectives column to candidates table
-- This stores the user's selected objectives from onboarding (e.g., "Get a job", "Advance career", etc.)

ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS objectives text[];

-- Add comment for documentation
COMMENT ON COLUMN candidates.objectives IS 'Array of objectives selected during onboarding (e.g., ["Get a job", "Advance career"])';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_candidates_objectives ON candidates USING GIN (objectives);
