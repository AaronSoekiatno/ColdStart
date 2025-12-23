# Welcome Email Testing Guide

This guide covers how to test the welcome email functionality, including opt-out compliance features.

## Populating Email Preferences Table

### For New Users
New users automatically get email preferences created when they sign up via the auth callback route. No action needed.

### For Existing Users (Backfill)

You have two options to backfill email preferences for existing users:

#### Option 1: TypeScript Script (Recommended)
```bash
# Preview what would be created (dry run)
npm run backfill-email-preferences -- --dry-run

# Backfill all existing users
npm run backfill-email-preferences

# Backfill with limit (for testing)
npm run backfill-email-preferences -- --limit=100
```

This script:
- Finds all emails from `candidates` table
- Finds all emails from `auth.users` (if accessible)
- Creates email preferences for users who don't have them
- Generates secure unsubscribe tokens
- Processes in batches to avoid overwhelming the database

#### Option 2: SQL Migration
Run the SQL migration directly:
```sql
-- Run: supabase/migrations/033_backfill_email_preferences.sql
-- This creates preferences for all existing users
```

**Note:** The SQL migration may not have access to `auth.users` depending on your Supabase setup. Use the TypeScript script if you need to include auth users.

### Verify Backfill
```sql
-- Check how many preferences were created
SELECT COUNT(*) as total_preferences FROM email_preferences;

-- Check preferences for specific users
SELECT email, welcome_emails_enabled, unsubscribe_token IS NOT NULL as has_token
FROM email_preferences
ORDER BY created_at DESC
LIMIT 10;
```

## Prerequisites

1. **Environment Variables** - Ensure these are set in `.env.local`:
   ```bash
   SENDGRID_API_KEY=your_sendgrid_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   NEXT_PUBLIC_APP_URL=https://joinhermes.co  # or http://localhost:3000 for local testing
   ```

2. **Database Migration** - Run the email preferences migration:
   ```bash
   # If using Supabase CLI
   supabase migration up
   
   # Or apply manually via Supabase dashboard
   # Run: supabase/migrations/032_create_email_preferences.sql
   ```

## Testing Methods

### 1. Automated Test Script

Run the comprehensive test script:

```bash
npm run test-welcome-email your.email@example.com
```

This tests:
- ✅ First name extraction from metadata/email
- ✅ Email preferences creation
- ✅ Can send welcome email check
- ✅ Get or create preferences
- ✅ Welcome email sending
- ✅ Unsubscribe link generation

**Expected Output:**
```
🧪 Testing Welcome Email Functionality
=====================================

📧 Test Email: your.email@example.com

Test 1: Extract First Name
--------------------------
  ✅ john@example.com → "John"
  ✅ jane@example.com → "Jane"
  ✅ testuser@example.com → "Testuser"

Test 2: Email Preferences Creation
-----------------------------------
  ✅ Created email preferences
     welcome_emails_enabled: true
     unsubscribe_token: ✅ Set

Test 3: Check Can Send Welcome Email
-------------------------------------
  ✅ Can send welcome email: true

Test 4: Get or Create Email Preferences
----------------------------------------
  ✅ Preferences retrieved/created
     Email: your.email@example.com
     Welcome emails enabled: true
     Unsubscribe token: ✅ Present

Test 5: Send Welcome Email
--------------------------
  📤 Sending welcome email to your.email@example.com...
     First name: Your
  ✅ Welcome email sent successfully!
     Message ID: <message-id>

Test 6: Unsubscribe Link
------------------------
  ✅ Unsubscribe link generated:
     https://joinhermes.co/unsubscribe?email=your.email%40example.com&token=<token>
```

### 2. Manual Integration Testing

#### Test 1: New User Signup Flow

