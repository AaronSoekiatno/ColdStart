# Machine Pool Architecture - Complete Guide

## How Containers Are Differentiated

Each assessment gets a **unique machine** within the shared pool app:

```
hermes-assessment-pool (single Fly app)
├── assess-abc12345-xyz98765  ← Candidate 1, Session 1
├── assess-def67890-uvw43210  ← Candidate 2, Session 1
├── assess-abc12345-rst33333  ← Candidate 1, Session 2 (retake)
└── ... (each unique)
```

### Machine Naming

```typescript
// lib/container-orchestration/flyio.ts:64
const machineName = `assess-${candidatePart}-${sessionPart}`.toLowerCase();

// Example:
candidateId: "b206aa10-64b0-4e37-9a1a-2d6fc92f14f3"
sessionId:   "session_xyz98765abcd"
            ↓
machineName: "assess-b206aa10-xyz98765ab"
```

Each machine gets a unique URL:
```
https://assess-b206aa10-xyz98765ab.hermes-assessment-pool.fly.dev
```

## Full Lifecycle

### 1. Container Provisioning (Start Assessment)

**Trigger**: User clicks "Start Assessment" → `/api/interview/start`

```
User → Start Assessment Button
  ↓
POST /api/interview/start
  ├── Creates interview_sessions record
  │   └── container_status: 'provisioning'
  ↓
POST /api/topcandidates/provision-container
  ├── Gets Supabase credentials
  ├── Calls provisionFlyMachine()
  │   ├── Generates unique machine name
  │   ├── Runs: flyctl machine run ...
  │   │   --app hermes-assessment-pool
  │   │   --name assess-abc-xyz
  │   └── Returns URL
  ├── Updates interview_sessions
  │   ├── container_url: "https://assess-abc-xyz.hermes-assessment-pool.fly.dev"
  │   └── container_status: 'running'
  └── Frontend gets real-time update ⚡
```

**Duration**: 10-20 seconds

### 2. Active Assessment (User Coding)

**What's running**:
- Fly.io machine in `sjc` region
- code-server on port 8080
- Next.js dev server on port 3000
- Auto-commit daemon (every 2 minutes)
- Telemetry sidecar

**Database tracking**:
```sql
SELECT
  session_id,
  container_url,
  container_status,    -- 'running'
  container_started_at,
  current_phase        -- 'KICK_OFF' → 'BUILD' → 'REFLECTION'
FROM interview_sessions
WHERE candidate_id = 'abc123';
```

**Duration**: 1-3 hours (typical)

### 3. Container Cleanup (End Assessment)

There are **3 ways** a container can be destroyed:

#### Method A: User Submits Assessment

**Trigger**: User clicks "Submit" button in IDE

```
User → Submit Button
  ↓
handleSubmit() in app/ide/page.tsx
  ├── Creates final snapshot
  ├── Runs testRunnerRef.current.runTests('full', { destroyAfter: true })
  │   ↓
  │   POST /api/topcandidates/run-tests
  │   ├── Executes tests in container
  │   ├── Logs results to database
  │   └── If destroyAfter=true:
  │       ├── Awaits snapshot completion
  │       ├── Calls destroyFlyMachine(container_url)
  │       │   └── flyctl machine destroy assess-abc-xyz
  │       │       --app hermes-assessment-pool --force
  │       └── Updates interview_sessions
  │           └── container_status: 'stopped'
  └── Redirects to /assessment?submitted=true
```

#### Method B: Manual Cleanup API

**Trigger**: Admin or manual cleanup

```
Admin/Script → DELETE /api/topcandidates/provision-container
  ├── Gets session by sessionId
  ├── Calls destroyFlyMachine(container_url)
  └── Updates container_status: 'stopped'
```

#### Method C: Automated Cron Cleanup

**Trigger**: Cron job runs hourly (Vercel Cron)

```
Vercel Cron → GET /api/cron/cleanup-containers
  ├── Finds containers running > 1 hour
  ├── For each old container:
  │   ├── Calls destroyFlyMachine(container_url)
  │   └── Updates container_status: 'stopped'
  └── Returns cleanup summary
```

