# Quick Test Guide - Welcome Email

## Quick Start (5 minutes)

### 1. Run Database Migration
```bash
# Apply the migration via Supabase dashboard or CLI
supabase migration up
```

### 2. Test Email Sending
```bash
npm run test-welcome-email your.email@example.com
```

### 3. Test Full Signup Flow
1. Sign up with a new email at your app
2. Check inbox for welcome email
3. Click unsubscribe link
4. Verify unsubscribe page works
5. Try signing up again - should NOT receive email

## Quick Commands

```bash
# Test welcome email functionality
npm run test-welcome-email your.email@example.com

# Test Resend connection (general)
# npm run test-email:resend your.email@example.com

# Check database (via Supabase SQL editor)
SELECT * FROM email_preferences WHERE email = 'your.email@example.com';
```

## What to Verify

✅ Welcome email received after signup  
✅ Email contains unsubscribe link  
✅ Unsubscribe link works  
✅ Database shows opt-out after unsubscribe  
✅ No email sent after opt-out  

## Troubleshooting

**No email received?**
- Check `RESEND_API_KEY` in `.env.local`
- Check Resend dashboard for delivery status
- Check server logs for errors

**Unsubscribe not working?**
- Verify token in database matches link
- Check `NEXT_PUBLIC_APP_URL` is set correctly
- Check API route is accessible

