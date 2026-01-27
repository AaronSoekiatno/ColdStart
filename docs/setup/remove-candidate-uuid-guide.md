# Removing CANDIDATE_UUID - Migration Guide

## Executive Summary

`CANDIDATE_UUID` is redundant and should be removed. It's just an alias for `CANDIDATE_ID` and causes confusion about what it represents.

## What to Keep

**`CANDIDATE_ID`**: The UUID from `public.candidates(id)` table
- This is the canonical candidate identifier
- Used for database lookups
- Used for API authentication (JWT claims)
- Type: UUID

## What to Remove

**`CANDIDATE_UUID`**: Redundant alias for CANDIDATE_ID
- Currently set to the same value as CANDIDATE_ID
- Serves no unique purpose
- Causes confusion

## Migration Steps

### Phase 1: Update Code to Use Only CANDIDATE_ID

#### 1. Remove from Container Provisioning

**File: `lib/container-orchestration/flyio.ts`**
```typescript
// REMOVE this line:
`CANDIDATE_UUID=${config.candidateId}`,

// KEEP this line:
`CANDIDATE_ID=${config.candidateId}`,
```

**File: `docker/start-assessment.sh`**
```bash
# REMOVE this line:
-e "CANDIDATE_UUID=$CANDIDATE_ID" \

# KEEP this line:
-e "CANDIDATE_ID=$CANDIDATE_ID" \
```

**File: `docker/docker-compose.assessment.yml`**
```yaml
# REMOVE this line:
- CANDIDATE_UUID=${CANDIDATE_ID:-}

# KEEP this line:
- CANDIDATE_ID=${CANDIDATE_ID:-}
```

#### 2. Remove from API Responses

**File: `app/api/topcandidates/provision/route.ts`**
```typescript
return NextResponse.json({
  CANDIDATE_ID: candidateId,
  // REMOVE this line:
  // CANDIDATE_UUID: candidateId,
  ...
});
```

#### 3. Update Workspace Scripts (Backward Compatibility)

**File: `docker/workspace/scripts/provision-key.js`**

Keep the fallback for now to support old .env.local files:
```javascript
// This is OK - provides backward compatibility
const candidateId = credentials.CANDIDATE_ID || credentials.CANDIDATE_UUID;
```

But don't write CANDIDATE_UUID to new files:
```javascript
// REMOVE this block:
if (credentials.CANDIDATE_UUID) {
  envLines.push(`CANDIDATE_UUID=${credentials.CANDIDATE_UUID}`);
}

// KEEP only:
if (credentials.CANDIDATE_ID) {
  envLines.push(`CANDIDATE_ID=${credentials.CANDIDATE_ID}`);
}
```

#### 4. Update Entrypoint Script

**File: `docker/scripts/entrypoint.sh`**
```bash
# REMOVE from KEYS array:
"CANDIDATE_UUID"

# KEEP in KEYS array:
"CANDIDATE_ID"
```

### Phase 2: Update Documentation

1. **Environment Variable Docs**
   - Remove all references to CANDIDATE_UUID
   - Clarify that CANDIDATE_ID is a UUID

2. **API Documentation**
   - Update provision endpoint docs
   - Remove CANDIDATE_UUID from response examples

3. **README Files**
   - Update any setup instructions
   - Remove CANDIDATE_UUID from examples

### Phase 3: Deprecation Notice (Optional)

If you want to be extra careful, add a deprecation warning:

**File: `docker/workspace/scripts/provision-key.js`**
```javascript
if (credentials.CANDIDATE_UUID && !credentials.CANDIDATE_ID) {
  console.warn('⚠️  CANDIDATE_UUID is deprecated. Use CANDIDATE_ID instead.');
  credentials.CANDIDATE_ID = credentials.CANDIDATE_UUID;
}
```

## Testing Checklist

After making changes:

- [ ] New containers receive only CANDIDATE_ID
- [ ] `.env.local` contains CANDIDATE_ID (not CANDIDATE_UUID)
- [ ] Workspace scripts work with CANDIDATE_ID
- [ ] API authentication works (JWT contains candidate_id)
- [ ] Telemetry tracking works
- [ ] Old containers with CANDIDATE_UUID still work (backward compat)

## Files to Modify

### Remove CANDIDATE_UUID from:
1. ✅ `lib/container-orchestration/flyio.ts` (line 79)
2. ✅ `docker/start-assessment.sh` (line 68)
3. ✅ `docker/docker-compose.assessment.yml` (line 29)
4. ✅ `app/api/topcandidates/provision/route.ts` (line 174)
5. ✅ `docker/scripts/entrypoint.sh` (line 66)
6. ⚠️ `docker/workspace/scripts/provision-key.js` (keep fallback, remove write)

### Update Documentation:
7. `docs/setup/container-environment.md`
8. `docs/setup/container-environment-quick-ref.md`
9. `README.md` (if applicable)

## Why This Matters

1. **Clarity**: One name for one concept
2. **Maintainability**: Less code to maintain
3. **Less Confusion**: Developers know exactly what CANDIDATE_ID means
4. **Consistency**: Matches database schema (candidate_id is UUID)

## Rollback Plan

If issues arise:
1. Revert the changes to container provisioning
2. Add CANDIDATE_UUID back to environment variables
3. Keep both until all containers are updated

## Timeline

- **Immediate**: Stop writing CANDIDATE_UUID to new containers
- **Week 1**: Update documentation
- **Week 2**: Remove from codebase (keep fallbacks)
- **Month 1**: Remove fallbacks once all old containers are gone
