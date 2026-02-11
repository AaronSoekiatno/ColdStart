# LinkedIn Import Feature - Testing Guide

## Prerequisites

### 1. Database Setup

Apply the migration:

```bash
# Using Supabase CLI (recommended)
cd /path/to/Hermes
supabase db push

# Or apply manually via psql
psql -h your-host -U your-user -d your-db \
  -f supabase/migrations/067_create_linkedin_import_tables.sql
```

Verify tables were created:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('linkedin_imports', 'founder_connections', 'linkedin_scrape_jobs');

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'founder_connections';
```

### 2. Environment Variables

Optional: Add to `.env.local` for PhantomBuster testing:

```bash
PHANTOMBUSTER_API_KEY=your_key_here
```

### 3. Test Data

You'll need:
- A test user account (founder/company)
- Sample LinkedIn Connections.csv file (or use test data below)

## Test Data: Sample CSV

Create a file `test-connections.csv`:

```csv
First Name,Last Name,Email Address,Company,Position,Connected On
John,Doe,john@example.com,Acme Corp,Software Engineer,15 Oct 2023
Jane,Smith,jane@example.com,TechStart,Product Manager,03 Jan 2022
Alice,Johnson,,Google,Senior Developer,20 May 2021
Bob,Williams,bob@example.com,Microsoft,Engineering Manager,12 Feb 2020
```

## Testing Checklist

### Phase 1: API Endpoint Testing

#### Test 1: CSV Upload API

```bash
# 1. Create a test CSV file (use sample above)

# 2. Login and get session cookie
# (Do this via browser and copy cookie, or use Postman/Insomnia)

# 3. Upload CSV
curl -X POST http://localhost:3000/api/linkedin/csv-upload \
  -H "Cookie: your-session-cookie-here" \
  -F "file=@test-connections.csv"

# Expected response:
# {
#   "success": true,
#   "importId": "uuid-here",
#   "totalConnections": 4,
#   "matchedConnections": 0-4,
#   "message": "Successfully imported..."
# }
```

**Verify:**
- ✅ Import created in `linkedin_imports` table
- ✅ Connections stored in `founder_connections` table
- ✅ Match count accurate
- ✅ File hash prevents duplicate uploads

#### Test 2: Get Connections API

```bash
# Get all connections
curl http://localhost:3000/api/linkedin/connections \
  -H "Cookie: your-session-cookie"

# Get only matched connections
curl "http://localhost:3000/api/linkedin/connections?matched=true" \
  -H "Cookie: your-session-cookie"

# Expected response:
# {
#   "success": true,
#   "connections": [...],
#   "totalCount": 4
# }
```

**Verify:**
- ✅ Returns user's connections only (RLS working)
- ✅ `matched=true` filters correctly
- ✅ Matched candidates have full candidate details

#### Test 3: Get Imports History

```bash
curl http://localhost:3000/api/linkedin/imports \
  -H "Cookie: your-session-cookie"

# Expected response:
# {
#   "success": true,
#   "imports": [
#     {
#       "id": "uuid",
#       "method": "csv",
#       "status": "complete",
#       "total_connections": 4,
#       "matched_connections": 2,
#       "uploaded_at": "timestamp"
#     }
#   ]
# }
```

#### Test 4: Delete Connections

```bash
curl -X DELETE http://localhost:3000/api/linkedin/connections \
  -H "Cookie: your-session-cookie"

# Expected response:
# {
#   "success": true,
#   "message": "All LinkedIn data deleted successfully."
# }
```

**Verify:**
- ✅ All imports deleted
- ✅ All connections deleted (cascade)
- ✅ Other users' data unaffected

#### Test 5: PhantomBuster Integration (Optional)

Only test if `PHANTOMBUSTER_API_KEY` is configured:

```bash
# Start scrape (use test LinkedIn account)
curl -X POST http://localhost:3000/api/linkedin/scrape \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "linkedinEmail": "test@example.com",
    "linkedinPassword": "test-password"
  }'

# Expected response:
# {
#   "success": true,
#   "jobId": "uuid",
#   "importId": "uuid",
#   "containerId": "pb-container-id",
#   "message": "Scraping job started..."
# }

# Check status
curl "http://localhost:3000/api/linkedin/scrape/status?jobId=uuid-here" \
  -H "Cookie: your-session-cookie"

# Expected response (while running):
# {
#   "success": true,
#   "status": "running",
#   "progress": 45,
#   "message": "Scraping in progress..."
# }

# Expected response (when complete):
# {
#   "success": true,
#   "status": "success",
#   "progress": 100,
#   "totalConnections": 847,
#   "matchedConnections": 8
# }
```

### Phase 2: UI Testing

#### Test 6: Landing Page

Navigate to: `http://localhost:3000/linkedin-import`

**Verify:**
- ✅ Two method cards displayed (CSV and API)
- ✅ Pros/cons listed correctly
- ✅ Important information disclaimer visible
- ✅ Clicking either method navigates to correct page
- ✅ Mobile responsive

#### Test 7: CSV Upload Page

