-- Add role_type column to candidates table
-- This stores the user's preferred role type: PM, SWE, SDE, ML, AI, Data Science, etc.
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS role_type TEXT CHECK (role_type IN (
  'PM', 
  'SWE', 
  'SDE', 
  'ML', 
  'AI', 
  'Data Science', 
  'DevOps', 
  'Frontend', 
  'Backend', 
  'Full Stack', 
  'Mobile', 
  'Security', 
  'QA', 
  'Design', 
  'Product Design',
  'Other'
));

-- Create index on role_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_candidates_role_type ON candidates(role_type);

-- Add comment to document the schema
COMMENT ON COLUMN candidates.role_type IS 'Preferred role type: PM, SWE, SDE, ML, AI, Data Science, etc. Used for personalized job matching and email generation.';

