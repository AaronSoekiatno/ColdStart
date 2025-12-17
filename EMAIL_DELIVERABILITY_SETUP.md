# Email Deliverability Setup Guide for Hermes

## Current Status

### ✅ Completed
- [x] DMARC configured with `p=quarantine; pct=100`
- [x] DKIM configured for `joinhermes.co`
- [x] Domain verified in Resend dashboard
- [x] Changed from `noreply@` to `hello@joinhermes.co`
- [x] Added CAN-SPAM compliant business address
- [x] Updated email branding from ColdStart to Hermes
- [x] Added email tags for tracking
- [x] Created test email script

### 🔄 In Progress
- [ ] SPF record update (DNS propagation in progress)
- [ ] Waiting for test results

### ⏳ To Do
- [ ] Enable click tracking in Resend dashboard
- [ ] Start domain warmup (10-20 emails/day)
- [ ] Monitor metrics daily
- [ ] Build sender reputation

---

## DNS Records Configuration

### Current DNS Setup

**Domain**: `joinhermes.co`
**Verified in Resend**: ✅ Yes

#### DMARC Record
```
Host: _dmarc.joinhermes.co
Type: TXT
Value: v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarcreports@joinhermes.co;
Status: ✅ Active
```

#### DKIM Record
```
Host: resend._domainkey.joinhermes.co
Type: TXT
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD622Y6wM8NThSLpPG3N467nV8OjprvYINoF16I91VA5JAkCG4n9D+mLOtgzIs8AgPtZC+sOn8SZvqbdF7UOa9ezhAaqYRaRWCD/1vYjpzCwNAJnxJl2JuFoqNms7oOVvRYaT463eQlBBINIVdkvB2jsqRtex0JVJFft87igiZffwIDAQAB
Status: ✅ Active
```

#### SPF Record (Updated)
```
Host: joinhermes.co
Type: TXT
Value: v=spf1 include:spf.efwd.registrar-servers.com include:amazonses.com ~all
Status: 🔄 Propagating (updated today)
```

---

## Email Configuration

### From Address
- **Address**: `hello@joinhermes.co`
- **Why**: More friendly than `noreply@`, encourages engagement

### Business Address (CAN-SPAM Compliance)
```
Hermes
13819 Dearborn St.
Eastvale, CA 92880
United States
```

### Tracking
- **Tags**: Added "waitlist" tag for categorization
- **Click Tracking**: ⏳ Need to enable in Resend dashboard
- **Open Tracking**: ❌ Not enabled (can hurt deliverability)

---

## Domain Warmup Schedule

### Why Warmup is Critical
Your domain `joinhermes.co` is brand new. Email providers don't trust it yet. Warmup gradually builds reputation.

### Week 1: Establish Baseline (Days 1-7)
- **Days 1-2**: 10-20 emails/day
- **Days 3-4**: 30-40 emails/day
- **Days 5-7**: 50-75 emails/day
- **Target**: Engaged users only, high open rates

### Week 2: Gradual Increase (Days 8-14)
- **Days 8-10**: 100-150 emails/day
- **Days 11-14**: 200-300 emails/day
- **Monitor**: Bounce rate < 2%, complaints < 0.1%

### Week 3: Scaling Up (Days 15-21)
- **Days 15-17**: 400-600 emails/day
- **Days 18-21**: 800-1,200 emails/day

### Week 4+: Full Volume (Days 22+)
- **Days 22-28**: 1,500-2,500 emails/day
- **Days 29+**: Increase by 50% every 3-5 days

### Critical Rules
1. **Only send to opted-in users**
2. **Prioritize most engaged users first**
3. **If metrics drop, pause for 24-48 hours**
4. **Send at consistent times each day**

---

## Metrics to Monitor

### Daily Tracking (via Resend Dashboard)

| Metric | Target | How to Check |
|--------|--------|--------------|
| **Delivery Rate** | > 98% | Resend → Emails |
| **Bounce Rate** | < 2% | Resend → Emails (filter: bounced) |
| **Complaint Rate** | < 0.1% | Resend → Emails (filter: complained) |
| **Click Rate** | Varies | Resend → Emails (after enabling tracking) |

### Where to Check
- **Resend Dashboard**: https://resend.com/emails
- **DMARC Reports**: Check `dmarcreports@joinhermes.co` inbox
- **Google Postmaster**: https://postmaster.google.com (sign up to monitor Gmail reputation)

---

## Testing Commands

### Send Test Email
```bash
npm run test-email your.email@gmail.com
```

