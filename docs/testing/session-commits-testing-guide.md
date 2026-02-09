# Session Commits Testing Guide

This guide walks you through testing the entire session commits system, from database setup to GitHub Action integration.

## Prerequisites

- Supabase project with access to Dashboard
- Access to the seed repository (for GitHub Action updates)
- Node.js and npm installed locally

---

## Step 1: Apply the Database Migration

### Option A: Via Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/migrations/043_create_session_commits_table.sql`
4. Paste into the SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. Verify success: You should see "Success. No rows returned"

### Option B: Via Supabase CLI

```bash
cd /Users/aidannguyen/Downloads/Hermes
supabase db push
```

### Verify Migration Applied

Run this query in SQL Editor to confirm the table exists:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'session_commits'
ORDER BY ordinal_position;
```

You should see columns: `id`, `session_id`, `candidate_github_username`, `repo_name`, etc.

---

## Step 2: Create Supabase Storage Bucket

1. Go to **Supabase Dashboard** → **Storage**
2. Click **New bucket**
3. Configure:
   - **Name**: `session-snapshots`
   - **Public bucket**: ❌ (keep it private)
   - **File size limit**: 50 MB (or higher if needed)
   - **Allowed MIME types**: Leave empty (allow all)
4. Click **Create bucket**

### Set Bucket Policies

After creating the bucket, set up policies:

1. Click on `session-snapshots` bucket → **Policies** tab
2. Add policy for **INSERT**:
   ```sql
   -- Allow anon/service role to upload snapshots
   CREATE POLICY "Allow anon to upload snapshots"
   ON storage.objects FOR INSERT
   TO anon
   WITH CHECK (bucket_id = 'session-snapshots');
   ```

3. Add policy for **SELECT** (for admins to download):
   ```sql
   -- Allow authenticated users to read snapshots
   CREATE POLICY "Allow authenticated to read snapshots"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'session-snapshots');
   ```

---

## Step 3: Test the RPC Function

### 3a. Create a Test Interview Session

First, create a test interview session to link commits to:

```sql
INSERT INTO public.interview_sessions (
  session_id,
  candidate_id,
  repo_name,
  repo_url,
  status,
  created_at
) VALUES (
  'test-session-' || gen_random_uuid()::text,
  'test-candidate-123',
  'hermes-assessment-test',
  'https://github.com/test-candidate-123/hermes-assessment-test',
  'active',
  NOW()
)
RETURNING session_id, candidate_id, repo_name;
```

**Copy the `session_id` from the result** - you'll use it to verify the link.

### 3b. Run the Test Script

```bash
cd /Users/aidannguyen/Downloads/Hermes
npx tsx scripts/test-session-commits.ts
```

**Expected output:**
```
🧪 Testing session commits RPC function...
📤 Calling log_session_commit with test data:
✅ RPC call successful!
📦 Response: {
  "success": true,
  "commit_id": "...",
  "session_id": "test-session-...",
  "message": "Session commit logged successfully"
}
🔍 Querying session_commits table to verify...
✅ Found commit in database:
📊 Session Commit Record:
   ID: ...
   Session ID: test-session-...
   Candidate: test-user-...
   ...
🧹 Cleaning up test data...
✅ Test data cleaned up
🎉 All tests passed! Session commits system is working.
```

### 3c. Verify Session Linking

Query to verify commits are linked to sessions:

```sql
SELECT 
  sc.id,
  sc.session_id,
  sc.candidate_github_username,
  sc.repo_name,
  sc.commit_message,
  sc.added_lines,
  sc.deleted_lines,
  is.status as session_status,
  is.current_phase
FROM public.session_commits sc
LEFT JOIN public.interview_sessions is ON sc.session_id = is.session_id
WHERE sc.candidate_github_username LIKE 'test-%'
ORDER BY sc.created_at DESC
LIMIT 5;
```

---

## Step 4: Update the GitHub Action Workflow

### 4a. Locate the Seed Repository

The seed repository is defined in your environment variables:
- `GITHUB_SEED_REPO_OWNER`
- `GITHUB_SEED_REPO_NAME`

Check your `.env.local` or Vercel environment variables.

### 4b. Update `.github/workflows/check_push.yaml`

Replace the existing workflow with the enhanced version from the implementation plan. Key changes:

1. **Create Code Snapshot** step
2. **Upload Snapshot to Supabase Storage** step
3. **Log Session Commit** step (updated RPC call)

The complete workflow is in: `implementation_plan.md` → "GitHub Action Updates" section.

### 4c. Test Locally (Optional)

You can simulate the GitHub Action locally:

```bash
# Create a test tarball
cd /tmp
mkdir test-snapshot
echo "console.log('test');" > test-snapshot/index.js
tar -czf test-snapshot.tar.gz test-snapshot

# Upload to Supabase Storage (using curl)
curl -X POST \
  "$SUPABASE_URL/storage/v1/object/session-snapshots/test-user/test-repo/test-snapshot.tar.gz" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/gzip" \
  --data-binary "@test-snapshot.tar.gz"

