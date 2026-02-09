-- Fix for existing users who completed onboarding before the new validation
-- This sets onboarding_completed = true for users who have GitHub connected
-- (since GitHub connection was part of onboarding)

UPDATE candidates
SET onboarding_completed = true
WHERE github_access_token IS NOT NULL
  AND github_access_token != ''
  AND (onboarding_completed IS NULL OR onboarding_completed = false);

-- Check how many users were updated
SELECT COUNT(*) as updated_users
FROM candidates
WHERE github_access_token IS NOT NULL
  AND github_access_token != ''
  AND onboarding_completed = true;