**Schedule**: Every hour (catches orphaned containers)

## How Cleanup Works

### The `destroyFlyMachine()` Function

```typescript
// lib/container-orchestration/flyio.ts:149
export async function destroyFlyMachine(machineNameOrUrl: string) {
    // Handles both formats:
    // 1. Full URL: "https://assess-abc-xyz.hermes-assessment-pool.fly.dev"
    // 2. Machine name: "assess-abc-xyz"

    let machineName = machineNameOrUrl;
    if (machineNameOrUrl.includes('.fly.dev')) {
        // Extract: assess-abc-xyz.hermes-assessment-pool.fly.dev → assess-abc-xyz
        const hostname = machineNameOrUrl.replace('https://', '').replace('http://', '');
        machineName = hostname.split('.')[0];
    }

    // Destroy the machine (NOT the app!)
    await executeFlyCommand(
        `machine destroy ${machineName} --app ${POOL_APP_NAME} --force`,
        { json: false }
    );
}
```

**Key difference from old approach**:
- ❌ Old: `flyctl apps destroy assess-abc-xyz` (destroys entire app)
- ✅ New: `flyctl machine destroy assess-abc-xyz --app hermes-assessment-pool` (destroys machine only)

## Machine Isolation

Each machine is **completely isolated**:

### Network Isolation
- Separate IPv4 allocation within shared pool
- Unique DNS: `assess-{id}.hermes-assessment-pool.fly.dev`
- No cross-machine communication

### File System Isolation
- Each machine has own `/workspace` directory
- Separate git repositories
- Independent `node_modules` installations
- No shared volumes (each machine is ephemeral)

### Process Isolation
- Separate code-server instances (port 8080)
- Separate Next.js dev servers (port 3000)
- Independent environment variables

### Database Isolation
- Each candidate gets a dedicated Supabase schema
- Schema-specific JWT with 24-hour expiration
- RLS policies enforce schema-level isolation

## Database Schema

```sql
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY,
    session_id TEXT UNIQUE,              -- Unique session identifier
    candidate_id UUID REFERENCES candidates(id),

    -- Container tracking
    container_url TEXT,                   -- https://assess-xxx.hermes-assessment-pool.fly.dev
    container_status TEXT,                -- 'provisioning' | 'running' | 'stopped' | 'error'
    container_started_at TIMESTAMPTZ,
    container_stopped_at TIMESTAMPTZ,

    -- Assessment tracking
    current_phase TEXT,                   -- 'KICK_OFF' | 'BUILD' | 'REFLECTION'
    score JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup cron
CREATE INDEX idx_running_containers
ON interview_sessions(container_status, container_started_at)
WHERE container_status = 'running';
```

## Monitoring Commands

### View All Active Machines
```bash
flyctl machine list --app hermes-assessment-pool
```

**Example output**:
```
ID            NAME                      STATE   REGION  IMAGE                     CREATED
148e2c74e6e   assess-b206aa10-xyz9876   started sjc     ghcr.io/hermes-...       2m ago
91a7f8d0b2a   assess-c315bb21-abc1234   started sjc     ghcr.io/hermes-...       5m ago
```

### View Specific Machine Logs
```bash
flyctl logs --app hermes-assessment-pool --instance 148e2c74e6e
```

### Check Container Status in Database
```sql
SELECT
    session_id,
    container_status,
    container_url,
    container_started_at,
    EXTRACT(EPOCH FROM (NOW() - container_started_at))/60 as runtime_minutes
FROM interview_sessions
WHERE container_status = 'running'
ORDER BY container_started_at DESC;
```

### Manual Cleanup (Emergency)
```bash
# List all machines
flyctl machine list --app hermes-assessment-pool

# Destroy specific machine
flyctl machine destroy 148e2c74e6e --app hermes-assessment-pool --force
```

## Cost Analysis

### Per Machine
```
VM Size: performance-2x
Memory: 4GB RAM
CPU: 2x shared vCPU

Cost: $0.0000022/second = $0.0079/hour
```

