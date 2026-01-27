# Data Capture Tests Documentation

## Overview

This document describes the comprehensive unit tests for data capture in the Hermes assessment platform, specifically for the IDE page (`app/ide/page.tsx`) and Post-Mortem page (`app/post-mortem/page.tsx`).

## Test Files

### 1. `ide-data-capture.test.js` (15 tests)

Tests data capture functionality in the IDE page during assessment.

#### Test Suites:

**Session Tracking**
- ✓ Fetches container info with session tracking
- ✓ Handles setting `interview_start_time` on first load
- ✓ Tracks container status transitions (loading → provisioning → running)

**Time Tracking**
- ✓ Calculates elapsed time from start time
- ✓ Formats time correctly (MM:SS)
- ✓ Detects when 20-minute time limit is reached

**Snapshot Creation**
- ✓ Validates snapshot creation request data
- ✓ Logs snapshot data to `session_commits` table via RPC

**Test Execution**
- ✓ Validates test execution request data
- ✓ Logs test results to database via `log_test_result` RPC
- ✓ Handles test results with proper structure

**Tab Switch Detection**
- ✓ Detects tab visibility changes
- ✓ Allows preview without warning

**Container Status Integration**
- ✓ Updates container status correctly
- ✓ Extracts Fly app name from container URL

### 2. `post-mortem-data-capture.test.js` (19 tests)

Tests data capture functionality in the post-mortem survey page.

#### Test Suites:

**Survey Data Validation**
- ✓ Validates survey answer structure
- ✓ Enforces required fields (q1, q2 required; q3 optional)
- ✓ Validates difficulty rating range (1-10)

**Word Count Validation**
- ✓ Counts words correctly
- ✓ Enforces 200-word limit per answer
- ✓ Handles edge cases in word counting
- ✓ Validates all three answers independently

**Form Submission**
- ✓ Authenticates user before submission
- ✓ Retrieves candidate information
- ✓ Finds latest session for candidate
- ✓ Calls `submit_post_mortem` RPC with correct parameters
- ✓ Handles submission errors gracefully

**Complete Submission Flow**
- ✓ Validates complete submission payload
- ✓ Prevents submission when validation fails
- ✓ Allows submission when all validations pass

**Database Schema Compliance**
- ✓ Matches expected `post_mortem` table structure

**Error Handling**
- ✓ Handles missing candidate gracefully
- ✓ Handles missing session gracefully
- ✓ Handles unauthorized access

### 3. `assessment-data-integration.test.js` (14 tests)

Tests the complete end-to-end data capture flow.

#### Test Suites:

**Complete Assessment Flow**
- ✓ Tracks complete assessment lifecycle
- ✓ Captures snapshot data correctly
- ✓ Captures test execution results
- ✓ Captures post-mortem survey data

**Data Integrity**
- ✓ Maintains `session_id` consistency across all data points
- ✓ Maintains `candidate_id` consistency
- ✓ Tracks timestamps correctly in chronological order

**Assessment Metrics Calculation**
- ✓ Calculates assessment score correctly
- ✓ Tracks time metrics accurately
- ✓ Calculates completeness metrics

**Error Recovery**
- ✓ Preserves session data if snapshot fails
- ✓ Allows test execution even if snapshot fails
- ✓ Allows survey submission regardless of test results

**Data Validation**
- ✓ Validates required data at each stage

## Data Capture Points

### IDE Page (`app/ide/page.tsx`)

The IDE page captures the following data:

#### 1. Session Tracking
- **Database Table**: `interview_sessions`
- **Fields Captured**:
  - `session_id` - Unique session identifier
  - `candidate_id` - Candidate identifier
  - `container_url` - Container/workspace URL
  - `container_status` - Status: loading → provisioning → running → stopped
  - `created_at` - Session creation timestamp
  - `interview_start_time` - Official start time for timer
  - `current_phase` - Current assessment phase
  - `container_stopped_at` - Container stop timestamp

#### 2. Time Tracking
- **Start Time**: Set when workspace loads (`interview_start_time`)
- **Elapsed Time**: Calculated continuously (max 1200 seconds = 20 minutes)
- **Auto-submission**: Triggered when time limit reached

#### 3. Snapshot Creation
- **API Endpoint**: `/api/snapshots/create`
- **Database Table**: `session_commits`
- **RPC Function**: `log_session_commit`
- **Data Captured**:
  - Session ID
  - Trigger type (manual, submission, test_completion, etc.)
  - Snapshot storage path
  - Snapshot size in bytes
  - Commit metadata (author, timestamp, message)
  - File count

#### 4. Test Execution
- **API Endpoint**: `/api/topcandidates/run-tests`
- **Database Schema**: `admin_audit.assessment_scores`
- **RPC Function**: `log_test_result`
- **Data Captured**:
  - Session ID
  - Candidate ID
  - Test type (quick or full)
  - Test results (JSON with pass/fail details)
  - Total score
  - Max score

