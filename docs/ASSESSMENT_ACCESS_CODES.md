# Assessment Access Code System

## Overview
The technical assessment is now gated behind an access code system to maintain exclusivity and control access.

## Security Features ✅

### Environment-Based Storage
- Access codes are stored in **environment variables**, not hardcoded
- Codes are never exposed to the client-side
- Different codes can be used for dev/staging/production

### Rate Limiting
- **5 failed attempts** allowed per IP address
- **15-minute lockout** after exceeding limit
- Automatic cleanup after lockout period expires
- Prevents brute force attacks

### IP Tracking
- Tracks attempts by client IP address
- Supports proxy headers (`x-forwarded-for`, `x-real-ip`)
- Works with load balancers and CDNs

## Setup

### 1. Configure Environment Variables

Add to your `.env.local` file:
```bash
ASSESSMENT_ACCESS_CODES=HERMES-2026-BETA,ASSESS-EARLY-ACCESS,INVITE-TECH-EVAL
```

**Format**: Comma-separated list (no spaces around commas)
**Note**: Codes are automatically converted to uppercase during validation

### 2. Development Mode
If no environment variable is set:
- Development: Uses fallback code `DEV-TEST-CODE`
- Production: Returns error (no codes configured)

## Current Valid Access Codes
Configure these in your environment:
- `HERMES-2026-BETA`
- `ASSESS-EARLY-ACCESS`
- `INVITE-TECH-EVAL`

## How It Works

### User Flow
1. User navigates to `/assessment`
2. If they don't have access, they see an access code entry screen
3. User enters their invitation code
4. System validates the code via API
5. If valid, user gains access to the assessment page
6. Access persists during the session (stored in component state)

### Technical Implementation

#### Frontend (`app/assessment/page.tsx`)
- State management for access control (`hasAccess`, `accessCode`)
- Access code verification handler
- Gated UI that shows code entry screen before assessment content
- Clean, professional UI with lock icon and help text

#### Backend (`app/api/assessment/verify-code/route.ts`)
- POST endpoint that validates access codes
- Normalizes input (uppercase, trim)
- Returns validation status

## Future Enhancements

### Recommended Improvements
1. **Database Storage**: Move codes from hardcoded array to database table
   - Track code metadata (created_at, expires_at, max_uses, etc.)
   - Link codes to specific campaigns or recruiters

2. **Usage Tracking**:
   ```sql
   CREATE TABLE access_code_usage (
     id UUID PRIMARY KEY,
     code VARCHAR(255),
     user_id UUID REFERENCES users(id),
     used_at TIMESTAMP DEFAULT NOW(),
     ip_address VARCHAR(45)
   );
   ```

3. **Code Generation System**:
   - Admin panel to generate new codes
   - Bulk code generation for campaigns
   - Custom code prefixes for different use cases

4. **Expiration & Limits**:
   - Time-based expiration
   - Usage count limits (e.g., single-use codes)
   - Rate limiting per IP/user

5. **Analytics**:
   - Track conversion rates per code
   - Monitor which codes are most effective
   - Identify unused or expired codes

6. **Session Persistence**:
   - Store access in localStorage or session storage
   - Prevent re-entry on page refresh
   - Optional: Store in database linked to user account

## Adding New Codes

### Quick Method (Current)
Edit `app/api/assessment/verify-code/route.ts`:
```typescript
const VALID_ACCESS_CODES = [
  'HERMES-2026-BETA',
  'ASSESS-EARLY-ACCESS',
  'INVITE-TECH-EVAL',
  'YOUR-NEW-CODE-HERE', // Add new code
];
```

### Future Database Method
```sql
INSERT INTO access_codes (code, expires_at, max_uses, created_by)
VALUES ('NEW-CODE-2026', '2026-12-31', 100, 'admin@hermes.co');
```

## Security Considerations

1. **Rate Limiting**: Implement to prevent brute force attacks
2. **Logging**: Track all verification attempts
3. **Code Complexity**: Use sufficiently complex codes
4. **HTTPS Only**: Ensure codes are transmitted securely
5. **No Client-Side Validation**: All validation happens server-side

## Distribution Strategy

### How to Share Codes
1. **Email Campaigns**: Include in recruitment emails
2. **Direct Outreach**: Share with qualified candidates
3. **Partner Networks**: Provide to recruiting partners
4. **Events**: Distribute at career fairs or tech events

### Code Naming Convention
Recommended format: `[PREFIX]-[YEAR]-[DESCRIPTOR]`
- `HERMES-2026-BETA` - Beta program
- `PARTNER-2026-ACME` - Partner-specific
- `EVENT-2026-TECHCONF` - Event-specific
- `RECRUIT-2026-JAN` - Monthly recruitment batch

## Monitoring

### Key Metrics to Track
- Total verification attempts
- Success vs. failure rate
- Most used codes
- Time to first use after code creation
- Conversion rate (code entry → assessment completion)

## Support

If users don't have an access code, they're directed to:
- Contact their recruiter
- Email: support@joinhermes.co

## Changelog

### 2026-01-27
- Initial implementation of access code system
- Created verification API endpoint
- Added gated UI to assessment page
- Removed assessment link from main navigation
- Documented system architecture and future enhancements
