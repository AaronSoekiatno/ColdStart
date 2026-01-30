# Data Recovery Guide - GitHub Tables

## Problem
Migration `103_fix_rls_security_issues.sql` dropped and recreated several tables, **deleting all existing data**:
- `github_repositories` 
- `github_velocity_metrics`
- `github_verifications`
- `github_code_analyses`
- `github_code_extracts`

## Recovery Options

### Option 1: Restore from Supabase Backup (RECOMMENDED)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/npqjuljzpjvcqmrgpyqj

2. **Access Database Backups**
   - Click "Database" in the left sidebar
   - Click "Backups" tab
   - Supabase keeps daily backups (7 days for free tier, 30 days for Pro)

3. **Find the Right Backup**
   - Look for a backup from **before** you ran migration 103
   - The migration was likely run recently, so look for yesterday's backup

4. **Restore Specific Tables**
   You have two options:

   **A. Point-in-Time Recovery (Pro plan only)**
   - Use Supabase's PITR feature to restore to before the migration

   **B. Manual Table Restore (All plans)**
   - Download the backup
   - Extract the data for these tables:
     ```sql
     -- Export from backup
     COPY (SELECT * FROM github_repositories) TO '/tmp/github_repositories.csv' CSV HEADER;
     COPY (SELECT * FROM github_velocity_metrics) TO '/tmp/github_velocity_metrics.csv' CSV HEADER;
     COPY (SELECT * FROM github_verifications) TO '/tmp/github_verifications.csv' CSV HEADER;
     COPY (SELECT * FROM github_code_analyses) TO '/tmp/github_code_analyses.csv' CSV HEADER;
     COPY (SELECT * FROM github_code_extracts) TO '/tmp/github_code_extracts.csv' CSV HEADER;
     ```
   - Import back into current database

### Option 2: Re-sync GitHub Data

If backups aren't available or are too old:

1. **Trigger GitHub Re-sync for All Users**
   - Users will need to reconnect their GitHub accounts
   - Or create a script to re-fetch repositories using their existing `github_access_token`

2. **Create a Recovery Script**
   ```sql
   -- Get all candidates with GitHub connected
   SELECT id, email, github_username, github_access_token
   FROM candidates
   WHERE github_access_token IS NOT NULL
   AND github_username IS NOT NULL;
   ```

3. **Use GitHub API to Re-fetch Repositories**
   - For each candidate, call GitHub API to get their repositories
   - Re-populate `github_repositories` table

### Option 3: Prevent Future Data Loss

**IMPORTANT**: Update migration 103 to preserve data:

Instead of:
```sql
DROP TABLE IF EXISTS public.github_repositories CASCADE;
```

Use:
```sql
-- Backup existing data
CREATE TEMP TABLE github_repositories_backup AS SELECT * FROM public.github_repositories;

-- Drop and recreate
DROP TABLE IF EXISTS public.github_repositories CASCADE;
-- ... create table ...

-- Restore data
INSERT INTO public.github_repositories SELECT * FROM github_repositories_backup;
```

## Immediate Action Steps

1. **Check Supabase Backups ASAP**
   - Time is critical - backups are only kept for 7-30 days
   - Go to: https://supabase.com/dashboard/project/npqjuljzpjvcqmrgpyqj/database/backups

2. **If Backup Exists:**
   - Restore the affected tables
   - Re-run migrations 103 and 104 with data preservation

3. **If No Backup:**
   - Create a script to re-sync GitHub data for all users
   - Use the GitHub API with existing access tokens

## Prevention for Future Migrations

Always use this pattern for schema changes:
```sql
-- 1. Create new table with _new suffix
CREATE TABLE github_repositories_new (...);

-- 2. Copy data
INSERT INTO github_repositories_new SELECT * FROM github_repositories;

-- 3. Drop old table
DROP TABLE github_repositories CASCADE;

-- 4. Rename new table
ALTER TABLE github_repositories_new RENAME TO github_repositories;
```

Or use `ALTER TABLE` instead of `DROP TABLE` when possible.