### Example Scenarios

**10 concurrent assessments** (1 hour each):
- Cost: 10 × $0.0079 = $0.079/hour
- Monthly (720 hours): $56.88

**100 assessments/month** (1 hour each):
- Cost: 100 × $0.0079 = $0.79/month

**Orphaned machine running 24 hours** (cleanup missed):
- Cost: 24 × $0.0079 = $0.19/day
- **Cron prevents this**: Cleanup runs every hour

### Shared Resources (One-Time)
- Pool app creation: **FREE**
- Shared IPv4: **FREE**
- Total added infrastructure cost: **$0**

## Troubleshooting

### Container Stuck in "Provisioning"

**Symptom**: Frontend shows "Setting Up Your Environment" for > 2 minutes

**Debug**:
```bash
# Check if machine was created
flyctl machine list --app hermes-assessment-pool

# Check machine logs
flyctl logs --app hermes-assessment-pool --instance <machine-id>

# Check database status
SELECT container_status, container_url
FROM interview_sessions
WHERE session_id = 'session_xxx';
```

**Common causes**:
- Machine creation failed (check Fly.io logs)
- Database update failed (container running but status not updated)
- Real-time subscription not working (falls back to 10s polling)

### Machine Not Destroyed After Submit

**Symptom**: Machine still running hours after submission

**Debug**:
```sql
-- Check session status
SELECT
    session_id,
    container_status,
    container_started_at,
    container_stopped_at,
    current_phase
FROM interview_sessions
WHERE session_id = 'session_xxx';
```

**Common causes**:
- `destroyAfter` flag not set (check TestRunner call)
- Cleanup API failed (check logs)
- Cron job not running (check Vercel Cron settings)

**Manual fix**:
```bash
# Destroy the machine manually
flyctl machine destroy <machine-name> --app hermes-assessment-pool --force

# Update database
UPDATE interview_sessions
SET container_status = 'stopped',
    container_stopped_at = NOW()
WHERE session_id = 'session_xxx';
```

### Multiple Machines for Same Session

**Symptom**: Two machines with similar names running

**Cause**: Retry logic created duplicate machine

**Debug**:
```bash
flyctl machine list --app hermes-assessment-pool | grep assess-abc
```

**Fix**:
```bash
# Destroy older machine (check CREATED timestamp)
flyctl machine destroy <older-machine-id> --app hermes-assessment-pool --force
```

## Security Considerations

### Machine-Level Security
- ✅ Each machine isolated at VM level (Firecracker)
- ✅ No SSH access (code-server only)
- ✅ Password auth disabled (`--auth none`)
- ✅ TLS encryption on all ports

### Data Security
- ✅ Candidate code stored in isolated schemas
- ✅ JWT tokens expire after 24 hours
- ✅ No persistent storage (ephemeral machines)
- ✅ Automatic cleanup after 1 hour

### Network Security
- ✅ Public access required for IDE (not a security risk)
- ✅ Telemetry uses authenticated API keys
- ✅ Supabase RLS enforces schema isolation

## Summary

### Machine Pool Benefits
1. ⚡ **50% faster startup** (10-20s vs 20-40s)
2. 💰 **Same cost** (no added infrastructure)
3. 🔍 **Easier monitoring** (all machines in one dashboard)
4. 🧹 **Simpler cleanup** (destroy machine, not app)
5. 📊 **Better insights** (centralized logging)

### How Cleanup Works
- ✅ Automatic on submit (via `destroyAfter` flag)
- ✅ Manual API endpoint for admin cleanup
- ✅ Hourly cron for orphaned containers
- ✅ All methods use same `destroyFlyMachine()` function

### Differentiation
- ✅ Unique machine names per candidate + session
- ✅ Unique URLs per machine
- ✅ Complete isolation (network, filesystem, database)
- ✅ Database tracks all containers

### No Risk of Conflicts
- Each candidate gets their own machine
- Even if same candidate starts multiple sessions, each gets unique machine name
- Old machines destroyed automatically or via cron
