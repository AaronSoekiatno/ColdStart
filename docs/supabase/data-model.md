# Supabase Data Model - Complete Breakdown (Simplified)

## Overview

Supabase stores **one main table** (`interview_sessions`) that contains interview session state. This is designed for **Minerva-controlled temporary repositories** where candidate profile data lives in your SaaS database.

**Key principle:** Only store interview-specific data in Supabase. Candidate profile data (name, email, phone) stays in your main database.

---

## Table: `interview_sessions`

### Purpose
Store the complete state of each interview session, including:
- Link to candidate in your SaaS
- Temporary repo information (Minerva-controlled)
- Current phase and status
- All historical phase events
- Vapi conversation transcripts
- Timing information

---

## Field-by-Field Breakdown

### 1. Identity (Minimal - Links to Your SaaS)

| Field | Type | Purpose | When Written | When Read |
|-------|------|---------|--------------|-----------|
| `session_id` | TEXT (PK) | Unique identifier for this interview session | Session creation | Every operation |
| `candidate_id` | TEXT | **ONLY link to your SaaS** - Foreign key to your candidates table | Session creation | Joining with your candidate data |

**Why ONLY candidate_id?**
- Your SaaS already has: `candidates (id, name, email, phone, github_username, ...)`
- Storing duplicate data creates sync issues
- When displaying: `JOIN interview_sessions ON candidates.id = session.candidate_id`

**Example:**
```json
{
  "session_id": "session_1735880200_kx9a2b",
  "candidate_id": "cand_12345"
}
```

**Getting candidate name:**
```javascript
// In your SaaS API
const session = await getSession(sessionId);
const candidate = await db.candidates.findById(session.candidateId);

return {
  sessionId: session.sessionId,
  candidateName: candidate.name,  // From YOUR database
  candidateEmail: candidate.email, // From YOUR database
  currentPhase: session.currentPhase
};
```

---

### 2. Repository Information (Minerva-Controlled Repos)

| Field | Type | Purpose | When Written | When Read |
|-------|------|---------|--------------|-----------|
| `repo_name` | TEXT | Name of temporary repo (e.g., "session-abc123") | When repo is created via GitHub API | Webhook matching, display |
| `repo_url` | TEXT | Full GitHub URL under minerva-interviews org | When repo is created | Link generation, candidate access |

**Why?** Each interview uses a **temporary Minerva-controlled repo** that's created on-demand and cleaned up after.

**Example:**
```json
{
  "repo_name": "session-1735880200-kx9a2b",
  "repo_url": "https://github.com/minerva-interviews/session-1735880200-kx9a2b"
}
```

**Repo Workflow:**
```
1. Interview starts
   ↓
2. Create repo: github.com/minerva-interviews/{session_id}
   ↓
3. Generate scoped access token (expires after interview)
   ↓
4. Candidate clones with token
   ↓
5. Webhook sends commits → Match repo_name to session_id
   ↓
6. Interview ends → Archive/delete repo
```

**Webhook Matching:**
```javascript
// Incoming webhook
{
  repository: {
    name: "session-1735880200-kx9a2b",
    full_name: "minerva-interviews/session-1735880200-kx9a2b"
  }
}

// Match to session
const repoName = webhookData.repository.name;
const session = await getSession(repoName); // Use repo name as session ID
```

---

### 3. Current State

| Field | Type | Purpose | When Written | When Read |
|-------|------|---------|--------------|-----------|
| `current_phase` | TEXT | Which phase is active right now (e.g., "BUILD") | Phase start/transition | Determining current interview state |
| `status` | TEXT | Overall interview status: `created`, `active`, `paused`, `completed`, `cancelled` | Status changes | Filtering active interviews |

**Why?** You need to know at a glance: "Is this interview running?" and "What phase are they in?"

**Example:**
```json
{
  "current_phase": "BUG_INJECTION",
  "status": "active"
}
```

**Status Flow:**
```
created → active → completed
            ↓
         paused → active
            ↓
        cancelled
```

**Querying active interviews:**
```sql
SELECT session_id, candidate_id, current_phase
FROM interview_sessions
WHERE status = 'active'
ORDER BY created_at DESC;
```

---

### 4. Timing

