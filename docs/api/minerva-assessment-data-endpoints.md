# Minerva Assessment Data Endpoints - Complete Walkthrough

This is a complete breakdown of **everything** stored during the Minerva assessment flow.

---

## Overview: 5 Tables Across 3 Schemas

| Schema | Table | Purpose |
|--------|-------|---------|
| `public` | `interview_sessions` | AI interview state, phases, conversation |
| `public` | `session_commits` | Git commits during coding |
| `public` | `candidates` | User profile + assessment config |
| `admin_audit` | `assessment_scores` | Automated scoring from GitHub Actions |
| `admin_audit` | `prompt_logs` | AI prompt/response logging |
| `candidate_<uuid>` | 4 tables | Private sandbox for assessment task |

---

## Schema 1: `public` (Core Assessment Data)

### Table: `interview_sessions`
**What it tracks:** The AI interview lifecycle from start to finish.

| Column | Type | Description |
|--------|------|-------------|
| `session_id` | TEXT (PK) | Unique identifier (e.g., `session_1767869255063_b1f9zj`) |
| `candidate_id` | UUID (FK) | Links to candidates table |
| `repo_name` | TEXT | Assessment repository name |
| `repo_url` | TEXT | Full GitHub URL |
| `current_phase` | TEXT | KICK_OFF → BUILD → BUG_INJECTION → FIX → POST_MORTEM |
| `status` | TEXT | created → active → completed |
| `phases` | JSONB | State for each phase with timestamps, commits, messages |
| `conversation_history` | JSONB | All AI messages accumulated |
| `phase_history` | JSONB | Timeline of transitions |

**Written by:** `POST /api/interview/start`, phase transitions, Vapi AI calls

---

### Table: `session_commits`
**What it tracks:** Every git push during the coding assessment.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Commit record ID |
| `session_id` | TEXT (FK) | Links to interview_sessions |
| `commit_hash` | TEXT | Git SHA |
| `commit_message` | TEXT | Commit message |
| `added_lines` / `deleted_lines` | INTEGER | Line counts |
| `diff_content` | TEXT | **Full git diff (actual code changes)** |
| `snapshot_storage_path` | TEXT | Path to code snapshot in Storage |

**Written by:** GitHub Actions → `RPC: log_session_commit()`

---

### Table: `candidates` (Assessment Fields)

| Field | Description |
|-------|-------------|
| `assessment_repo_url` | The candidate's private GitHub repo |
| `provisioning_token` | Secret token for API auth |
| `provisioned_schema_name` | Their private DB schema |
| `github_access_token` | OAuth token for repo operations |

---

## Schema 2: `admin_audit` (Scoring & Logging)

### Table: `assessment_scores`
**What it tracks:** Automated scoring results from GitHub Actions.

| Column | Type | Description |
|--------|------|-------------|
| `candidate_id` | TEXT | GitHub username or ID |
| `build_score` | INTEGER | Points for build passing |
| `completion_score` | INTEGER | Points for completing features |
| `enhanced_score` | INTEGER | Bonus points for extras |
| `total_score` | INTEGER | Sum of all scores |
| `artifact_data` | JSONB | Detailed breakdown |
| `workflow_run_id` | TEXT | GitHub Actions run ID |

**Written by:** GitHub Actions scoring workflow

---

### Table: `prompt_logs`
**What it tracks:** Every AI interaction during the assessment.

| Column | Type | Description |
|--------|------|-------------|
| `candidate_id` | TEXT | Who made the request |
| `provider` | TEXT | gemini / openai / etc |
| `model_requested` | TEXT | gemini-1.5-pro |
| `prompt_text` | TEXT | Full prompt sent to AI |
| `response_json` | JSONB | Full AI response |
| `tokens_used` | INTEGER | Token count for billing |
| `response_time_ms` | INTEGER | Latency tracking |

---

## Schema 3: `candidate_<uuid>` (Private Sandbox)

Each candidate gets their own isolated Postgres schema with:

| Table | Purpose |
|-------|---------|
| `users` | Empty - candidate fills this |
| `sessions` | Empty - candidate fills this |
| `events` | Empty - candidate fills this |
| `performance_logs` | **Pre-seeded with 10 rows** |

**Created by:** `RPC: create_candidate_schema(candidate_id)`

---

## API Endpoints Summary

| Endpoint | Purpose |
|----------|---------|
| `POST /api/topcandidates/create-assessment-repo` | Creates GitHub repo + injects config |
| `POST /api/topcandidates/provision` | Creates candidate schema |
| `GET /api/topcandidates/assessment-status` | Returns current assessment status |
| `POST /api/interview/start` | Starts interview session |
| `POST /api/interview/commit` | Records commit events |
| `POST /api/interview/test` | Records test results + triggers transitions |
| `RPC: log_session_commit` | Logs commits from GitHub Actions |

---

## Production Verification Queries

```sql
-- 1. Check candidate setup
SELECT email, assessment_repo_url, provisioning_token, provisioned_schema_name
FROM candidates WHERE email = 'test@example.com';

-- 2. Check interview session
SELECT session_id, current_phase, status, jsonb_array_length(conversation_history) as messages
FROM interview_sessions WHERE candidate_id = '<uuid>' ORDER BY created_at DESC LIMIT 1;

-- 3. Check commits recorded
SELECT commit_hash, commit_message, added_lines, LEFT(diff_content, 200) as diff_preview
FROM session_commits WHERE repo_name LIKE 'hermes-assessment-%' ORDER BY created_at DESC LIMIT 5;

-- 4. Check scores
SELECT candidate_id, build_score, completion_score, enhanced_score, total_score
FROM admin_audit.assessment_scores ORDER BY scored_at DESC LIMIT 10;

-- 5. Check AI usage
SELECT candidate_id, provider, model_requested, tokens_used, response_time_ms
FROM admin_audit.prompt_logs ORDER BY created_at DESC LIMIT 20;
```

---

## End-to-End Testing Checklist

- [ ] Candidate signs up and connects GitHub
- [ ] Assessment repo created → `candidates.assessment_repo_url` populated
- [ ] Schema provisioned → `candidate_<uuid>` schema exists
- [ ] Interview started → `interview_sessions` row created
- [ ] Commit pushed → `session_commits` row with `diff_content`
- [ ] Tests run → `admin_audit.assessment_scores` row created
- [ ] AI calls logged → `admin_audit.prompt_logs` rows created
- [ ] Interview completed → `interview_sessions.status = 'completed'`
