# Snapshot System Setup Guide

This guide covers the manual setup steps required to complete the snapshot system implementation.

## Overview

The snapshot system has been implemented with the following components:

### Core Infrastructure (lib/snapshot/)
- ✅ `lib/snapshot/filter.ts` - File filtering logic
- ✅ `lib/snapshot/ssh-collector.ts` - SSH tar.gz collection
- ✅ `lib/snapshot/storage.ts` - Supabase Storage operations
- ✅ `lib/snapshot/tar-utils.ts` - Tar extraction utilities

### API Endpoints (app/api/snapshots/)
- ✅ `app/api/snapshots/create/route.ts` - Create snapshot endpoint
- ✅ `app/api/snapshots/download/route.ts` - Download snapshot endpoint
- ✅ `app/api/snapshots/view-file/route.ts` - View file from snapshot endpoint

### UI Components
- ✅ `components/admin/SnapshotControl.tsx` - Admin UI component

### Trigger Mechanisms
- ✅ Auto-snapshot on test completion (full tests)
- ✅ Auto-snapshot on BUILD → REFLECTION phase transition
- ✅ Manual snapshot trigger via UI

### Database Integration
- ✅ Snapshot query helpers in `lib/supabase.ts`
- ✅ Uses existing `session_commits` table (no schema changes needed)

## Manual Setup Steps

### 1. Supabase Storage Bucket Setup

**Step 1: Create the Storage Bucket**

1. Go to Supabase Dashboard → Storage
2. Click "Create a new bucket"
3. Configure the bucket:
   - **Name**: `session-snapshots`
   - **Public**: No (keep private)
   - **File size limit**: 100MB
   - **Allowed MIME types**: `application/gzip`

**Step 2: Apply Storage Policies**

Run the following SQL in Supabase SQL Editor to set up Row Level Security (RLS) policies:

```sql
-- Service role has full access (for API operations)
CREATE POLICY "Service role has full access to session snapshots"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'session-snapshots');

-- Authenticated users can read snapshots from their own sessions
CREATE POLICY "Users can read own session snapshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'session-snapshots'
  AND (storage.foldername(name))[1] IN (
    SELECT session_id FROM interview_sessions
    WHERE candidate_id = (
      SELECT id FROM candidates WHERE email = auth.email()
    )
  )
);
```

### 2. Verify Environment Variables

Ensure the following environment variables are set in your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Required for snapshots

# Fly.io Configuration
FLY_API_TOKEN=your_fly_api_token  # Required for SSH access
```

**Note**: The `SUPABASE_SERVICE_ROLE_KEY` is critical for snapshot operations as it allows the API to bypass RLS and create/access snapshots.

### 3. Verify Database Schema

The snapshot system uses the existing `session_commits` table created in migration `043_create_session_commits_table.sql`. Verify the table exists and has the required columns:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'session_commits'
  AND column_name IN ('snapshot_storage_path', 'snapshot_size_bytes');
```

Expected output:
```
snapshot_storage_path | text
snapshot_size_bytes   | bigint
```

If these columns are missing, run migration 043:
```bash
supabase db reset  # Or manually run the migration
```

### 4. Test the System

#### Manual Test via API

1. **Create a snapshot**:
```bash
curl -X POST http://localhost:3000/api/snapshots/create \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "sessionId": "your_session_id",
    "trigger": "manual",
    "message": "Test snapshot"
  }'
```

Expected response:
```json
{
  "success": true,
  "snapshotId": "uuid-here",
  "storagePath": "session_id/timestamp-snapshot.tar.gz",
  "size": 1234567,
  "metrics": {
    "totalSize": 1234567,
    "fileCount": 42,
    "collectionTime": 5432
  }
}
```

2. **Download a snapshot**:
```bash
curl "http://localhost:3000/api/snapshots/download?sessionId=your_session_id" \
  -H "Cookie: your-session-cookie" \
  -o snapshot.tar.gz
```

3. **View a file from snapshot**:
```bash
curl "http://localhost:3000/api/snapshots/view-file?sessionId=your_session_id&filePath=package.json" \
  -H "Cookie: your-session-cookie"
```

4. **Verify in Supabase**:
   - Check Storage bucket `session-snapshots` for the `.tar.gz` file
   - Check `session_commits` table for a record with populated `snapshot_storage_path`

5. **Extract and verify snapshot contents**:
```bash
tar -tzf snapshot.tar.gz  # List all files
tar -xzf snapshot.tar.gz  # Extract all files
```

