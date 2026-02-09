# Assessment Data Collection & Testing Architecture

This document outlines the complete system for collecting candidate performance data and the specific testing criteria used to generate assessment scores.

## 1. Data Collection Architecture

The assessment platform collects three primary types of data during the candidate's session:

### A. Code Evolution (Git Commits)
**Mechanism:** `run-tests.sh` -> `log_session_commit` RPC
Every time a candidate runs tests, the current state of their codebase is captured.

**Collected Data:**
- **Metadata:** Commit hash, author, timestamp, message.
- **Statistics:** Number of lines added and deleted.
- **Diff Content:** A unified diff (up to 50KB) of changes since the last commit (excluding `node_modules`, lockfiles, etc.).
- **Session Context:** Candidate ID, Session ID.

### B. Assessment Results (Test Execution)
**Mechanism:** `run-tests.sh` (execution) -> `POST /api/topcandidates/run-tests` -> `log_test_result` RPC
Test execution results are parsed from Vitest JSON output and stored.

**Collected Data:**
- **Raw Results:** Complete JSON output from Vitest (suites, assertions, failure messages).
- **Scores:** Calculated points based on passing tests (mapped to categories).
- **Execution Metadata:** Duration, timestamp, environment (local vs. remote).

### C. Session Telemetry (Phase Transitions)
**Mechanism:** `run-tests.sh` -> `POST /api/interview/test`
Tracks the candidate's progress through assessment phases based on test pass/fail status.

**Collected Data:**
- **Status:** Success/Failure of the test run.
- **Conclusion:** Whether the candidate has passed the current phase.
- **Phase Transitions:** Movements between assessment stages (e.g., Development -> Review).

---

## 2. Testing Strategy & Scoring Logic

The assessment uses **Vitest** with **React Testing Library** and **HappyDOM** for integration-style testing. Tests are designed to verify functionality rather than implementation details, making them robust against valid refactoring.

**Total Points: 95** (Automated + Manual)

### Category 1: Build & Types (15 Points)
**File:** `tests/assessment/build.test.ts` & `tests/assessment/type-safety.test.ts`

| Check | Points | details |
|-------|--------|---------|
| **TypeScript Validation** | 15 | Verifies that `tsc --noEmit` passes without errors. Uses pre-compiled checks in production specifically to save time. |
| **Configuration** | - | checks for valid `tsconfig.json`. |
| **Type Quality** | Penalty (-5) | Scans source files for excessive use of `any` (limit: 3 instances). |

### Category 2: Core Requirements (35 Points)
**File:** `tests/assessment/completion.test.tsx`

| Check | Points | Validation Logic |
|-------|--------|------------------|
| **Unlock UI** | 5 | **Static Analysis:**<br>- No "🔒" emoji in source.<br>- No "Locked" in page title.<br>- Placeholder text removed. |
| **Data Fetching** | 15 | **Integration:**<br>- Mocks `/api/insights/performance`.<br>- Verifies API is called.<br>- Verifies data (names, viral scores, views) renders in DOM. |
| **List Rendering** | 5 | **Integration:**<br>- Verifies multiple items render via array mapping. |
| **Highlighting** | 10 | **Integration:**<br>- Verifies high-performers (high viral score) have different CSS classes than normal items. |
| **Code Structure** | - | **AST Analysis:** Verifies usage of `fetch`/`useEffect` patterns. |

### Category 3: Enhanced Features (25 Points)
**Files:** `tests/assessment/enhanced.test.ts` & `tests/assessment/error-handling.test.tsx`

| Check | Points | Validation Logic |
|-------|--------|------------------|
| **Gemini API** | 5 | **File Check:** Verifies existence of `app/api/insights/generate-summary/route.ts`. |
| **Error Handling (500)** | 5 | **Integration:**<br>- Mocks 500 API error.<br>- Verifies error message appears.<br>- Verifies app does not crash.<br>- **AST:** Checks for error state management. |
| **Loading State** | 5 | **Integration:**<br>- Mocks delayed API response.<br>- Verifies loading indicator appears immediately.<br>- Verifies indicator disappears after data load.<br>- **AST:** Checks for loading state management. |
| **Network Failure** | 3 | **Integration:**<br>- Mocks network failure (throw).<br>- Verifies error message appears.<br>- **AST:** Checks for try/catch blocks. |
| **Error Boundary** | 2 (Bonus) | **Static Analysis:** Checks for usage of Error Boundary components. |

### Sabotage Detection (Penalties)
**File:** `tests/assessment/sabotage.test.ts`

| Check | Penalty | Validation Logic |
|-------|---------|------------------|
| **Missing Index** | -10 Points | Scans `supabase/migrations/*.sql` to ensure `CREATE INDEX` has not been removed. |

---

## 3. Notification System & Prompt Tracking

The platform includes additional systems for candidate engagement and AI usage monitoring.

### A. Notification System (Planned)
**Status:** Partially Implemented / Stubbed
**Files:** `lib/notifications.service.ts`, `app/api/notifications/route.ts`, `supabase/migrations/006_seed_notifications_helper.sql`

The notification system is designed to alert candidates about assessment events (e.g., "Tests Passed", "Deployment Complete").
- **Backend:** `notifications.service.ts` defines the interface (`getUserNotifications`, `markAsRead`) but implementation is currently TBD.
- **API:** `GET /api/notifications` exists as a secure endpoint but returns 501 "Not Implemented".
- **Database:** Support tables/views exist (`notifications`) but are not actively used by the current assessment workflow.

### B. Prompt Logging & LLM Tracking
**Status:** IDE Hook Integration
**Files:** `supabase/migrations/004_prompt_logs.sql`, `test-hook-execution.js`

To analyze candidate interaction with AI tools, the platform tracks prompts sent to LLMs (like Cursor/Claude/ChatGPT) via **IDE Hooks**.

**Mechanism:**
1. **Hook Trigger:** When a user submits a prompt in the IDE (e.g., Cursor), a local hook script (`.cursor/hooks/beforeSubmitPrompt.sh`) activates.
2. **Data Capture:** The script captures the prompt text, project context, and timestamp.
3. **RPC Call:** It securely calls the `log_prompt` RPC function in Supabase.
4. **Storage:** Data is stored in `admin_audit.prompt_logs`.

**Logged Data Points:**
- **Prompt Text:** The full query sent by the candidate.
- **Provider/Tool:** (e.g., "Cursor", "Claude").
- **Metadata:** Candidate ID, timestamp, and potentially the response metrics (tokens used, response time) if capture is supported.

---

## 4. Database Schema Reference

All results are stored in the `admin_audit` schema for security.

**Table:** `admin_audit.assessment_scores`
- `candidate_id`: UUID
- `session_id`: UUID
- `test_type`: 'quick' | 'full'
- `test_results`: JSONB (Complete Vitest output)
- `total_score`: Integer
- `max_score`: Integer
- `created_at`: Timestamp

**Table:** `admin_audit.session_commits` (via RPC)
- `session_id`: UUID
- `commit_hash`: Text
- `diff_content`: Text (Base64)
- `stats`: JSONB (lines added/removed)
