# CANDIDATE_ID Schema Unification - Summary

## Problem Identified

The codebase had inconsistent usage of `CANDIDATE_ID` and `CANDIDATE_UUID`:

1. **Redundancy**: `CANDIDATE_UUID` was just an alias for `CANDIDATE_ID` (both contained the same UUID value)
2. **Type Confusion**: RPC functions used `p_candidate_id TEXT` for GitHub usernames, conflicting with database `candidate_id UUID`
3. **Schema Mismatch**: `interview_sessions.candidate_id` is UUID, but RPC functions expected TEXT

## Actions Taken

### 1. Removed CANDIDATE_UUID (Redundant Alias)

**Files Modified:**
- ✅ `lib/container-orchestration/flyio.ts` - Removed from Fly.io provisioning
- ✅ `docker/start-assessment.sh` - Removed from local development script
- ✅ `docker/docker-compose.assessment.yml` - Removed from Docker Compose
- ✅ `app/api/topcandidates/provision/route.ts` - Removed from API response
- ✅ `docker/scripts/entrypoint.sh` - Removed from environment injection

**Result**: Only `CANDIDATE_ID` is now used throughout the system.

### 2. Created Database Migration

**File**: `supabase/migrations/047_unify_candidate_identification.sql`

**Changes**:
- Adds `github_username TEXT` column to `interview_sessions` table
- Updates `log_session_commit` RPC function to use clearer parameter names
- Renames `p_candidate_id` to `p_github_username` for clarity
- Adds helper function `get_candidate_id_from_github`
- Adds comprehensive comments explaining the distinction

### 3. Created Documentation

**Files Created:**
- `docs/setup/candidate-id-schema-analysis.md` - Comprehensive analysis of the problem
- `docs/setup/remove-candidate-uuid-guide.md` - Step-by-step migration guide
- `supabase/migrations/047_unify_candidate_identification.sql` - Database migration

## Current State

### Environment Variables (Unified)

**Container receives:**
- `CANDIDATE_ID` - UUID from `public.candidates(id)` ✅
- ~~`CANDIDATE_UUID`~~ - REMOVED ❌

**Database schema:**
- `candidates.id` - UUID (primary key)
- `interview_sessions.candidate_id` - UUID (foreign key)
- `interview_sessions.github_username` - TEXT (NEW - for git tracking)
- `session_commits.candidate_github_username` - TEXT (existing)

### Clear Semantics

| Term | Type | Purpose |
|------|------|---------|
| `CANDIDATE_ID` | UUID | Database primary key, API authentication |
| `github_username` | TEXT | Git commits, repo ownership |
| ~~`CANDIDATE_UUID`~~ | ~~UUID~~ | ~~REMOVED (was redundant)~~ |

## Benefits

1. **Clarity**: One name (`CANDIDATE_ID`) for one concept (UUID)
2. **Type Safety**: No more UUID vs TEXT confusion
3. **Maintainability**: Less redundant code
4. **Consistency**: Matches database schema exactly

## Backward Compatibility

### Workspace Scripts

The workspace scripts (`docker/workspace/scripts/provision-key.js`) still support fallback for old `.env.local` files:

```javascript
// Provides backward compatibility
const candidateId = credentials.CANDIDATE_ID || credentials.CANDIDATE_UUID;
```

This ensures old containers with `CANDIDATE_UUID` in their `.env.local` continue to work.

### Migration Path

1. **Immediate**: New containers receive only `CANDIDATE_ID`
2. **Short-term**: Old containers with `CANDIDATE_UUID` still work (fallback)
3. **Long-term**: Remove fallback once all old containers are decommissioned

## Next Steps

### Required (Database Migration)

Run the migration to add `github_username` to `interview_sessions`:

```bash
# Apply migration 047
supabase db push
```

### Optional (Cleanup)

After all old containers are gone:
1. Remove fallback logic from workspace scripts
2. Remove any remaining references to `CANDIDATE_UUID`

### Testing

Verify the changes:
- [ ] New containers start successfully
- [ ] `.env.local` contains only `CANDIDATE_ID`
- [ ] Workspace scripts work correctly
- [ ] API authentication works
- [ ] Telemetry tracking works
- [ ] Old containers with `CANDIDATE_UUID` still function (backward compat)

## Files Changed

### Code Changes (Completed)
1. `lib/container-orchestration/flyio.ts`
2. `docker/start-assessment.sh`
3. `docker/docker-compose.assessment.yml`
4. `app/api/topcandidates/provision/route.ts`
5. `docker/scripts/entrypoint.sh`

### Database Changes (Pending)
6. `supabase/migrations/047_unify_candidate_identification.sql` (needs to be applied)

### Documentation (Completed)
7. `docs/setup/candidate-id-schema-analysis.md`
8. `docs/setup/remove-candidate-uuid-guide.md`

## Summary

The codebase now has a clear, unified approach to candidate identification:

- **`CANDIDATE_ID`** (UUID) = Database identifier
- **`github_username`** (TEXT) = Git/repo identifier
- **No more `CANDIDATE_UUID`** = Eliminated redundancy

This eliminates confusion and makes the system more maintainable.