Verify the snapshot:
- ✅ Contains: `package.json`, `app/`, `lib/`, `components/`, `tests/`
- ✅ Excludes: `node_modules/`, `.next/`, `*.log`, `.env`

#### Test Automatic Triggers

1. **Test completion trigger**:
   - Run a full test suite via the UI or API
   - Check that a snapshot is created after test completion
   - Verify the `event_type` is `test_completion`

2. **Phase transition trigger**:
   - Progress through an assessment to the BUILD → REFLECTION transition
   - Check that a snapshot is created automatically
   - Verify the `event_type` is `phase_transition`

3. **Manual trigger via UI**:
   - Add the `SnapshotControl` component to an admin page
   - Click "Create Snapshot"
   - Verify success toast and snapshot creation

## Integration Examples

### Add SnapshotControl to Admin Page

```tsx
import { SnapshotControl } from '@/components/admin/SnapshotControl';

export default function AdminPage() {
  const sessionId = 'session_xxx'; // Get from props or state

  return (
    <div>
      <h1>Session Management</h1>
      <SnapshotControl sessionId={sessionId} />
    </div>
  );
}
```

### Query Snapshots in Your Code

```typescript
import {
  getSessionSnapshots,
  getLatestSnapshot,
  getSnapshotsByTrigger
} from '@/lib/supabase';

// Get all snapshots for a session
const snapshots = await getSessionSnapshots('session_xxx');

// Get latest snapshot
const latest = await getLatestSnapshot('session_xxx');

// Get snapshots by trigger type
const testSnapshots = await getSnapshotsByTrigger('session_xxx', 'test_completion');
```

## Performance Expectations

Based on typical workspace sizes:

- **SSH connection**: ~500ms
- **Tar creation**: ~2-5s (depending on file count)
- **Transfer (1-5MB)**: ~1-3s
- **Supabase upload**: ~1-2s
- **Total time**: ~5-10s per snapshot

## Error Handling

The system handles common errors gracefully:

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| SSH timeout | 504 | Container not responding (check Fly.io status) |
| Container not running | 503 | Container is stopped or not provisioned |
| Snapshot too large | 413 | Snapshot exceeds 100MB limit |
| Authentication failed | 401 | Invalid or missing session cookie |
| Unauthorized access | 403 | User doesn't own the session |
| Session not found | 404 | Invalid session ID |

## Troubleshooting

### Snapshot Creation Fails

1. **Check container status**:
```bash
flyctl status -a your-app-name
```

2. **Test SSH access manually**:
```bash
flyctl ssh console -a your-app-name
```

3. **Check environment variables**:
```bash
# Verify FLY_API_TOKEN is set
echo $FLY_API_TOKEN

# Verify Supabase keys are set
echo $SUPABASE_SERVICE_ROLE_KEY
```

4. **Check logs**:
```bash
# Check Next.js logs for errors
# Look for [Snapshot] prefixed messages
```

### Snapshot Too Large

If snapshots consistently exceed 100MB, review the exclude patterns in `lib/snapshot/filter.ts` to exclude more files:

```typescript
// Add more patterns to generateExcludePatterns()
'your-large-directory',
'your-large-directory/**/*',
```

### Permission Denied

If you get permission errors accessing snapshots:

1. Verify the storage policies are correctly applied
2. Check that the user owns the session (candidate_id matches)
3. Ensure you're using the service role key for API operations

## Future Enhancements

Potential improvements for future iterations:

1. **Incremental Snapshots** - Store only file diffs to reduce storage costs
2. **Snapshot Comparison UI** - Visual diff viewer between snapshots
3. **Full-Text Search** - Search across all files in all snapshots
4. **Automated Cleanup** - Implement 30-day retention policy
5. **Code Quality Metrics** - Extract and analyze code quality from snapshots
6. **Snapshot Scheduling** - Create snapshots at regular intervals
7. **Multi-session Comparison** - Compare code across different sessions

## Support

For issues or questions:
1. Check the logs for `[Snapshot]` prefixed messages
2. Verify all setup steps are completed
3. Test with a small, simple workspace first
4. Review the API endpoint code for detailed error messages

## Summary

The snapshot system is now fully implemented and ready for use. Complete the manual setup steps above, run the tests, and you'll have a comprehensive code snapshot system for your assessment platform.

Key benefits:
- ✅ Automatic code capture at critical points
- ✅ Manual snapshot creation for debugging
- ✅ Secure storage with RLS policies
- ✅ Fast retrieval and file viewing
- ✅ No schema changes required
- ✅ Efficient filtering of junk files