1. **Sign up with a new email** (one that hasn't been used before):
   - Go to the signup page
   - Use email/password or OAuth (Google)
   - Complete signup

2. **Check email inbox**:
   - Should receive welcome email within a few seconds
   - Subject: "Hey [FirstName] - welcome to Hermes"
   - Contains unsubscribe link in footer
   - Contains Privacy Policy and Terms links

3. **Verify email preferences were created**:
   ```sql
   SELECT * FROM email_preferences WHERE email = 'your.email@example.com';
   ```
   Should show:
   - `welcome_emails_enabled = true`
   - `unsubscribe_token` is set
   - `unsubscribed_at = null`

#### Test 2: Unsubscribe Functionality

1. **Click unsubscribe link** from the welcome email:
   ```
   https://joinhermes.co/unsubscribe?email=your.email@example.com&token=<token>
   ```

2. **Verify unsubscribe page**:
   - Shows success message
   - Confirms unsubscription
   - Option to resubscribe (if implemented)

3. **Verify database update**:
   ```sql
   SELECT * FROM email_preferences WHERE email = 'your.email@example.com';
   ```
   Should show:
   - `welcome_emails_enabled = false`
   - `unsubscribed_at` is set (timestamp)
   - `marketing_emails_enabled = false`

4. **Test opt-out enforcement**:
   - Sign up again with the same email (or trigger welcome email manually)
   - Should NOT receive welcome email
   - Check logs: should see "Skipping welcome email - user has opted out"

#### Test 3: Invalid Unsubscribe Token

1. **Try unsubscribe with invalid token**:
   ```
   /unsubscribe?email=your.email@example.com&token=invalid_token
   ```

2. **Expected behavior**:
   - Shows error message
   - Does not unsubscribe
   - Database remains unchanged

#### Test 4: Already Unsubscribed User

1. **Try to unsubscribe again**:
   - Use the same unsubscribe link
   - Or visit unsubscribe page with valid token

2. **Expected behavior**:
   - Shows "already unsubscribed" message
   - No database changes
   - Option to resubscribe

### 3. Database Testing

#### Check Email Preferences Table

```sql
-- View all email preferences
SELECT email, welcome_emails_enabled, marketing_emails_enabled, 
       unsubscribed_at, created_at 
FROM email_preferences 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for users who have unsubscribed
SELECT email, unsubscribed_at 
FROM email_preferences 
WHERE unsubscribed_at IS NOT NULL;

-- Verify unsubscribe tokens are unique
SELECT unsubscribe_token, COUNT(*) 
FROM email_preferences 
GROUP BY unsubscribe_token 
HAVING COUNT(*) > 1;
-- Should return 0 rows (all tokens should be unique)
```

#### Test Opt-Out Enforcement

```sql
-- Manually opt-out a user
UPDATE email_preferences 
SET welcome_emails_enabled = false, 
    unsubscribed_at = NOW() 
WHERE email = 'test@example.com';

-- Verify opt-out
SELECT checkCanSendWelcomeEmail('test@example.com');
-- Should return false
```

### 4. API Testing

#### Test Unsubscribe API Directly

```bash
# Get unsubscribe token from database first
# Then test the API:

curl "http://localhost:3000/api/unsubscribe?email=your.email@example.com&token=<token>"

# Expected response:
{
  "success": true,
  "message": "You have been successfully unsubscribed from welcome emails."
}
```

#### Test with Invalid Token

```bash
curl "http://localhost:3000/api/unsubscribe?email=your.email@example.com&token=invalid"

# Expected response:
{
  "success": false,
  "error": "Invalid unsubscribe token. Please use the link from your email."
}
```

### 5. End-to-End Testing

#### Complete Flow Test

1. **Fresh signup**:
   - Use a completely new email address
   - Sign up via OAuth or email/password
   - Verify welcome email is received

2. **Unsubscribe**:
   - Click unsubscribe link in email
   - Verify success page
   - Check database for opt-out status

3. **Re-signup attempt**:
   - Try to sign up again with same email
   - Should NOT receive welcome email
   - Check server logs for opt-out message

4. **Resubscribe** (if implemented):
   - Use resubscribe option
   - Verify database update
   - Should receive welcome email again

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Email preferences table created with correct schema
- [ ] First name extraction works from:
  - [ ] `user_metadata.full_name`
  - [ ] `user_metadata.name`
  - [ ] Email prefix (fallback)
- [ ] Welcome email sends on new signup
- [ ] Welcome email includes:
  - [ ] Personalized greeting with first name
  - [ ] Correct subject line
  - [ ] Unsubscribe link with valid token
  - [ ] Privacy Policy link
  - [ ] Terms of Service link
  - [ ] Required footer text
- [ ] Unsubscribe page:
  - [ ] Loads correctly
  - [ ] Validates email and token
  - [ ] Shows success message
  - [ ] Updates database correctly
- [ ] Opt-out enforcement:
  - [ ] Users who unsubscribed don't receive emails
  - [ ] `checkCanSendWelcomeEmail` returns false for opted-out users
- [ ] Error handling:
  - [ ] Invalid tokens are rejected
  - [ ] Missing parameters show error
  - [ ] Email send failures don't block signup
- [ ] Security:
  - [ ] Unsubscribe tokens are unique
  - [ ] Tokens are cryptographically secure
  - [ ] Token validation works correctly

## Common Issues & Solutions

### Issue: Welcome email not sending

**Check:**
1. `SENDGRID_API_KEY` is set correctly
2. SendGrid account is active
3. Domain is verified in SendGrid
4. Check server logs for errors
5. Verify email preferences were created

### Issue: Unsubscribe link not working

**Check:**
1. Token is correctly generated and stored
2. URL encoding is correct
3. `NEXT_PUBLIC_APP_URL` is set correctly
4. Unsubscribe API route is accessible
5. Database update is working

### Issue: User receives email after unsubscribing

**Check:**
1. `checkCanSendWelcomeEmail` is being called
2. Database update was successful
3. `unsubscribed_at` timestamp is set
4. No caching issues

## Local Development Testing

For local testing, you can:

1. **Use a test email service** like Mailtrap or MailHog
2. **Mock SendGrid** in development (don't send real emails)
3. **Use Supabase local instance** for database testing
4. **Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`** for unsubscribe links

## Production Testing

Before deploying to production:

1. ✅ Run all automated tests
2. ✅ Test with real email addresses
3. ✅ Verify unsubscribe links work in production
4. ✅ Check email deliverability
5. ✅ Monitor error logs
6. ✅ Test with multiple email providers (Gmail, Outlook, etc.)

## Monitoring

After deployment, monitor:

- Welcome email send success rate
- Unsubscribe rate
- Error logs for email sending failures
- Database for email preferences creation
- User feedback on email content

