-- Helper Scripts for GitHub Repos Debugging

-- 1. Check if the candidate exists and has a GitHub token
SELECT id, email, github_username, github_access_token IS NOT NULL as has_token 
FROM candidates 
WHERE email = 'aidan.nt76@gmail.com'; -- Replace with your test email

-- 2. Count fetched repositories for the candidate
SELECT count(*) 
FROM github_repositories 
WHERE candidate_id IN (SELECT id FROM candidates WHERE email = 'aidan.nt76@gmail.com');

-- 3. List fetched repositories details (limit 5)
SELECT id, name, is_private, is_selected, updated_at
FROM github_repositories 
WHERE candidate_id IN (SELECT id FROM candidates WHERE email = 'aidan.nt76@gmail.com')
ORDER BY updated_at DESC
LIMIT 5;

-- 4. Check for any sync errors (if logged elsewhere) or partial data
-- (Assuming we verify the 'github_repositories' structure)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'github_repositories';
