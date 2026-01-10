# Assessment Score Storage Infrastructure

This document explains how assessment scores and artifacts are stored in Supabase.

## Overview

When the `score_assessment.yaml` workflow runs, it:
1. Executes Vitest tests to calculate scores
2. Submits results **immediately** to Supabase (durable storage)
3. Creates a local GitHub Actions artifact (90-day retention)

## Database Schema

### Table: `admin_audit.assessment_scores`

Stores all assessment scoring results with full audit trails.

```sql
CREATE TABLE admin_audit.assessment_scores (
  id UUID PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  
  -- Individual score components
  build_score INTEGER,
  completion_score INTEGER,
  enhanced_score INTEGER,
  total_score INTEGER,
  
  -- Complete artifact data (JSONB)
  artifact_data JSONB,
  
  -- Traceability
  workflow_run_id TEXT,
  scored_at TIMESTAMP,
  created_at TIMESTAMP
);
```

### Artifact Data Structure

The `artifact_data` JSONB field contains the complete scoring summary:

```json
{
  "candidate_id": "username",
  "timestamp": "2026-01-07T19:20:00Z",
  "scores": {
    "build_and_types": 15,
    "completion": 35,
    "enhanced": 25,
    "total": 75
  },
  "metrics": {
    "penalty": 0,
    "has_sql_index": true
  },
  "workflow_run_id": "12345",
  "workflow_url": "https://github.com/org/repo/actions/runs/12345"
}
```

## RPC Functions

### `log_assessment_score()`

Called by GitHub Actions to store assessment results.

**Parameters:**
- `p_candidate_id` (TEXT): Candidate identifier
- `p_build_score` (INTEGER): Build & types score
- `p_completion_score` (INTEGER): Completion requirements score
- `p_enhanced_score` (INTEGER): Enhanced features score
- `p_total_score` (INTEGER): Total score
- `p_artifact_data` (JSONB): Complete artifact JSON
- `p_workflow_run_id` (TEXT): GitHub Actions run ID

**Example:**
```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/log_assessment_score" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "p_candidate_id": "john-doe",
    "p_build_score": 15,
    "p_completion_score": 30,
    "p_enhanced_score": 20,
    "p_total_score": 65,
    "p_artifact_data": {...},
    "p_workflow_run_id": "12345"
  }'
```

### `get_latest_assessment_score()`

Retrieves the most recent assessment score for a candidate.

**Parameters:**
- `p_candidate_id` (TEXT): Candidate identifier

**Example:**
```sql
SELECT * FROM get_latest_assessment_score('john-doe');
```

### `get_assessment_score_history()`

Retrieves all assessment scores for a candidate (useful for tracking progress over multiple runs).

**Parameters:**
- `p_candidate_id` (TEXT): Candidate identifier

**Example:**
```sql
SELECT * FROM get_assessment_score_history('john-doe');
```

## Workflow Integration

The workflow is triggered by:
1. **Manual dispatch** - Run manually with a specific `candidate_id`
2. **Push to main** - Automatically when files in `app/insights/**` change

### Workflow Steps:

1. **Run Tests** → Calculate scores using Vitest
2. **Calculate Total** → Apply penalties (e.g., missing SQL index)
3. **Submit to Supabase** → Store scores permanently in `admin_audit.assessment_scores`
4. **Create Artifact** → Generate `score-summary.json` for GitHub Actions (90-day retention)
5. **Upload Artifact** → Upload to GitHub Actions artifacts

## Storage Comparison

| Storage Location | Retention | Access | Purpose |
|-----------------|-----------|--------|---------|
| **Supabase** | Permanent | Direct SQL/API | Production data, analytics, audit trails |
| **GitHub Artifacts** | 90 days | GitHub UI | Debugging, manual review, temporary backup |

## Querying Scores

### Get Latest Score for a Candidate

```sql
SELECT * FROM get_latest_assessment_score('candidate-123');
```

### Get All Scores (Leaderboard)

```sql
SELECT 
  candidate_id,
  total_score,
  scored_at
FROM admin_audit.assessment_scores
ORDER BY total_score DESC, scored_at DESC;
```

### Get Score History for Analysis

```sql
SELECT * FROM get_assessment_score_history('candidate-123')
ORDER BY scored_at DESC;
```

### Query Artifact Data

```sql
-- Get penalty details
SELECT 
  candidate_id,
  total_score,
  artifact_data->'metrics'->>'penalty' as penalty,
  artifact_data->'metrics'->>'has_sql_index' as has_sql_index,
  scored_at
FROM admin_audit.assessment_scores
WHERE candidate_id = 'candidate-123';
```

## Migration

To apply this migration to your Supabase project:

```bash
# If using Supabase CLI
supabase migration up

# Or apply directly via SQL Editor in Supabase Dashboard
# Copy contents of: supabase/migrations/004_assessment_scores.sql
```

## Security

- The `admin_audit` schema is **locked down** - only SECURITY DEFINER functions can write to it
- Candidates cannot tamper with their own scores
- All writes go through RPC functions with proper validation
- GitHub Actions uses the `SUPABASE_SERVICE_KEY` (service role) to bypass RLS

## Monitoring

Track scoring activity:

```sql
-- Recent scoring activity
SELECT 
  candidate_id,
  total_score,
  workflow_run_id,
  scored_at
FROM admin_audit.assessment_scores
ORDER BY scored_at DESC
LIMIT 10;

-- Average scores
SELECT 
  AVG(total_score) as avg_total,
  AVG(build_score) as avg_build,
  AVG(completion_score) as avg_completion,
  AVG(enhanced_score) as avg_enhanced
FROM admin_audit.assessment_scores;
```