### Send to Waitlist (Limited)
```bash
# Dry run (preview only)
npm run send-waitlist -- --dry-run --limit=10

# Actually send to first 10
npm run send-waitlist -- --limit=10

# Send all pending
npm run send-waitlist

# Retry failed emails
npm run send-waitlist -- --resend-failed
```

---

## How to Check Email Headers

### Gmail
1. Open the email
2. Click three dots (⋮)
3. Click "Show original"
4. Look for:
   - `spf=pass`
   - `dkim=pass`
   - `dmarc=pass`

### Outlook/Hotmail
1. Open the email
2. File → Properties
3. Look at "Internet headers"

### What Good Headers Look Like
```
Authentication-Results: mx.google.com;
       dkim=pass header.i=@joinhermes.co
       spf=pass (google.com: domain of hello@joinhermes.co designates XXX.XXX.XXX.XXX as permitted sender)
       dmarc=pass (p=QUARANTINE sp=QUARANTINE dis=NONE)
```

---

## Common Issues & Solutions

### Issue: Email Goes to Spam
**Causes**:
- Brand new domain (no reputation)
- Low engagement rates
- Spam-like content

**Solutions**:
- ✅ Already done: Updated from `noreply@`, added business address
- ⏳ Do this: Complete domain warmup (most important!)
- ⏳ Do this: Get initial users to engage (move from spam, reply, click)
- ⏳ Do this: Enable click tracking

### Issue: SPF Fails
**Cause**: DNS not updated or not propagated

**Solution**:
- Verify SPF includes `include:amazonses.com`
- Wait 5-30 minutes for DNS propagation
- Check: `dig txt joinhermes.co +short`

### Issue: High Bounce Rate
**Causes**:
- Invalid email addresses
- Typos in email list

**Solutions**:
- Validate emails before sending
- Remove bounced emails from list
- Use double opt-in for signups

---

## Next Steps (Priority Order)

1. **Wait for DNS propagation** (5-30 minutes)
   - Check: `dig txt joinhermes.co +short`
   - Should show: `include:amazonses.com`

2. **Test email delivery again**
   - Run: `npm run test-email your.email@gmail.com`
   - Check: Inbox vs spam
   - Check: Authentication headers

3. **Enable click tracking**
   - Go to: https://resend.com/settings
   - Turn ON: Click Tracking
   - Leave OFF: Open Tracking (hurts deliverability)

4. **Start domain warmup** (Week 1)
   - Day 1: Send 10-20 emails to most engaged users
   - Monitor: Resend dashboard for bounces/complaints
   - Adjust: Based on metrics

5. **Monitor daily**
   - Check Resend dashboard every morning
   - Log metrics in spreadsheet
   - Watch for trends

6. **Build engagement**
   - Ask initial recipients to:
     - Move email from spam to inbox
     - Reply to the email
     - Click "Get Started Now" button
     - Star/favorite the email

---

## Long-Term Improvements (Optional)

### BIMI (Brand Logo in Email)
**Requirement**: VMC or CMC certificate ($1,000-$1,500/year)
**Benefit**: Your logo appears next to emails in Gmail/Yahoo
**Timeline**: Implement after successful launch

**Steps**:
1. Convert logo to SVG Tiny 1.2 (square format)
2. Host at `https://joinhermes.co/bimi-logo.svg`
3. Add BIMI DNS record:
   ```
   Host: default._bimi.joinhermes.co
   Type: TXT
   Value: v=BIMI1; l=https://joinhermes.co/bimi-logo.svg;
   ```
4. (Optional) Get VMC/CMC certificate for Gmail blue checkmark

### Gmail Postmaster Tools
**Purpose**: Monitor domain reputation with Gmail
**Setup**: https://postmaster.google.com
**Benefit**: See spam rate, IP reputation, domain reputation

---

## Resources

- **Resend Dashboard**: https://resend.com
- **Resend Docs**: https://resend.com/docs
- **DMARC Analyzer**: https://mxtoolbox.com/dmarc.aspx
- **Email Header Analyzer**: https://mxtoolbox.com/EmailHeaders.aspx
- **Blacklist Check**: https://mxtoolbox.com/blacklists.aspx
- **BIMI Inspector**: https://bimigroup.org/bimi-generator/

---

## Contact

**Business Address**:
Hermes
13819 Dearborn St.
Eastvale, CA 92880
United States

**Email Addresses**:
- Sending: `hello@joinhermes.co`
- DMARC Reports: `dmarcreports@joinhermes.co`

---

*Last Updated: December 16, 2025*
