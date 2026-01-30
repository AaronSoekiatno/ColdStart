# GitHub Repository Data Recovery

## Problem
Migration `103_fix_rls_security_issues.sql` dropped the `github_repositories` table (and related tables) using `DROP TABLE ... CASCADE`, which **deleted all repository data**.

## Solution
Since Supabase backups are Pro-only, we'll re-sync all GitHub repositories using the existing GitHub access tokens stored in the `candidates` table.

## Recovery Steps

### Step 1: Assess the Damage

Run the diagnostic SQL queries:
```bash
# In Supabase SQL Editor, run:
scripts/recovery/check-github-data.sql
```

This will show you:
- How many candidates have GitHub connected
- Current repository count (should be 0)
- List of affected candidates

### Step 2: Run the Recovery Script

```bash
npm run recovery:github-repos
```

This script will:
1. ✅ Fetch all candidates with GitHub connected
2. ✅ For each candidate, use their GitHub access token to fetch repositories
3. ✅ Re-insert repositories into `github_repositories` table
4. ✅ Include language breakdowns and metadata
5. ✅ Handle rate limiting and errors gracefully

### Step 3: Verify Recovery

After the script completes, run this SQL query:

```sql
-- Check recovery status
SELECT 
  c.email,
  c.github_username,
  COUNT(gr.id) as repo_count
FROM candidates c
LEFT JOIN github_repositories gr ON gr.candidate_id = c.id
WHERE c.github_access_token IS NOT NULL
GROUP BY c.id, c.email, c.github_username
ORDER BY repo_count DESC;
```

## Expected Results

The script will output:
```
================================================================================
GitHub Repository Recovery Script
================================================================================

Found X candidates with GitHub connected

[SYNC] Processing candidate: username1
[SYNC] Found 25 repositories for username1
[SYNC] ✓ Inserted owner/repo1
[SYNC] ✓ Inserted owner/repo2
...
[SYNC] Completed for username1: 25/25 repositories inserted

================================================================================
Recovery Summary
================================================================================
Total candidates processed: X
Successful: X
Failed: 0
Total repositories recovered: XXX
================================================================================
```

## What Gets Recovered

For each repository, the script recovers:
- ✅ Repository name and full name (owner/repo)
- ✅ Description
- ✅ Primary language
- ✅ Language breakdown (JSONB)
- ✅ Topics/tags
- ✅ Stars and forks count
- ✅ Public/private status
- ✅ Created/updated timestamps

## Troubleshooting

### "Invalid GitHub token"
- Some candidates may have expired tokens
- They'll need to reconnect their GitHub account
- The script will skip them and continue with others

### Rate Limiting
- The script includes 100ms delays between API calls
- GitHub allows 5,000 requests/hour for authenticated users
- Should be sufficient for most recovery operations

### Duplicate Key Errors
- If you run the script multiple times, it will skip existing repositories
- This is safe and expected behavior

## Prevention for Future

To prevent data loss in future migrations:

1. **Always backup data before DROP TABLE**:
```sql
-- Create backup
CREATE TABLE github_repositories_backup AS 
SELECT * FROM github_repositories;

-- Drop and recreate
DROP TABLE github_repositories CASCADE;
CREATE TABLE github_repositories (...);

-- Restore data
INSERT INTO github_repositories 
SELECT * FROM github_repositories_backup;

-- Clean up
DROP TABLE github_repositories_backup;
```

2. **Use ALTER TABLE instead of DROP TABLE when possible**:
```sql
-- Add new columns
ALTER TABLE github_repositories ADD COLUMN new_field TEXT;

-- Modify columns
ALTER TABLE github_repositories ALTER COLUMN field_name TYPE new_type;
```

3. **Test migrations on a development database first**

## Related Files

- `/scripts/recovery/resync-github-repos.ts` - Main recovery script
- `/scripts/recovery/check-github-data.sql` - Diagnostic queries
- `/docs/DATA_RECOVERY_GUIDE.md` - General recovery guide
- `/supabase/migrations/103_fix_rls_security_issues.sql` - The migration that caused data loss
