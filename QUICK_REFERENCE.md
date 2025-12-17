# Hermes Email - Quick Reference

## ✅ Setup Complete

- ✅ Domain: `joinhermes.co` verified in Resend
- ✅ From: `hello@joinhermes.co`
- ✅ DMARC: `p=quarantine; pct=100`
- ✅ SPF: Includes both Namecheap + Amazon SES
- ✅ DKIM: Configured
- ✅ Business address: Added (CAN-SPAM compliant)

## 🚀 Send Test Email

```bash
npm run test-email your.email@gmail.com
```

## 📧 Send to Waitlist

```bash
# Preview (no sending)
npm run send-waitlist -- --dry-run --limit=10

# Send to first 10
npm run send-waitlist -- --limit=10

# Send all
npm run send-waitlist
```

## 📊 Check Metrics

- Dashboard: https://resend.com/emails
- DMARC Reports: `dmarcreports@joinhermes.co`

## 🔍 Verify DNS

```bash
# Check SPF
dig txt joinhermes.co +short

# Should show:
# "v=spf1 include:spf.efwd.registrar-servers.com include:amazonses.com ~all"

# Check DMARC
dig txt _dmarc.joinhermes.co +short

# Check DKIM
dig txt resend._domainkey.joinhermes.co +short
```

## 📈 Domain Warmup Schedule

| Week | Daily Volume | Focus |
|------|-------------|-------|
| Week 1 | 10-75 emails | Most engaged users |
| Week 2 | 100-300 emails | Active users |
| Week 3 | 400-1,200 emails | Broader list |
| Week 4+ | 1,500+ emails | Full volume |

## 🎯 Target Metrics

- Delivery Rate: > 98%
- Bounce Rate: < 2%
- Complaint Rate: < 0.1%
- Click Rate: Higher is better

## ⚠️ If Email Goes to Spam

1. Check authentication headers (spf/dkim/dmarc all pass?)
2. Continue warmup (reputation takes time)
3. Get users to engage (move from spam, reply, click)
4. Monitor metrics daily

## 📝 Files Modified

- [.env.local](.env.local) - Updated `RESEND_FROM_EMAIL`
- [lib/resend.ts](lib/resend.ts) - Lazy-loaded client
- [scripts/send-waitlist-emails.ts](scripts/send-waitlist-emails.ts) - Updated branding
- [scripts/test-email.ts](scripts/test-email.ts) - Test script
- [package.json](package.json) - Added `test-email` command

## 🔗 Resources

- Resend: https://resend.com
- Full Guide: [EMAIL_DELIVERABILITY_SETUP.md](EMAIL_DELIVERABILITY_SETUP.md)