| Field | Type | Purpose | When Written | When Read |
|-------|------|---------|--------------|-----------|
| `interview_start_time` | TIMESTAMPTZ | When the interview began (KICK_OFF started) | `startInterview()` | Duration calculations |
| `interview_end_time` | TIMESTAMPTZ | When the interview finished | `completeInterview()` | Total duration reports |
| `created_at` | TIMESTAMPTZ | When session was created | Auto (database trigger) | Sorting, debugging |
| `updated_at` | TIMESTAMPTZ | Last modification time | Auto (database trigger) | Detecting stale sessions |

**Why?** Track how long interviews take, when they started, and audit trail for debugging.

**Example:**
```json
{
  "interview_start_time": "2026-01-02T22:10:00Z",
  "interview_end_time": "2026-01-02T22:32:00Z",
  "created_at": "2026-01-02T22:05:00Z",
  "updated_at": "2026-01-02T22:32:15Z"
}
```

**Duration calculation:**
```javascript
const durationSeconds = (interviewEndTime - interviewStartTime) / 1000;
const durationMinutes = Math.round(durationSeconds / 60);
```

---

### 5. Vapi Tracking

| Field | Type | Purpose | When Written | When Read |
|-------|------|---------|--------------|-----------|
| `active_vapi_call_id` | TEXT | ID of currently active Vapi call (null if no call) | Call start/end | Detecting active calls |
| `total_vapi_seconds` | INTEGER | Total seconds of Vapi usage (for billing) | After each Vapi call ends | Cost reporting |

**Why?** Track Vapi usage for cost analysis and ensure only one call is active at a time.

**Example:**
```json
{
  "active_vapi_call_id": "call_1735880400_abc123",
  "total_vapi_seconds": 540
}
```

**Usage calculation:**
- KICK_OFF: 120 seconds
- BUG_INJECTION: 180 seconds  
- POST_MORTEM: 240 seconds
- **Total:** 540 seconds = 9 minutes = ~$1.17 at $0.13/min

**Cost reporting:**
```javascript
const totalMinutes = session.totalVapiSeconds / 60;
const costPerMinute = 0.13; // Your Vapi rate
const totalCost = totalMinutes * costPerMinute;
```

---

### 6. Phase States (JSONB)

| Field | Type | Purpose | When Written | When Read |
|-------|------|---------|--------------|-----------|
| `phases` | JSONB | State of each phase (KICK_OFF, BUILD, BUG_INJECTION, FIX, POST_MORTEM) | Every phase transition, commit, message store | Checking phase completion, retrieving phase data |

**Why?** Each phase has its own state machine (pending → active → completed). This JSONB object stores all 5 phases' states in one field.

**Structure:**
```json
{
  "KICK_OFF": {
    "status": "completed",
    "startTime": "2026-01-02T22:10:00Z",
    "endTime": "2026-01-02T22:12:00Z",
    "vapiCallId": "call_123",
    "commits": [],
    "notes": [],
    "messages": [
      {"role": "assistant", "content": "Welcome to Minerva!"},
      {"role": "user", "content": "Hi, I'm Alice."}
    ]
  },
  "BUILD": {
    "status": "completed",
    "startTime": "2026-01-02T22:12:00Z",
    "endTime": "2026-01-02T22:22:00Z",
    "vapiCallId": null,
    "commits": [
      {"id": "abc123", "message": "Initial implementation", "timestamp": "2026-01-02T22:22:00Z"}
    ],
    "notes": [],
    "messages": []
  },
  "BUG_INJECTION": {
    "status": "active",
    "startTime": "2026-01-02T22:22:00Z",
    "endTime": null,
    "vapiCallId": "call_456",
    "commits": [],
    "notes": [],
    "messages": []
  },
  "FIX": {
    "status": "pending",
    "startTime": null,
    "endTime": null,
    "vapiCallId": null,
    "commits": [],
    "notes": [],
    "messages": []
  },
  "POST_MORTEM": {
    "status": "pending",
    "startTime": null,
    "endTime": null,
    "vapiCallId": null,
    "commits": [],
    "notes": [],
    "messages": []
  }
}
```

**Per-Phase Fields:**
- `status`: "pending" | "active" | "completed" | "skipped"
- `startTime`: When this phase began
- `endTime`: When this phase ended
- `vapiCallId`: Which Vapi call was active during this phase
- `commits`: Array of GitHub commits made during this phase
- `notes`: Admin notes (future feature)
- `messages`: Vapi conversation transcript for this specific phase

---

### 7. Phase History (JSONB)

| Field | Type | Purpose | When Written | When Read |
|-------|------|---------|--------------|-----------|
| `phase_history` | JSONB | Chronological log of all phase events | Every phase transition, commit | Audit trail, timeline display |

