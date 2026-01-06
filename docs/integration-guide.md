# Integration Guide: Connecting Minerva with Co-Founder's Dashboard

## Overview

This guide explains how to connect Minerva interview data with your co-founder's dashboard/repository.

## Architecture Options

### Option 1: Shared Supabase Database (Recommended)

If both repos use Supabase:

1. **Use the same Supabase project**
   - Both repos connect to the same Supabase instance
   - Minerva writes to `interview_sessions` table
   - Co-founder's dashboard reads from `interview_sessions` table

2. **Data Flow:**
   ```
   Minerva → Supabase (interview_sessions) → Co-Founder's Dashboard
   ```

3. **Implementation:**
   - Co-founder's dashboard queries `interview_sessions` table
   - Join with `test_candidates` (or your actual candidates table) to get candidate info
   - Display interview progress, phases, conversation history, etc.

### Option 2: API Integration

If co-founder's dashboard is separate:

1. **Create API endpoints in Minerva:**
   - `GET /api/interviews/:sessionId` - Get interview details
   - `GET /api/interviews` - List all interviews
   - `GET /api/candidates/:candidateId/interviews` - Get interviews for a candidate

2. **Co-founder's dashboard calls Minerva API:**
   ```javascript
   // In co-founder's dashboard
   const interview = await fetch('https://your-minerva-api.com/api/interviews/session_123')
     .then(res => res.json());
   ```

3. **Authentication:**
   - Add API key authentication
   - Or use Supabase RLS policies for secure access

### Option 3: Webhook Integration

Minerva sends events to co-founder's dashboard:

1. **Add webhook endpoint in co-founder's dashboard:**
   ```javascript
   POST /api/webhooks/minerva
   Body: {
     event: 'interview_started' | 'phase_changed' | 'interview_completed',
     sessionId: 'session_123',
     data: { ... }
   }
   ```

2. **Configure webhook URL in Minerva:**
   ```bash
   COFOUNDER_WEBHOOK_URL=https://cofounder-dashboard.com/api/webhooks/minerva
   ```

3. **Send events from Minerva:**
   - When interview starts
   - When phase transitions
   - When interview completes/cancels

## Data Structure

### Interview Session Data (in Supabase)

```sql
SELECT 
  session_id,
  candidate_id,
  status,              -- 'created', 'active', 'completed', 'cancelled'
  current_phase,        -- 'KICK_OFF', 'BUILD', 'BUG_INJECTION', 'FIX', 'POST_MORTEM'
  interview_start_time,
  interview_end_time,
  total_vapi_seconds,
  conversation_history, -- JSONB array of messages
  phases,              -- JSONB object with phase details
  phase_history,       -- JSONB array of phase events
  repo_url
FROM interview_sessions
WHERE candidate_id = 'cand_123';
```

### Candidate Data

```sql
-- From test_candidates table (or your actual candidates table)
SELECT 
  id,
  email,
  name,
  github_username
FROM test_candidates
WHERE id = 'cand_123';
```

## Example Integration Code

### In Co-Founder's Dashboard

```javascript
// Fetch interview data from Minerva
async function getInterviewData(sessionId) {
  // Option 1: Direct Supabase query
  const { data } = await supabase
    .from('interview_sessions')
    .select(`
      *,
      test_candidates:test_candidates!candidate_id (
        name,
        email,
        github_username
      )
    `)
    .eq('session_id', sessionId)
    .single();
  
  return data;
}

// Option 2: Via Minerva API
async function getInterviewData(sessionId) {
  const response = await fetch(
    `${MINERVA_API_URL}/api/interviews/${sessionId}`,
    {
      headers: {
        'Authorization': `Bearer ${MINERVA_API_KEY}`
      }
    }
  );
  return response.json();
}
```

## Next Steps

1. **Determine integration method:**
   - Same Supabase? → Use Option 1
   - Separate systems? → Use Option 2 or 3

2. **Share Supabase credentials** (if using Option 1):
   - Supabase URL
   - Service role key (for server-side access)
   - Or anon key (for client-side with RLS)

3. **Create API endpoints** (if using Option 2):
   - Add authentication
   - Document API structure
   - Share API base URL

4. **Set up webhooks** (if using Option 3):
   - Configure webhook URL
   - Implement event handlers
   - Test event delivery

## Questions to Answer

- Does co-founder's dashboard use Supabase?
- What database/backend does co-founder's dashboard use?
- Do you want real-time updates or periodic polling?
- What data does co-founder's dashboard need?
  - Just interview status?
  - Full conversation history?
  - Phase-by-phase breakdown?
  - Code commits and test results?

