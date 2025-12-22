-- Add onboarding_completed column to candidates table
-- This tracks whether a candidate has completed the onboarding flow
-- Migration: 027_add_onboarding_completed_to_candidates.sql

ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Create index for faster queries on onboarding status
CREATE INDEX IF NOT EXISTS idx_candidates_onboarding_completed 
ON candidates(onboarding_completed);

-- Update existing candidates who have job_type and role_type set to mark them as onboarded
-- This prevents existing users from being forced through onboarding again
UPDATE candidates 
SET onboarding_completed = true 
WHERE job_type IS NOT NULL 
  AND role_type IS NOT NULL 
  AND array_length(role_type, 1) > 0;

-- Add comment to document the column
COMMENT ON COLUMN candidates.onboarding_completed IS 'Indicates whether the candidate has completed the initial onboarding flow';