**Why?** This is a **time-ordered event log** showing exactly what happened and when. Used for debugging and displaying interview timelines.

**Structure:**
```json
[
  {
    "phase": "KICK_OFF",
    "action": "started",
    "timestamp": "2026-01-02T22:10:00Z"
  },
  {
    "phase": "KICK_OFF",
    "action": "completed",
    "trigger": "vapi_end",
    "timestamp": "2026-01-02T22:12:00Z"
  },
  {
    "phase": "BUILD",
    "action": "started",
    "timestamp": "2026-01-02T22:12:00Z"
  },
  {
    "phase": "BUILD",
    "action": "commit",
    "commitId": "abc123",
    "timestamp": "2026-01-02T22:22:00Z"
  },
  {
    "phase": "BUILD",
    "action": "completed",
    "trigger": "commit",
    "timestamp": "2026-01-02T22:22:00Z"
  },
  {
    "phase": "BUG_INJECTION",
    "action": "started",
    "timestamp": "2026-01-02T22:22:00Z"
  }
]
```

**Event Types:**
- `started`: Phase began
- `completed`: Phase finished
- `commit`: Candidate pushed code

**Triggers:**
- `timer`: Phase time expired
- `commit`: GitHub commit detected
- `vapi_end`: Vapi call naturally ended
- `manual`: Admin intervention

---

### 8. Conversation History (JSONB)

| Field | Type | Purpose | When Written | When Read |
|-------|------|---------|--------------|-----------|
| `conversation_history` | JSONB | **Accumulated** conversation from ALL Vapi phases | After each Vapi phase ends | Passing context to next Vapi phase |

**Why?** When transitioning from KICK_OFF → BUG_INJECTION → POST_MORTEM, the AI needs to remember what was said earlier. This array accumulates all messages across phases.

**Structure:**
```json
[
  {"role": "assistant", "content": "Welcome to Minerva! What's your name?"},
  {"role": "user", "content": "I'm Alice, and I'll build a React dashboard."},
  {"role": "assistant", "content": "Great choice, Alice! Your repo is ready."},
  {"role": "assistant", "content": "Alice, we've detected a critical bug in your code."},
  {"role": "user", "content": "Oh no! What's the issue?"},
  {"role": "assistant", "content": "The API authentication is broken..."}
]
```

**Difference vs. `phases[PHASE].messages`:**
- `phases.KICK_OFF.messages`: Only KICK_OFF conversation
- `conversation_history`: ALL phases combined (for context passing)

---

## When Data is Written

### Session Creation
```javascript
await createSession('cand_12345');
```
**Writes:**
- `session_id`, `candidate_id`
- `status: 'created'`
- Empty `phases` object (all "pending")
- Empty `phase_history` array
- `repo_name`, `repo_url`: NULL (set when repo is created)

---

### Repo Setup (After GitHub API Call)
```javascript
await updateSession(sessionId, {
  repoName: 'session-abc123',
  repoUrl: 'https://github.com/minerva-interviews/session-abc123'
});
```
**Updates:**
- `repo_name`, `repo_url`

---

### Starting Interview
```javascript
await startInterview(sessionId);
```
**Updates:**
- `status: 'created'` → `'active'`
- `interview_start_time: NOW()`
- `current_phase: 'KICK_OFF'`
- `phases.KICK_OFF.status: 'active'`
- Appends to `phase_history`: `{phase: 'KICK_OFF', action: 'started'}`

---

### Phase Transition
```javascript
await transitionToNextPhase(sessionId, 'commit');
```
**Updates:**
- `current_phase: 'BUILD'` → `'BUG_INJECTION'`
- `phases.BUILD.status: 'completed'`, `phases.BUILD.endTime: NOW()`
- `phases.BUG_INJECTION.status: 'active'`, `phases.BUG_INJECTION.startTime: NOW()`
- Appends to `phase_history`:
  - `{phase: 'BUILD', action: 'completed', trigger: 'commit'}`
  - `{phase: 'BUG_INJECTION', action: 'started'}`

---

### Commit Recorded
```javascript
await recordCommit(sessionId, {id: 'abc123', message: 'Fix bug'});
```
**Updates:**
- Appends to `phases[current_phase].commits`
- Appends to `phase_history`: `{phase: 'FIX', action: 'commit', commitId: 'abc123'}`

---

