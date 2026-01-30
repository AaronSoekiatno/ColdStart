-- Recovery Script: Re-sync GitHub Repositories
-- This script will help recover lost GitHub repository data by re-fetching from GitHub API

-- Step 1: Check how many candidates have GitHub connected
SELECT 
  COUNT(*) as total_candidates_with_github,
  COUNT(DISTINCT github_username) as unique_github_users
FROM candidates
WHERE github_access_token IS NOT NULL
AND github_username IS NOT NULL;

-- Step 2: List all candidates who need repository re-sync
SELECT 
  id,
  email,
  name,
  github_username,
  created_at,
  -- Don't display the full token for security
  CASE 
    WHEN github_access_token IS NOT NULL THEN 'HAS_TOKEN'
    ELSE 'NO_TOKEN'
  END as token_status
FROM candidates
WHERE github_access_token IS NOT NULL
AND github_username IS NOT NULL
ORDER BY created_at DESC;

-- Step 3: Check if any repositories exist (should be 0 after migration)
SELECT COUNT(*) as current_repo_count FROM github_repositories;

-- Step 4: After re-syncing, verify data
-- Run this query after the re-sync to confirm repositories are back
SELECT 
  c.email,
  c.github_username,
  COUNT(gr.id) as repo_count
FROM candidates c
LEFT JOIN github_repositories gr ON gr.candidate_id = c.id
WHERE c.github_access_token IS NOT NULL
GROUP BY c.id, c.email, c.github_username
ORDER BY repo_count DESC;
