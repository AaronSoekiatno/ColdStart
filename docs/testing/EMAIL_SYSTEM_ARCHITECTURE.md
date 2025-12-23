# Email System Architecture

## Overview

The email system is separated into two distinct types:

1. **Transactional Emails (Welcome Emails)**
   - Sent automatically when users sign up
   - Controlled by `welcome_emails_enabled` in `email_preferences`
   - Cannot be opted out of easily (but can be unsubscribed)
   - Examples: Welcome email, password reset, account notifications

2. **Marketing Emails (Newsletter)**
   - Sent to waitlist subscribers and opted-in users
   - Controlled by `marketing_emails_enabled` in `email_preferences`
   - Opt-in by default for waitlist signups
   - Examples: Product updates, feature announcements, newsletters

## Database Schema

### `email_preferences` Table

```sql
email                      TEXT PRIMARY KEY
welcome_emails_enabled     BOOLEAN DEFAULT true   -- Transactional emails
marketing_emails_enabled   BOOLEAN DEFAULT false  -- Newsletter/marketing
unsubscribed_at            TIMESTAMP              -- Global unsubscribe
unsubscribe_token          TEXT UNIQUE
created_at                 TIMESTAMP
updated_at                 TIMESTAMP
```

### `waitlist` Table

```sql
id              UUID PRIMARY KEY
email           TEXT UNIQUE
created_at      TIMESTAMP
sent_at         TIMESTAMP          -- When launch email was sent
sent_status     TEXT               -- 'pending', 'sent', 'failed'
error_message   TEXT
```

## Email Types & Preferences

### Welcome Emails (Transactional)
- **Purpose**: Onboarding, account setup
- **Trigger**: User signs up
- **Preference**: `welcome_emails_enabled`
- **Default**: `true` (opt-in by default for new signups)
- **Unsubscribe**: Can unsubscribe, but affects welcome emails only

### Newsletter Emails (Marketing)
- **Purpose**: Product updates, announcements, content
- **Trigger**: Manual send to waitlist/subscribers
- **Preference**: `marketing_emails_enabled`
- **Default**: `false` (opt-in required)
- **Opt-in**: 
  - Waitlist signups: `true` (they explicitly signed up)
  - Regular signups: `false` (must opt-in separately)

## Integration Points

### Waitlist → Email Preferences

When someone joins the waitlist:
1. Add to `waitlist` table
2. Create/update `email_preferences` with `marketing_emails_enabled = true`
3. This opts them into newsletter emails

### Signup → Email Preferences

When someone signs up:
1. Create `email_preferences` with:
   - `welcome_emails_enabled = true` (send welcome email)
   - `marketing_emails_enabled = false` (don't auto-subscribe to newsletter)
2. Send welcome email
3. User can opt-in to newsletter separately

## Sending Emails

### Welcome Email Flow
```typescript
// Check if welcome email can be sent
const canSend = await checkCanSendWelcomeEmail(email);
if (canSend) {
  await sendWelcomeEmail(email, firstName);
}
```

### Newsletter Email Flow
```typescript
// Check if newsletter email can be sent
const canSend = await checkCanSendNewsletterEmail(email);
if (canSend) {
  await sendNewsletterEmail(email, content);
}
```

## Unsubscribe Options

### Option 1: Unsubscribe from All
- Sets `unsubscribed_at` timestamp
- Disables both `welcome_emails_enabled` and `marketing_emails_enabled`
- Complete opt-out

### Option 2: Unsubscribe from Newsletter Only
- Sets `marketing_emails_enabled = false`
- Keeps `welcome_emails_enabled = true`
- Still receives transactional emails

### Option 3: Unsubscribe from Welcome Emails Only
- Sets `welcome_emails_enabled = false`
- Keeps `marketing_emails_enabled` as-is
- Still receives newsletter if opted in

## Best Practices

1. **Clear Separation**: Always check the appropriate preference flag
2. **Respect Opt-outs**: Never send if preference is disabled
3. **Waitlist Integration**: Auto-opt-in waitlist users to newsletter
4. **User Control**: Provide granular unsubscribe options
5. **Compliance**: Follow CAN-SPAM, GDPR, CASL requirements

