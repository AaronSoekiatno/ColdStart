# Email Separation Guide: Welcome vs Newsletter

## Overview

The email system is now separated into two distinct types with different opt-in/opt-out mechanisms:

1. **Welcome Emails (Transactional)**
   - Sent automatically on user signup
   - Controlled by `welcome_emails_enabled`
   - Default: `true` (opt-in by default)

2. **Newsletter Emails (Marketing)**
   - Sent to waitlist subscribers and opted-in users
   - Controlled by `marketing_emails_enabled`
   - Default: `false` (opt-in required)
   - Waitlist signups: `true` (auto-opted in)

## Key Differences

| Feature | Welcome Email | Newsletter Email |
|---------|--------------|------------------|
| **Type** | Transactional | Marketing |
| **Trigger** | Automatic on signup | Manual send to subscribers |
| **Preference Flag** | `welcome_emails_enabled` | `marketing_emails_enabled` |
| **Default** | `true` | `false` |
| **Waitlist Users** | N/A (they haven't signed up) | `true` (auto-opted in) |
| **Function** | `sendWelcomeEmail()` | `sendNewsletterEmail()` |
| **Check Function** | `checkCanSendWelcomeEmail()` | `checkCanSendNewsletterEmail()` |
| **Category** | `welcome` | `newsletter` |

## Implementation Details

### Welcome Email Flow

```typescript
// In app/auth/callback/route.ts
if (isNewSignUp && user.email) {
  // Create preferences (welcome_emails_enabled = true, marketing_emails_enabled = false)
  await getOrCreateEmailPreferences(user.email);
  
  // Check and send welcome email
  const canSend = await checkCanSendWelcomeEmail(user.email);
  if (canSend) {
    await sendWelcomeEmail(user.email, firstName, user.user_metadata);
  }
}
```

### Newsletter Email Flow

```typescript
// When sending to waitlist or newsletter subscribers
const canSend = await checkCanSendNewsletterEmail(email);
if (canSend) {
  await sendNewsletterEmail(email, subject, htmlContent, textContent);
}
```

### Waitlist Integration

When someone joins the waitlist:

```typescript
// In app/api/waitlist/route.ts
// 1. Add to waitlist table
await supabaseAdmin.from("waitlist").insert({ email });

// 2. Create/update email preferences with marketing opt-in
const preferences = await getOrCreateEmailPreferences(email, { 
  marketingOptIn: true  // Waitlist = newsletter subscription
});

// Or update existing preferences
await supabaseAdmin
  .from("email_preferences")
  .update({ marketing_emails_enabled: true })
  .eq("email", email);
```

## Migration Steps

### 1. Run Database Migrations

```bash
# Create email_preferences table
supabase migration up 032_create_email_preferences.sql

# Backfill existing users
supabase migration up 033_backfill_email_preferences.sql

# Sync waitlist to email_preferences
supabase migration up 034_sync_waitlist_to_email_preferences.sql
```

### 2. Update Waitlist Email Scripts

The waitlist email sending scripts now use `sendNewsletterEmail()` instead of `sendWaitlistEmail()`:

- ✅ `scripts/email/sendgrid/sendgrid-send-waitlist-emails.ts` - Updated
- ⚠️ `scripts/email/send-waitlist-emails.ts` - May need update if using Resend

### 3. Update Existing Waitlist Users

Run the sync migration (034) to ensure all waitlist users are opted into newsletter:

```sql
-- This is done automatically by migration 034
-- But you can verify:
SELECT 
  w.email,
  ep.marketing_emails_enabled as newsletter_opted_in
FROM waitlist w
LEFT JOIN email_preferences ep ON w.email = ep.email;
```

## Usage Examples

### Sending Welcome Email

```typescript
import { sendWelcomeEmail } from '@/lib/sendgrid';

// Automatically checks welcome_emails_enabled
await sendWelcomeEmail(
  'user@example.com',
  'John',  // Optional: first name
  { full_name: 'John Doe' }  // Optional: user metadata
);
```

### Sending Newsletter Email

```typescript
import { sendNewsletterEmail } from '@/lib/sendgrid';

// Automatically checks marketing_emails_enabled
await sendNewsletterEmail(
  'user@example.com',
  'Product Update: New Features!',
  '<html>...</html>',  // HTML content
  'Plain text version'  // Optional: text content
);
```

### Checking Preferences

```typescript
import { 
  checkCanSendWelcomeEmail, 
  checkCanSendNewsletterEmail 
} from '@/lib/supabase';

// Check if can send welcome email
const canSendWelcome = await checkCanSendWelcomeEmail('user@example.com');

// Check if can send newsletter
const canSendNewsletter = await checkCanSendNewsletterEmail('user@example.com');
```

## Unsubscribe Behavior

### Global Unsubscribe
- Sets `unsubscribed_at` timestamp
- Disables both `welcome_emails_enabled` and `marketing_emails_enabled`
- Complete opt-out from all emails

### Newsletter-Only Unsubscribe
- Sets `marketing_emails_enabled = false`
- Keeps `welcome_emails_enabled = true`
- Still receives transactional emails

### Welcome-Only Unsubscribe
- Sets `welcome_emails_enabled = false`
- Keeps `marketing_emails_enabled` as-is
- Still receives newsletter if opted in

## Best Practices

1. **Always Check Preferences**: Use the check functions before sending
2. **Respect Opt-outs**: Never send if preference is disabled
3. **Waitlist = Newsletter**: Waitlist signups should auto-opt-in to marketing
4. **Clear Separation**: Use the correct function for each email type
5. **Compliance**: Both types include unsubscribe links and comply with regulations

## Testing

```bash
# Test welcome email
npm run test-welcome-email your.email@example.com

# Test newsletter sending (create a test script)
# Should check marketing_emails_enabled before sending
```

## Summary

- ✅ Welcome emails: Transactional, opt-in by default, sent on signup
- ✅ Newsletter emails: Marketing, opt-in required, sent to waitlist/subscribers
- ✅ Waitlist users: Auto-opted into newsletter (`marketing_emails_enabled = true`)
- ✅ Regular signups: Not auto-opted into newsletter (`marketing_emails_enabled = false`)
- ✅ Separate functions: `sendWelcomeEmail()` vs `sendNewsletterEmail()`
- ✅ Separate checks: `checkCanSendWelcomeEmail()` vs `checkCanSendNewsletterEmail()`

