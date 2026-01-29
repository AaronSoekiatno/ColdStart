# Email Separation Guide

This guide explains how Hermes handles different types of emails to ensure compliance with anti-spam regulations (CAN-SPAM, GDPR) and provide a great user experience.

## Email Types

### 1. Onboarding Emails (Transactional)
- **Purpose**: Welcome the user, provide next steps, and confirm account creation.
- **Trigger**: Sent immediately after successful signup or onboarding completion.
- **Function**: `sendOnboardingEmail(email, firstName, userMetadata)` in `lib/resend.ts`.
- **Consent**: Implied by the user signing up for the service. Users can still opt out via the unsubscribe link.
- **Preferences**: Controlled by `welcome_emails_enabled` in the `email_preferences` table.

### 2. Newsletter/Marketing Emails (Commercial)
- **Purpose**: Share product updates, job market insights, and promotional content.
- **Trigger**: Sent manually or via automated campaigns.
- **Function**: `sendNewsletterEmail(email, subject, htmlContent)` in `lib/resend.ts`.
- **Consent**: Requires explicit opt-in (e.g., checking a box during signup or joining the waitlist).
- **Preferences**: Controlled by `marketing_emails_enabled` in the `email_preferences` table.

## Technical Implementation

### Database Schema (`email_preferences`)
We maintain a centralized table to track user preferences across both SendGrid (legacy) and Resend (current).

```sql
CREATE TABLE email_preferences (
    email TEXT PRIMARY KEY,
    welcome_emails_enabled BOOLEAN DEFAULT true,
    marketing_emails_enabled BOOLEAN DEFAULT false,
    unsubscribe_token TEXT,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    -- ... other fields
);
```

### Preference Checks
Before sending any email, we check the user's preferences:

```typescript
// For onboarding emails
const canSend = await checkCanSendWelcomeEmail(email);

// For newsletters
const canSend = await checkCanSendNewsletterEmail(email);
```

### Unsubscribe Logic
All emails (both transactional and marketing) MUST include an unsubscribe link. When a user unsubscribes:
1. They are directed to `/unsubscribe`.
2. Their `unsubscribed_at` timestamp is set.
3. Both `welcome_emails_enabled` and `marketing_emails_enabled` are set to `false`.

## Best Practices

1. **Always use the wrapper functions**: Never call the Resend client directly. Use `sendOnboardingEmail()` or `sendNewsletterEmail()` to ensure preference checks are performed.
2. **Provide a plain text fallback**: Always include a text version of your email for better deliverability and accessibility.
3. **Include a physical address**: CAN-SPAM requires a physical mailing address in commercial emails. This is typically included in the email footer.
4. **Honor unsubscribes immediately**: Our system updates the database in real-time to prevent further emails from being sent to unsubscribed users.

## Summary

- ✅ Onboarding emails: Transactional, opt-in by default, sent on signup/onboarding complete
- ✅ Newsletter emails: Marketing, opt-in required, sent to waitlist/subscribers
- ✅ Separate functions: `sendOnboardingEmail()` vs `sendNewsletterEmail()`
- ✅ Separate checks: `checkCanSendWelcomeEmail()` vs `checkCanSendNewsletterEmail()`