Navigate to: `http://localhost:3000/linkedin-import/csv`

**Verify:**
- ✅ LinkedIn download link works
- ✅ File upload drag-and-drop zone visible
- ✅ Can select CSV file
- ✅ File validation (rejects non-CSV)
- ✅ Upload button disabled until file selected
- ✅ Upload shows loading state
- ✅ Redirects to results on success
- ✅ Shows error message on failure

**Test Cases:**
1. Upload valid CSV ✅
2. Upload non-CSV file ❌ (should show error)
3. Upload same CSV twice ❌ (should show "already uploaded")
4. Upload empty CSV ❌ (should show error)
5. Upload CSV with invalid format ❌ (should show parsing error)

#### Test 8: Scrape Page (API Method)

Navigate to: `http://localhost:3000/linkedin-import/scrape`

**Verify:**
- ✅ Email and password inputs present
- ✅ Security notice displayed
- ✅ Risk disclaimer with checkbox
- ✅ Start button disabled until all fields filled + checkbox checked
- ✅ Shows loading state when starting
- ✅ Progress bar updates during scrape
- ✅ Shows step-by-step progress
- ✅ Redirects to results when complete
- ✅ Shows error with CSV fallback suggestion on failure

**Test Cases:**
1. Start without agreeing to disclaimer ❌ (button disabled)
2. Start with valid credentials ✅
3. Handle PhantomBuster failure gracefully ✅

#### Test 9: Results Page

Navigate to: `http://localhost:3000/linkedin-import/results?importId=xxx`

**Verify:**
- ✅ Success message displayed
- ✅ Match count accurate
- ✅ Matched connections listed
- ✅ Each connection shows:
  - Name and match confidence badge
  - LinkedIn profile link
  - Connection date
  - Company/position
  - Matched candidate details (education, experience, skills)
  - "View Full Profile" button
- ✅ "No matches found" state if 0 matches
- ✅ Mobile responsive

### Phase 3: Integration Testing

#### Test 10: Network Utilities

Create a test script `test-linkedin-network.ts`:

```typescript
import {
  getNetworkContext,
  enrichCandidatesWithNetwork,
  boostNetworkMatches,
  sortWithNetworkFirst,
  getNetworkMatchCount,
} from '@/lib/linkedin-network';

async function testNetworkUtilities() {
  const founderId = 'test-founder-uuid';
  const candidateId = 'test-candidate-uuid';

  // Test 1: Get network context
  const context = await getNetworkContext(candidateId, founderId);
  console.log('Network context:', context);

  // Test 2: Get match count
  const count = await getNetworkMatchCount(founderId);
  console.log('Total matches:', count);

  // Test 3: Enrich candidates
  const candidates = [
    { id: candidateId, name: 'Test Candidate' },
  ];
  const enriched = await enrichCandidatesWithNetwork(candidates, founderId);
  console.log('Enriched:', enriched[0].networkContext);

  // Test 4: Boost matches
  const withScores = [
    { id: candidateId, name: 'Test', priorityScore: 50 },
  ];
  const boosted = await boostNetworkMatches(withScores, founderId);
  console.log('Boosted score:', boosted[0].priorityScore); // Should be 70

  // Test 5: Sort with network first
  const sorted = await sortWithNetworkFirst(candidates, founderId);
  console.log('Sorted:', sorted);
}

testNetworkUtilities();
```

Run: `tsx test-linkedin-network.ts`

### Phase 4: Security Testing

#### Test 11: Row-Level Security

```sql
-- Test as user A
SET LOCAL jwt.claims.user_id = 'user-a-uuid';

-- Insert connection for user A
INSERT INTO founder_connections (user_id, first_name, last_name)
VALUES ('user-a-uuid', 'John', 'Doe');

-- Try to select
SELECT * FROM founder_connections WHERE user_id = 'user-a-uuid';
-- Should return 1 row

-- Try to access user B's connections
SELECT * FROM founder_connections WHERE user_id = 'user-b-uuid';
-- Should return 0 rows (RLS blocks)
```

#### Test 12: Password Security

**Verify:**
- ✅ Password never stored in `linkedin_scrape_jobs` table
- ✅ Password never stored in `linkedin_imports` table
- ✅ Password never logged to console/files
- ✅ Password transmitted over HTTPS only

```sql
-- Check no passwords in any table
SELECT * FROM linkedin_scrape_jobs;
SELECT * FROM linkedin_imports;
-- Should have NO password columns
```

### Phase 5: Error Handling

#### Test 13: Error Scenarios

**Test Cases:**

1. **Duplicate CSV Upload**
   - Upload same file twice
   - Expected: 409 error "File already uploaded"

2. **Invalid CSV Format**
   - Upload CSV with wrong columns
   - Expected: 400 error "Invalid CSV format"

3. **Unauthorized Access**
   - Make API request without auth cookie
   - Expected: 401 error "Unauthorized"

4. **PhantomBuster Not Configured**
   - Start scrape without PHANTOMBUSTER_API_KEY
   - Expected: 503 error with fallback suggestion