#### 5. Tab Switch Detection
- Tracks when candidate switches tabs/windows
- Allows exceptions for preview functionality
- Used for proctoring purposes

### Post-Mortem Page (`app/post-mortem/page.tsx`)

The Post-Mortem page captures the following data:

#### Survey Submission
- **API Endpoint**: `/api/topcandidates/submit-survey`
- **Database Table**: `post_mortem`
- **RPC Function**: `submit_post_mortem`
- **Data Captured**:
  - `session_id` - Links to assessment session
  - `candidate_id` - Candidate identifier
  - `q1_approach` - Answer to "Walk me through your approach" (required, max 200 words)
  - `q2_production_readiness` - Answer to "Production readiness rating" (required, max 200 words)
  - `q3_claude_mistake` - Answer to "Claude mistakes observed" (optional, max 200 words)
  - `difficulty_score` - Rating 1-10 (required)
  - `submitted_at` - Timestamp of submission

## Running the Tests

### Run all data capture tests:
```bash
npm test -- tests/unit/ide-data-capture.test.js tests/unit/post-mortem-data-capture.test.js tests/unit/assessment-data-integration.test.js
```

### Run individual test files:
```bash
# IDE data capture tests
npm test -- tests/unit/ide-data-capture.test.js

# Post-mortem data capture tests
npm test -- tests/unit/post-mortem-data-capture.test.js

# Integration tests
npm test -- tests/unit/assessment-data-integration.test.js
```

### Run with coverage:
```bash
npm run test:coverage
```

### Run in watch mode (for development):
```bash
npm run test:watch
```

## Test Results Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `ide-data-capture.test.js` | 15 | ✅ All Passing |
| `post-mortem-data-capture.test.js` | 19 | ✅ All Passing |
| `assessment-data-integration.test.js` | 14 | ✅ All Passing |
| **Total** | **48** | **✅ All Passing** |

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Assessment Start                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Session Creation     │
         │  (interview_sessions)  │
         │   - session_id         │
         │   - candidate_id       │
         │   - container_url      │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   IDE Page Activity    │
         │   - Time tracking      │
         │   - Container status   │
         │   - Tab monitoring     │
         └────────────┬───────────┘
                      │
            ┌─────────┴─────────┐
            │                   │
            ▼                   ▼
  ┌──────────────────┐  ┌──────────────────┐
  │  Snapshot        │  │  Test Execution  │
  │  (on submit)     │  │  (on demand)     │
  │                  │  │                  │
  │  session_commits │  │  assessment_     │
  │  table           │  │  scores table    │
  └────────┬─────────┘  └────────┬─────────┘
           │                     │
           └──────────┬──────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   Post-Mortem Survey   │
         │   (post_mortem table)  │
         │   - q1, q2, q3         │
         │   - difficulty_score   │
         └────────────────────────┘
```

## Database Schema References

### Tables Used:
- `public.interview_sessions` - Main session tracking
- `public.candidates` - Candidate information
- `public.session_commits` - Snapshot/commit history
- `admin_audit.assessment_scores` - Test results
- `public.post_mortem` - Survey responses

### RPC Functions Used:
- `log_session_commit` - Logs snapshot data
- `log_test_result` - Logs test execution results
- `submit_post_mortem` - Saves survey responses

## Data Validation Rules

### IDE Page:
1. **Session ID**: Must be non-empty string
2. **Time tracking**: Must start when workspace loads
3. **Elapsed time**: Max 1200 seconds (20 minutes)
4. **Container status**: Must transition through valid states
5. **Snapshot trigger**: Must be one of: manual, submission, test_completion, phase_transition, commit
6. **Test type**: Must be either 'quick' or 'full'

### Post-Mortem Page:
1. **Q1 (Approach)**: Required, max 200 words
2. **Q2 (Production Readiness)**: Required, max 200 words
3. **Q3 (Claude Mistakes)**: Optional, max 200 words
4. **Difficulty Score**: Required, integer 1-10
5. **Submission**: Only allowed when validation passes

## Error Handling

The tests verify proper error handling for:
- Missing session data
- Missing candidate data
- Unauthorized access attempts
- Network failures
- Database errors
- Container provisioning failures
- Snapshot collection failures
- Test execution failures

## Maintenance Notes

### Adding New Data Capture Points:
1. Add validation tests in appropriate test file
2. Update this documentation
3. Ensure RPC functions exist in database
4. Test with both mock and real data

### Modifying Existing Capture:
1. Update relevant tests to match new behavior
2. Ensure backward compatibility where needed
3. Update documentation
4. Run full test suite to ensure no regressions

## Support

For questions or issues with these tests, please:
1. Check the test output for specific error messages
2. Verify database schema matches expected structure
3. Ensure all RPC functions are deployed
4. Review the data flow diagram above
5. Contact the development team