### Vapi Call Ends
```javascript
await storeConversationMessages(sessionId, 'KICK_OFF', messages);
```
**Updates:**
- `phases.KICK_OFF.messages = [...]`
- Appends to `conversation_history`
- `total_vapi_seconds += duration`
- `active_vapi_call_id = null`

---

## When Data is Read

### Every Operation (Cache-First)
```javascript
const session = await getSession(sessionId);
```
**Reads:** Entire row (if cache miss)

### Finding Active Sessions
```javascript
const session = await getSessionByCandidate(candidateId);
```
**Reads:** Filter by `candidate_id` and `status != 'completed'`

### Current Phase Info
```javascript
const phaseInfo = await getCurrentPhaseInfo(sessionId);
```
**Reads:** 
- `current_phase`
- `phases[current_phase]`
- Calculates elapsed time

### Context Passing
```javascript
const history = await getConversationHistory(sessionId);
```
**Reads:** `conversation_history` array

---

## Integration with Your SaaS Database

### Your Database Structure
```sql
-- Your existing candidates table
CREATE TABLE candidates (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  github_username TEXT,
  created_at TIMESTAMPTZ
);
```

### Supabase Interview Sessions
```sql
-- Minerva session state (separate database)
CREATE TABLE interview_sessions (
  session_id TEXT PRIMARY KEY,
  candidate_id TEXT,  -- References candidates.id
  repo_name TEXT,
  repo_url TEXT,
  current_phase TEXT,
  status TEXT,
  phases JSONB,
  ...
);
```

### Joining Data for Display
```javascript
// Your SaaS API endpoint: GET /api/interviews/:sessionId
async function getInterviewDetails(sessionId) {
  // 1. Get interview session from Supabase
  const session = await minerva.getSession(sessionId);
  
  // 2. Get candidate details from YOUR database
  const candidate = await db.query(
    'SELECT name, email, phone FROM candidates WHERE id = $1',
    [session.candidateId]
  );
  
  // 3. Combine
  return {
    sessionId: session.sessionId,
    candidateName: candidate.name,      // From YOUR DB
    candidateEmail: candidate.email,    // From YOUR DB
    currentPhase: session.currentPhase, // From Supabase
    status: session.status,             // From Supabase
    repoUrl: session.repoUrl,           // From Supabase
    totalVapiMinutes: session.totalVapiSeconds / 60
  };
}
```

---

## Storage Size Estimates

### Per Session

| Data | Size | Notes |
|------|------|-------|
| Identity fields | ~100 bytes | session_id, candidate_id |
| Timing fields | ~100 bytes | Timestamps |
| Vapi tracking | ~50 bytes | IDs, counters |
| `phases` (empty) | ~500 bytes | JSONB structure |
| `phases` (with data) | ~2-5 KB | With commits, messages |
| `phase_history` | ~1-2 KB | 10-20 events |
| `conversation_history` | ~5-15 KB | 20-50 messages |

**Total per session:** ~10-25 KB (vs ~30 KB with redundant candidate data)

**100 sessions:** ~2.5 MB total storage

---

## Why This Design?

### ✅ Advantages

1. **No data duplication** - Candidate data lives in one place
2. **Easier sync** - Update candidate name in your DB, it's automatically reflected
3. **Smaller rows** - Less egress cost from Supabase
4. **Clear separation** - Your SaaS owns candidates, Minerva owns interview state

### ❌ Alternative (Not Recommended)

**Storing candidate data in Supabase:**
```json
{
  "candidate_id": "cand_12345",
  "candidate_name": "Alice Johnson",  // ← Duplicate
  "candidate_email": "alice@example.com", // ← Duplicate
  ...
}
```

**Problems:**
- What if Alice updates her name in your SaaS? Need to sync.
- What if you add a new candidate field? Need to migrate Supabase too.
- Larger rows = higher egress costs.

---

## Summary

**Supabase stores:**
1. **Session identity:** What session is this?
2. **Candidate link:** Which candidate? (ID only, join for details)
3. **Repo info:** Where is the temporary code repo?
4. **Interview state:** What phase, what status?
5. **History:** What has happened so far?
6. **Transcripts:** What did the AI and candidate say?
7. **Timing:** When did everything happen?

**Your SaaS database stores:**
1. **Candidate profiles:** Name, email, phone, GitHub username
2. **Application history:** When they applied, what role
3. **Company data:** Which companies are using Minerva
4. **Billing:** Subscription info

**Clean separation of concerns** for optimal architecture.
