-- Sync waitlist users to email_preferences table
-- This migration ensures all waitlist users are opted into marketing emails (newsletter)
-- Run this AFTER migrations 032 and 033

-- Step 1: Create email preferences for all waitlist users who don't have them
-- Opt them into marketing emails since they explicitly joined the waitlist
INSERT INTO email_preferences (email, welcome_emails_enabled, marketing_emails_enabled, unsubscribe_token)
SELECT 
  w.email,
  false as welcome_emails_enabled,  -- They haven't signed up yet, so no welcome email needed
  true as marketing_emails_enabled,  -- Opt them into newsletter since they joined waitlist
  encode(gen_random_bytes(32), 'hex') as unsubscribe_token
FROM waitlist w
WHERE w.email IS NOT NULL
  AND w.email != ''
  AND NOT EXISTS (
    SELECT 1 
    FROM email_preferences ep 
    WHERE ep.email = w.email
  )
ON CONFLICT (email) DO NOTHING;

-- Step 2: Update existing email preferences for waitlist users
-- Ensure they're opted into marketing emails
UPDATE email_preferences ep
SET marketing_emails_enabled = true
FROM waitlist w
WHERE ep.email = w.email
  AND w.email IS NOT NULL
  AND ep.marketing_emails_enabled = false
  AND ep.unsubscribed_at IS NULL;  -- Don't opt-in users who have unsubscribed

-- Verify the sync
SELECT 
  COUNT(*) as total_waitlist_users,
  COUNT(CASE WHEN ep.email IS NOT NULL THEN 1 END) as with_preferences,
  COUNT(CASE WHEN ep.marketing_emails_enabled THEN 1 END) as opted_into_newsletter
FROM waitlist w
LEFT JOIN email_preferences ep ON w.email = ep.email;

