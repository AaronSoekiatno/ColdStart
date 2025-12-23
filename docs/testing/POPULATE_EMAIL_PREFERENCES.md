# How to Populate Email Preferences Table

## Overview

The `email_preferences` table needs to be populated for existing users who signed up before this feature was implemented. New signups automatically get preferences created.

## Automatic Population (New Users)

✅ **No action needed** - New users automatically get email preferences when they sign up via:
- `app/auth/callback/route.ts` calls `getOrCreateEmailPreferences()`
- This happens for both OAuth and email/password signups

## Manual Population (Existing Users)

### Method 1: TypeScript Script (Recommended)

The script finds all existing users and creates preferences for them:

```bash
# Preview what would be created (recommended first step)
npm run backfill-email-preferences -- --dry-run

# Backfill all existing users
npm run backfill-email-preferences

# Backfill with limit (for testing)
npm run backfill-email-preferences -- --limit=100
```

**What it does:**
1. Fetches all emails from `candidates` table
2. Fetches all emails from `auth.users` (if accessible)
3. Checks which emails already have preferences
4. Creates preferences for missing emails
5. Generates secure unsubscribe tokens
6. Processes in batches of 10 to avoid overwhelming the database

**Expected Output:**
```
📧 Email Preferences Backfill
==============================

Step 1: Fetching emails from candidates table...
   Found 1234 unique emails in candidates table

Step 2: Fetching emails from auth.users...
   Found 1200 unique emails in auth.users

Step 3: Total unique emails to process: 1500

Step 4: Checking existing email preferences...
   Found 200 existing email preferences

Step 5: Emails needing preferences: 1300

Step 6: Processing 1300 email(s)...
Processing batch 1/130 (10 emails)...
  ✅ Created preferences for: user1@example.com
  ✅ Created preferences for: user2@example.com
  ...

==============================
📊 Summary
==============================
Total emails processed: 1300
✅ Created: 1295
❌ Failed: 5
```

### Method 2: SQL Migration

Run the SQL migration directly in Supabase:

```sql
-- Run: supabase/migrations/033_backfill_email_preferences.sql
```

**Note:** The SQL migration may not have access to `auth.users` depending on your Supabase RLS policies. The TypeScript script is more reliable for accessing auth users.

## When to Run Backfill

Run the backfill script:

1. **After deploying the feature** - To populate preferences for existing users
2. **After importing users** - If you bulk import users from another system
3. **Periodically** - If you notice users without preferences (shouldn't happen with auto-creation)

## Verification

After running the backfill, verify it worked:

```sql
-- Check total preferences created
SELECT COUNT(*) as total_preferences FROM email_preferences;

-- Check preferences for specific users
SELECT 
  email, 
  welcome_emails_enabled, 
  unsubscribe_token IS NOT NULL as has_token,
  created_at
FROM email_preferences
ORDER BY created_at DESC
LIMIT 10;

-- Find users without preferences (should be 0 after backfill)
SELECT c.email
FROM candidates c
WHERE c.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM email_preferences ep WHERE ep.email = c.email
  );
```

## Troubleshooting

### Issue: Script fails with "SUPABASE_SERVICE_ROLE_KEY is not set"

**Solution:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`

### Issue: Some emails fail to create preferences

**Check:**
- Email format is valid (contains @)
- Email is not null or empty
- No duplicate email entries
- Database connection is stable

### Issue: Can't access auth.users

**Solution:** This is okay - the script will still process candidates table. Auth users will get preferences created on their next login/signup.

## Best Practices

1. **Run dry-run first** - Always preview with `--dry-run` before running for real
2. **Test with limit** - Use `--limit=10` to test on a small subset first
3. **Monitor logs** - Check for any failed emails and investigate
4. **Verify results** - Run SQL queries to verify preferences were created
5. **Run during low traffic** - Backfill can be resource-intensive, run during off-peak hours

## Maintenance

After initial backfill, new users will automatically get preferences. However, you may want to:

- **Monitor for missing preferences** - Set up a query to alert if users exist without preferences
- **Re-run periodically** - If you import users from other sources
- **Clean up invalid emails** - Remove preferences for emails that bounce or are invalid

