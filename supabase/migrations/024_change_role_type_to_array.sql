-- Change role_type column from TEXT to TEXT[] (array) to support multiple role selections
-- First, drop the existing CHECK constraint
ALTER TABLE candidates
DROP CONSTRAINT IF EXISTS candidates_role_type_check;

-- Drop the old index
DROP INDEX IF EXISTS idx_candidates_role_type;

-- Change the column type to TEXT[]
ALTER TABLE candidates
ALTER COLUMN role_type TYPE TEXT[] USING 
  CASE 
    WHEN role_type IS NULL THEN NULL
    WHEN role_type = '' THEN NULL
    ELSE ARRAY[role_type]
  END;

-- Create a new index on the array column using GIN for efficient array queries
CREATE INDEX IF NOT EXISTS idx_candidates_role_type ON candidates USING GIN (role_type);

-- Update the comment to reflect the array type
COMMENT ON COLUMN candidates.role_type IS 'Preferred role types (array): PM, SWE, SDE, ML, AI, Data Science, etc. Used for personalized job matching and email generation. Supports multiple role selections.';

