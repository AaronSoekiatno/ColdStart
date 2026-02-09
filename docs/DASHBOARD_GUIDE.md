# Assessment Dashboard Guide

## Overview

The Assessment Dashboard provides a comprehensive view of candidate performance across all assessment sessions. It allows you to query candidates by name, email, or ID and view detailed behavioral metrics.

## Access

Navigate to: `http://localhost:3000/dashboard` (or your deployed URL)

## Features

### 1. Candidate Search

Search for candidates using three methods:
- **By Name**: Partial match (e.g., "John" finds "John Doe")
- **By Email**: Exact match
- **By Candidate ID**: UUID lookup

If multiple candidates match a name search, you'll see a list to select from.

### 2. Candidate Information

Basic details including:
- Name and email
- Candidate ID (UUID)
- Registration date

### 3. Behavioral Metrics

The dashboard calculates and displays key metrics that align with the 3 assessment dimensions:

#### Overall Metrics
- **Total Sessions**: Number of assessment attempts
- **Avg Test Runs**: Average test iterations per session (target: 2-4)
- **Avg Score**: Average final score across sessions
- **Pass Rate**: Percentage of sessions with score ≥ 80

#### Dimension Scores

**AI Leverage Score (0-100)**
- Measures how effectively the candidate uses AI
- Based on test iteration patterns
- **90+**: Ideal (2-4 test runs) - catches AI mistakes quickly
- **30-70**: Struggling (too many iterations or suspiciously perfect)
- **Formula**:
  - 1 run = 30 (suspicious)
  - 2-4 runs = 90 (ideal)
  - 5+ runs = declining score (struggling)

**Validation Score (0-100)**
- Measures how well candidates validate their code
- Based on test frequency
- **90**: 3+ test runs (validates incrementally)
- **70**: 2 test runs (some validation)
- **50**: 1 test run (minimal validation)
- **30**: 0 test runs (no validation)

### 4. Sessions Table

Detailed view of each assessment session:
- Session ID (truncated UUID)
- Status (running, stopped, error, provisioning)
- Test run count
- Final score with color coding
- Duration in minutes
- Start timestamp

### 5. Score Progression

Visual timeline showing how scores improved across test runs within a session. Helps identify:
- Quick learners (rapid score improvement)
- Iterative debuggers (gradual improvement)
- Stuck candidates (no improvement)

### 6. Recent Commits

Last 10 code commits showing:
- Commit messages
- Timestamps

## API Endpoint

The dashboard uses `/api/dashboard/candidate` which accepts:

**Query Parameters:**
- `candidateId`: UUID of the candidate
- `name`: Partial name match
- `email`: Exact email match

**Response:**
```json
{
  "candidate": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "sessions": [...],
  "assessmentScores": [...],
  "commits": [...],
  "metrics": {
    "totalSessions": 5,
    "avgTestRuns": "3.2",
    "avgScore": "85.0",
    "avgTimeMinutes": "16.5",
    "passRate": "80.0",
    "aiLeverageScore": 90,
    "validationScore": 90,
    "scoreProgression": [...]
  }
}
```

## Interpreting Results

### Strong Candidate (Passes All 3 Dimensions)
- AI Leverage Score: 90+ (2-4 test runs)
- Validation Score: 90+ (tests incrementally)
- Avg Score: 80+
- Pass Rate: 80%+
- **Pattern**: Steady improvement across test runs, catches mistakes quickly

### Moderate Candidate
- AI Leverage Score: 50-70 (5-8 test runs)
- Validation Score: 70+ (validates but struggles)
- Avg Score: 60-79
- Pass Rate: 40-60%
- **Pattern**: Multiple iterations needed, eventual success

### Weak Candidate
- AI Leverage Score: 30 (1 run - suspicious) or < 50 (many runs - struggling)
- Validation Score: < 50 (minimal testing)
- Avg Score: < 60
- Pass Rate: < 40%
- **Pattern**: Either gives up or can't fix issues

### Red Flags
- **1 test run with 90+ score**: Possible cheating or prior knowledge
- **10+ test runs with low score**: Doesn't understand patterns
- **No score progression**: Not learning from failures

## Database Tables Used

The dashboard queries:
- `candidates`: Basic candidate info
- `interview_sessions`: Session metadata (test_run_count, scores, timing)
- `admin_audit.assessment_scores`: Detailed test results
- `session_commits`: Code commit history

## Color Coding

**Scores:**
- 🟢 Green: ≥ 80 (passing)
- 🟡 Yellow: 60-79 (moderate)
- 🔴 Red: < 60 (failing)

**Metrics:**
- 🟢 Green: Meeting targets
- 🟡 Yellow: Close to targets
- 🔴 Red: Below targets

## Running Validation Queries

For system-wide validation, use the validation script:

```bash
npx ts-node scripts/validate-assessment.ts
```

This runs aggregate queries across all candidates to validate assessment calibration:
- Score variance (differentiation)
- Test iteration patterns
- Time distribution
- Overall pass rates

## Development

To modify the dashboard:

**API Route:** `/app/api/dashboard/candidate/route.ts`
- Add new metrics
- Query additional tables
- Adjust scoring formulas

**UI:** `/app/dashboard/page.tsx`
- Add new visualizations
- Modify layout
- Add filtering/sorting

## Next Steps

Consider adding:
- [ ] Export to CSV functionality
- [ ] Date range filtering
- [ ] Comparison between candidates
- [ ] Detailed code diff viewer
- [ ] Real-time session monitoring
- [ ] Prompt quality analysis (if prompt_logs table exists)
