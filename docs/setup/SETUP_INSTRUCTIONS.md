# Minerva Setup Instructions

## Database Setup (Required Before Testing)

### Step 1: Create the Interview Sessions Table

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run the SQL from `lib/supabase-schema.sql` to create the `interview_sessions` table

### Step 2: Create the Test Candidates Table (For Testing)

1. In Supabase SQL Editor
2. Run the SQL from `lib/test-candidates-schema.sql` to create the `test_candidates` table

**This table is required for the email-based candidate lookup to work.**

## Environment Variables

Make sure your `.env.local` has:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Vapi (Required)
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your-vapi-public-key
VAPI_ASSISTANT_ID=your-assistant-id

# GitHub (Optional - only needed for full flow)
GITHUB_ACCESS_TOKEN=your-github-token
GITHUB_ORG_NAME=your-org-name
GITHUB_SEED_REPO=your-seed-repo
```

## Testing the Interview System

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open the app:**
   - Go to `http://localhost:3000`
   - Enter candidate email and name
   - Click "Start Interview Session"

3. **If you see "Loading dashboard..." forever:**
   - Check browser console (F12) for errors
   - Check server terminal for errors
   - Verify `test_candidates` table exists in Supabase
   - Verify `interview_sessions` table exists in Supabase

## Connecting to Your Co-Founder's Database

If you want to use your actual candidate database instead of `test_candidates`:

1. **Option A: Use your existing candidates table**
   - Modify `pages/api/interview/start.js`
   - Replace `test_candidates` with your actual table name
   - Ensure your table has: `id`, `email`, `name`, `github_username` columns

2. **Option B: Create a view or function**
   - Create a database view that maps your candidate table structure
   - Or create a function that looks up candidates

3. **Option C: API Integration**
   - Instead of querying Supabase directly, call your co-founder's API
   - Look up candidate by email from your main database
   - Pass the candidate data to Minerva

## Troubleshooting

### Dashboard Stuck on "Loading..."
- **Check:** Is `test_candidates` table created in Supabase?
- **Check:** Are Supabase environment variables set correctly?
- **Check:** Browser console for API errors
- **Check:** Server terminal for database errors

### "Table does not exist" Error
- Run `lib/test-candidates-schema.sql` in Supabase SQL Editor
- Verify table appears in Supabase Table Editor

### Session Not Found
- Check if session was created successfully
- Look in Supabase `interview_sessions` table
- Check server logs for creation errors