5. **PhantomBuster Failure**
   - LinkedIn blocks scrape (2FA/CAPTCHA)
   - Expected: Graceful failure with CSV fallback

6. **Missing Parameters**
   - CSV upload without file
   - Expected: 400 error "No file uploaded"

7. **Large CSV File**
   - Upload CSV with 5000+ connections
   - Expected: Processes successfully (may take longer)

### Phase 6: Performance Testing

#### Test 14: Load Testing

```bash
# Test with various CSV sizes
# Small: 10 connections
# Medium: 100 connections
# Large: 1000 connections
# Extra Large: 5000 connections

# Measure:
# - Upload time
# - Processing time
# - Memory usage
# - Response time

# Expected targets (from spec):
# - API response < 500ms (p95)
# - Import completes < 2 minutes (CSV)
# - Import completes < 10 minutes (API)
```

#### Test 15: Concurrent Users

```bash
# Simulate 10 users uploading simultaneously
# Use Apache Bench or similar

ab -n 10 -c 10 -H "Cookie: auth-cookie" \
  -p test-connections.csv \
  http://localhost:3000/api/linkedin/csv-upload

# Expected:
# - All requests succeed
# - No race conditions
# - Data correctly isolated per user
```

### Phase 7: Mobile Testing

#### Test 16: Responsive Design

Test on:
- Mobile (< 768px)
- Tablet (768px - 1024px)
- Desktop (> 1024px)

**Verify:**
- ✅ Landing page cards stack on mobile
- ✅ Forms usable on mobile
- ✅ Results page readable on mobile
- ✅ Touch targets appropriately sized
- ✅ No horizontal scrolling

## Test Results Documentation

### Expected Results

**Matching Accuracy:**
- Email matches: ~1.0 confidence
- Name + Company: ~0.8 confidence
- Name + School: ~0.7 confidence
- Average match rate: 5-10 per 1000 connections

**Performance:**
- CSV upload: < 2 minutes
- API scrape: 5-10 minutes
- API response times: < 500ms (p95)

**Success Rates:**
- CSV method: 100%
- API method: ~90%

## Troubleshooting Common Issues

### Issue: "Module not found" errors

```bash
# Install dependencies
npm install
```

### Issue: Migration fails

```bash
# Check if tables already exist
psql -c "\dt linkedin*"

# Drop tables if needed (CAUTION: deletes data)
psql -c "DROP TABLE IF EXISTS founder_connections CASCADE;"
psql -c "DROP TABLE IF EXISTS linkedin_imports CASCADE;"
psql -c "DROP TABLE IF EXISTS linkedin_scrape_jobs CASCADE;"

# Re-run migration
supabase db push
```

### Issue: TypeScript errors

```bash
# Run type check
npm run type-check

# Fix errors and re-check
```

### Issue: RLS blocking queries

```sql
-- Temporarily disable RLS for testing (DEVELOPMENT ONLY)
ALTER TABLE linkedin_imports DISABLE ROW LEVEL SECURITY;
ALTER TABLE founder_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_scrape_jobs DISABLE ROW LEVEL SECURITY;

-- Re-enable after testing
ALTER TABLE linkedin_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_scrape_jobs ENABLE ROW LEVEL SECURITY;
```

## Sign-off Criteria

All tests must pass before considering the feature complete:

- [ ] All Phase 1 API tests pass
- [ ] All Phase 2 UI tests pass
- [ ] Network utilities work correctly
- [ ] RLS security verified
- [ ] No passwords stored
- [ ] Error handling works
- [ ] Performance targets met
- [ ] Mobile responsive

## Post-Launch Monitoring

Monitor these metrics:
- Import completion rate (target: >70%)
- Match rate (target: 5-10 per 1000)
- API success rate (target: >90%)
- User satisfaction
## Appendix: How to Find Your LinkedIn Session Cookie (li_at)

For automated scraping methods (like Apify or PhantomBuster), you often need your LinkedIn session cookie. Here is how to find it:

1. **Log in to LinkedIn**: Open [linkedin.com](https://www.linkedin.com) in your browser and ensure you are logged in.
2. **Open Developer Tools**:
   - Right-click anywhere on the page and select **Inspect**.
   - Or press `F12` (Windows/Linux) or `Cmd + Option + I` (Mac).
3. **Navigate to Cookies**:
   - **Chrome/Edge/Brave**: Go to the **Application** tab. In the left sidebar, expand **Cookies** and select `https://www.linkedin.com`.
   - **Firefox**: Go to the **Storage** tab. Expand **Cookies** and select `https://www.linkedin.com`.
   - **Safari**: Go to the **Storage** tab, then **Cookies** in the sidebar.
4. **Locate `li_at`**:
   - In the list of cookies, look for the name **`li_at`**.
   - The string in the **Value** column (it usually starts with `AQED...`) is your session cookie.
5. **Copy the Value**: Double-click the value to select it and copy it.

> ⚠️ **Security Warning**: Your `li_at` cookie is effectively your LinkedIn password. Never share it publicly and only use it in trusted environments.
