# Interview Phase Orchestration API

These API endpoints allow the assessment repository to trigger phase transitions when commits are made or tests pass.

## Overview

The assessment repository needs to communicate with the Hermes interview system to:
1. Record commits during BUILD and FIX phases
2. Notify when tests pass (to transition from BUILD → BUG_INJECTION and FIX → POST_MORTEM)

## Session ID Storage

The `sessionId` should be stored in the repository metadata/config file. Recommended location:

**`.hermes/config.json`**
```json
{
  "sessionId": "session_1767869255063_b1f9zj4pd",
  "apiBaseUrl": "https://your-domain.com/api/interview"
}
```

This file should be created when the repository is provisioned and committed to the repository.

## API Endpoints

### Base URL
All endpoints use the base path: `/api/interview`

### 1. Commit Event

**POST** `/api/interview/commit`

Records a commit and triggers phase transition if the current phase is commit-driven.

**Request Body:**
```json
{
  "sessionId": "session_xxx",
  "commitData": {
    "id": "abc123def456",
    "message": "feat: implement feature",
    "timestamp": "2026-01-08T10:00:00Z",
    "author": {
      "name": "Candidate Name",
      "email": "candidate@example.com"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "transitioned": false,
  "currentPhase": "BUILD",
  "phase": { ... },
  "session": { ... }
}
```

**Example (GitHub Actions):**
```yaml
- name: Notify Hermes of Commit
  if: github.event_name == 'push'
  run: |
    SESSION_ID=$(cat .hermes/config.json | jq -r .sessionId)
    curl -X POST https://your-domain.com/api/interview/commit \
      -H "Content-Type: application/json" \
      -d "{
        \"sessionId\": \"$SESSION_ID\",
        \"commitData\": {
          \"id\": \"${{ github.sha }}\",
          \"message\": \"${{ github.event.head_commit.message }}\",
          \"timestamp\": \"${{ github.event.head_commit.timestamp }}\"
        }
      }"
```

### 2. Test Event

**POST** `/api/interview/test`

Records test results and triggers phase transition when tests pass (for BUILD and FIX phases).

**Request Body:**
```json
{
  "sessionId": "session_xxx",
  "testData": {
    "status": "success",
    "conclusion": "success",
    "head_sha": "abc123def456",
    "check_run_id": "12345",
    "details_url": "https://github.com/..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "transitioned": true,
  "currentPhase": "BUG_INJECTION"
}
```

**Example (GitHub Actions - on test success):**
```yaml
- name: Notify Hermes of Test Success
  if: success()
  run: |
    SESSION_ID=$(cat .hermes/config.json | jq -r .sessionId)
    curl -X POST https://your-domain.com/api/interview/test \
      -H "Content-Type: application/json" \
      -d "{
        \"sessionId\": \"$SESSION_ID\",
        \"testData\": {
          \"status\": \"success\",
          \"conclusion\": \"success\",
          \"head_sha\": \"${{ github.sha }}\",
          \"check_run_id\": \"${{ github.event.check_run.id }}\",
          \"details_url\": \"${{ github.event.check_run.html_url }}\"
        }
      }"
```

### 3. Get Session ID (Optional)

**GET** `/api/interview/session-id?repoUrl=...`

Retrieves sessionId for a repository (fallback if config file is missing).

**Query Parameters:**
- `repoUrl` (required): Full repository URL
- `repoName` (optional): Repository name as fallback

**Response:**
```json
{
  "sessionId": "session_xxx",
  "repoUrl": "https://github.com/...",
  "repoName": "hermes-assessment-xxx",
  "status": "active",
  "currentPhase": "BUILD"
}
```

## Phase Transition Triggers

### BUILD Phase
- **Trigger:** `TRANSITION_TRIGGER.PASS` (tests pass)
- **Action:** Call `/api/interview/test` with `conclusion: "success"`
- **Result:** Transitions to BUG_INJECTION phase

### FIX Phase
- **Trigger:** `TRANSITION_TRIGGER.PASS` (tests pass)
- **Action:** Call `/api/interview/test` with `conclusion: "success"`
- **Result:** Transitions to POST_MORTEM phase

## Error Handling

All endpoints return standard HTTP status codes:
- `200`: Success
- `400`: Bad request (missing/invalid parameters)
- `404`: Session not found
- `500`: Server error

Error responses include details:
```json
{
  "error": "Missing sessionId",
  "details": "..."
}
```

## Implementation Checklist

- [ ] Create `.hermes/config.json` file when repository is provisioned
- [ ] Store `sessionId` in config file
- [ ] Add GitHub Actions workflow to call `/api/interview/test` on test success
- [ ] (Optional) Add workflow to call `/api/interview/commit` to track commits
- [ ] Test endpoints with curl/Postman before deploying

## Notes

- The sessionId is secret and should not be exposed in logs
- API endpoints are publicly accessible (no auth required currently)
- Rate limiting may be applied in production
- SessionId can be retrieved via `/api/interview/session-id` if config file is lost