# Call the RPC function
curl -X POST "$SUPABASE_URL/rest/v1/rpc/log_session_commit" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "p_candidate_id": "test-user",
    "p_event": "push",
    "p_added_lines": 10,
    "p_deleted_lines": 2,
    "p_commit_message": "Local test commit",
    "p_repo_name": "test-repo",
    "p_commit_hash": "abc123",
    "p_snapshot_storage_path": "test-user/test-repo/test-snapshot.tar.gz",
    "p_snapshot_size_bytes": 1024
  }'
```

---

## Step 5: End-to-End Test with Real Repository

### 5a. Create a Test Assessment Repository

1. Use your existing `create-assessment-repo` API to create a test repo
2. Or manually create a repo from the seed template

### 5b. Make a Commit and Push

```bash
# Clone the test repo
git clone <test-repo-url>
cd <test-repo>

# Make a change
echo "console.log('test');" > test.js
git add test.js
git commit -m "Test commit for session tracking"
git push
```

### 5c. Verify GitHub Action Ran

1. Go to the repository on GitHub
2. Click **Actions** tab
3. Find the latest workflow run
4. Verify all steps completed successfully:
   - ✅ Create Code Snapshot
   - ✅ Upload Snapshot to Supabase Storage
   - ✅ Log Session Commit to Supabase

### 5d. Verify Data in Supabase

```sql
-- Check latest commits
SELECT 
  sc.*,
  is.session_id,
  is.status as session_status
FROM public.session_commits sc
LEFT JOIN public.interview_sessions is ON sc.session_id = is.session_id
ORDER BY sc.created_at DESC
LIMIT 10;
```

### 5e. Verify Snapshot in Storage

1. Go to **Supabase Dashboard** → **Storage** → `session-snapshots`
2. Navigate to the candidate's folder
3. You should see the `.tar.gz` file
4. Download and extract to verify contents

---

## Step 6: Query Examples

### Get all commits for a session

```sql
SELECT * FROM public.session_commits
WHERE session_id = 'your-session-id'
ORDER BY created_at ASC;
```

### Get commit timeline with metrics

```sql
SELECT 
  commit_timestamp,
  commit_message,
  added_lines,
  deleted_lines,
  net_lines,
  snapshot_size_bytes
FROM public.session_commits
WHERE session_id = 'your-session-id'
ORDER BY commit_timestamp ASC;
```

### Calculate refactor ratio

```sql
SELECT 
  session_id,
  SUM(deleted_lines) as total_deleted,
  SUM(added_lines) as total_added,
  CASE 
    WHEN SUM(added_lines) > 0 
    THEN ROUND(SUM(deleted_lines)::numeric / SUM(added_lines)::numeric, 2)
    ELSE 0
  END as refactor_ratio
FROM public.session_commits
WHERE session_id = 'your-session-id'
GROUP BY session_id;
```

### Get session with all commits

```sql
SELECT 
  is.session_id,
  is.candidate_id,
  is.repo_name,
  is.status,
  is.interview_start_time,
  is.interview_end_time,
  json_agg(
    json_build_object(
      'commit_hash', sc.commit_hash,
      'commit_message', sc.commit_message,
      'timestamp', sc.commit_timestamp,
      'added_lines', sc.added_lines,
      'deleted_lines', sc.deleted_lines,
      'snapshot_path', sc.snapshot_storage_path
    ) ORDER BY sc.commit_timestamp ASC
  ) as commits
FROM public.interview_sessions is
LEFT JOIN public.session_commits sc ON is.session_id = sc.session_id
WHERE is.session_id = 'your-session-id'
GROUP BY is.session_id;
```

---

## Troubleshooting

### RPC function not found

**Error**: `function log_session_commit does not exist`

**Solution**: Run the migration again (Step 1)

### Foreign key violation

**Error**: `insert or update on table "session_commits" violates foreign key constraint`

**Solution**: The `session_id` doesn't exist in `interview_sessions`. Either:
1. Create the interview session first
2. Let the RPC function auto-lookup (it will be NULL if not found)

### Storage upload fails

**Error**: `Bucket not found` or `403 Forbidden`

**Solution**: 
1. Verify bucket exists (Step 2)
2. Check bucket policies allow anon uploads
3. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` secrets in GitHub

### GitHub Action fails

**Error**: Various GitHub Action errors

**Solution**:
1. Check GitHub Action logs for specific error
2. Verify secrets are set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
3. Ensure workflow file is in `.github/workflows/` directory
4. Check file permissions and syntax

---

## Success Criteria

✅ Migration applied successfully  
✅ Storage bucket created with policies  
✅ Test script passes all tests  
✅ GitHub Action completes successfully  
✅ Commits appear in `session_commits` table  
✅ Snapshots appear in `session-snapshots` bucket  
✅ `session_id` correctly links to `interview_sessions`  
✅ Queries return expected data

Once all criteria are met, the session commits system is fully operational! 🎉
