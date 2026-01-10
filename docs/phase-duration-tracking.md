# Phase Duration Tracking

This document explains how phase durations are tracked in the Hermes interview system.

## Overview

Each interview phase has its duration tracked through `startTime` and `endTime` timestamps stored in Supabase. These durations can be calculated on-demand or queried directly from the database.

## Storage Structure

### Supabase Schema

Phase timing data is stored in the `interview_sessions` table in the `phases` JSONB column:

```json
{
  "KICK_OFF": {
    "status": "completed",
    "startTime": "2026-01-08T10:00:00.000Z",
    "endTime": "2026-01-08T10:02:15.000Z",
    "vapiCallId": "call_123",
    "commits": [],
    "messages": []
  },
  "BUILD": {
    "status": "completed",
    "startTime": "2026-01-08T10:02:15.000Z",
    "endTime": "2026-01-08T10:25:30.000Z",
    "vapiCallId": null,
    "commits": [...],
    "messages": []
  },
  "POST_MORTEM": {
    "status": "completed",
    "startTime": "2026-01-08T10:25:30.000Z",
    "endTime": "2026-01-08T10:29:45.000Z",
    "vapiCallId": "call_456",
    "commits": [],
    "messages": [...]
  }
}
```

### Key Fields

- **startTime**: ISO timestamp when the phase started
- **endTime**: ISO timestamp when the phase ended (null if still active)
- **status**: Phase status (`pending`, `active`, `completed`, `skipped`)

## Current Phases

As of the latest update, the interview consists of 3 phases:

1. **KICK_OFF**: Vapi-enabled greeting phase (typically 2 minutes)
2. **BUILD**: Coding phase that ends when tests pass (variable duration)
3. **POST_MORTEM**: Vapi-enabled reflection phase (typically 4 minutes) - Candidate reflects on their work

## Accessing Phase Durations

### Programmatically (Node.js/API)

```javascript
import sessionManager from '@/lib/session-manager.js';

// Get session
const session = await sessionManager.getSession(sessionId);

// Get all phase durations
const durations = sessionManager.getPhaseDurations(session);

// Example output:
// {
//   KICK_OFF: {
//     startTime: "2026-01-08T10:00:00.000Z",
//     endTime: "2026-01-08T10:02:15.000Z",
//     durationSeconds: 135,
//     status: "completed",
//     isActive: false
//   },
//   BUILD: {
//     startTime: "2026-01-08T10:02:15.000Z",
//     endTime: "2026-01-08T10:25:30.000Z",
//     durationSeconds: 1395,
//     status: "completed",
//     isActive: false
//   },
//   POST_MORTEM: {
//     startTime: "2026-01-08T10:25:30.000Z",
//     endTime: "2026-01-08T10:29:45.000Z",
//     durationSeconds: 255,
//     status: "completed",
//     isActive: false
//   }
// }
```

### Direct Database Query (Supabase SQL)

```sql
-- Get phase durations for a specific session
SELECT 
  session_id,
  phases->'KICK_OFF'->>'startTime' as kickoff_start,
  phases->'KICK_OFF'->>'endTime' as kickoff_end,
  EXTRACT(EPOCH FROM (
    (phases->'KICK_OFF'->>'endTime')::timestamp - 
    (phases->'KICK_OFF'->>'startTime')::timestamp
  )) as kickoff_duration_seconds,
  phases->'BUILD'->>'startTime' as build_start,
  phases->'BUILD'->>'endTime' as build_end,
  EXTRACT(EPOCH FROM (
    (phases->'BUILD'->>'endTime')::timestamp - 
    (phases->'BUILD'->>'startTime')::timestamp
  )) as build_duration_seconds,
  phases->'POST_MORTEM'->>'startTime' as postmortem_start,
  phases->'POST_MORTEM'->>'endTime' as postmortem_end,
  EXTRACT(EPOCH FROM (
    (phases->'POST_MORTEM'->>'endTime')::timestamp - 
    (phases->'POST_MORTEM'->>'startTime')::timestamp
  )) as postmortem_duration_seconds
FROM interview_sessions
WHERE session_id = 'your-session-id';
```

### Via GitHub Actions (if needed)

If you want to track phase durations from GitHub Actions, you can call the API:

```bash
# Get session status (includes phase info)
curl -X GET "https://your-domain.com/api/interview/status?sessionId=session_123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## When Durations Are Recorded

### Phase Start
- **KICK_OFF**: When `startInterview()` is called
- **BUILD**: When KICK_OFF phase ends and transitions to BUILD

### Phase End
- **KICK_OFF**: When the Vapi call ends (triggered by `vapi_end` event)
- **BUILD**: When tests pass and phase transitions to POST_MORTEM
- **POST_MORTEM**: When the Vapi call ends (triggered by `vapi_end` event)

### Completion
- Interview completes when POST_MORTEM phase ends (no more phases after POST_MORTEM)

## Calculating Durations

Durations are calculated in seconds:

```javascript
function calculateDuration(startTime, endTime) {
    return Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
}
```

## Analytics Queries

### Average Phase Durations

```sql
SELECT 
  AVG(EXTRACT(EPOCH FROM (
    (phases->'KICK_OFF'->>'endTime')::timestamp - 
    (phases->'KICK_OFF'->>'startTime')::timestamp
  ))) as avg_kickoff_seconds,
  AVG(EXTRACT(EPOCH FROM (
    (phases->'BUILD'->>'endTime')::timestamp - 
    (phases->'BUILD'->>'startTime')::timestamp
  ))) as avg_build_seconds,
  AVG(EXTRACT(EPOCH FROM (
    (phases->'POST_MORTEM'->>'endTime')::timestamp - 
    (phases->'POST_MORTEM'->>'startTime')::timestamp
  ))) as avg_postmortem_seconds
FROM interview_sessions
WHERE status = 'completed'
  AND phases->'KICK_OFF'->>'endTime' IS NOT NULL
  AND phases->'BUILD'->>'endTime' IS NOT NULL
  AND phases->'POST_MORTEM'->>'endTime' IS NOT NULL;
```

### Total Interview Duration

```sql
SELECT 
  session_id,
  EXTRACT(EPOCH FROM (
    interview_end_time - interview_start_time
  )) as total_duration_seconds
FROM interview_sessions
WHERE status = 'completed';
```

## Notes

- Phase durations are automatically tracked - no additional setup required
- Durations are stored in UTC timestamps
- Active phases will have `endTime: null` until they complete
- The `getPhaseDurations()` helper function handles null values gracefully
