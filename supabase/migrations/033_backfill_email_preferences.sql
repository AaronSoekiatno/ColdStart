-- Backfill email_preferences for existing users
-- This migration creates email preferences for all existing users who don't have them yet
-- 
-- Run this AFTER migration 032_create_email_preferences.sql
-- 
-- Usage: Run this via Supabase dashboard or CLI after the initial migration

-- Step 1: Create email preferences for all users in candidates table
INSERT INTO email_preferences (email, welcome_emails_enabled, marketing_emails_enabled, unsubscribe_token)
SELECT 
  c.email,
  true as welcome_emails_enabled,
  false as marketing_emails_enabled,
  encode(gen_random_bytes(32), 'hex') as unsubscribe_token
FROM candidates c
WHERE c.email IS NOT NULL
  AND c.email != ''
  AND NOT EXISTS (
    SELECT 1 
    FROM email_preferences ep 
    WHERE ep.email = c.email
  )
ON CONFLICT (email) DO NOTHING;

-- Step 2: Create email preferences for all users in auth.users
-- Note: This requires service role access to auth.users
-- If you can't access auth.users directly, use the TypeScript backfill script instead
INSERT INTO email_preferences (email, welcome_emails_enabled, marketing_emails_enabled, unsubscribe_token)
SELECT 
  au.email,
  true as welcome_emails_enabled,
  false as marketing_emails_enabled,
  encode(gen_random_bytes(32), 'hex') as unsubscribe_token
FROM auth.users au
WHERE au.email IS NOT NULL
  AND au.email != ''
  AND au.email_confirmed_at IS NOT NULL  -- Only confirmed emails
  AND NOT EXISTS (
    SELECT 1 
    FROM email_preferences ep 
    WHERE ep.email = au.email
  )
ON CONFLICT (email) DO NOTHING;

-- Verify the backfill
SELECT 
  COUNT(*) as total_preferences,
  COUNT(CASE WHEN welcome_emails_enabled THEN 1 END) as welcome_enabled,
  COUNT(CASE WHEN unsubscribe_token IS NOT NULL THEN 1 END) as has_token
FROM email_preferences;

