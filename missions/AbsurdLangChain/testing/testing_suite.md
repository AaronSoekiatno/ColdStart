# Hermes Assessment Test Suite

Automated testing and scoring for the Hermes candidate assessment platform using **Vitest**.

## Overview

| Category | Points | What It Tests |
|----------|--------|---------------|
| Build & Types | 15 | Does it compile? TypeScript errors? |
| Core Requirements | 35 | Locked removed, fetching, metrics, highlighting |
| Enhanced Features | 25 | Sorting, loading, error handling, Gemini integration |
| AI Usage | 20 | From reflection form (manual) |

**Total: 95 points** (75 automated + 20 manual)

## How It Works

All testing is automated through **Vitest** and GitHub Actions. When a candidate pushes their code, the `score_assessment.yaml` workflow:

1. Runs `yarn test:score` to execute all assessment tests
2. Parses JSON test results to calculate scores per category
3. Applies penalties (e.g., -10 for removing SQL index)
4. Submits results to Supabase
5. Creates a score artifact

## Running Tests Locally

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with JSON output (used by CI)
yarn test:score
```

## Test Files

### `tests/assessment/build.test.ts`
Build verification (15 points):
- Valid package.json with required scripts
- Required dependencies present
- Valid TypeScript configuration

### `tests/assessment/completion.test.ts`
Core requirements (35 points):
- Locked state (🔒) removed
- Data fetching from `/api/insights/performance`
- Metrics displayed (viral_score, views)
- High performers highlighted

### `tests/assessment/enhanced.test.ts`
Enhanced features (25 points):
- Sorting functionality
- Loading state management
- Error handling
- Gemini integration

### `tests/assessment/sabotage.test.ts`
Sabotage detection:
- SQL index exists in migrations
- **-10 point penalty** if missing

## Scoring

Tests are organized into categories:
- **Build & Types**: Compilation and TypeScript correctness
- **Core Requirements**: Basic functionality (data fetching, display, highlighting)
- **Enhanced Features**: Advanced implementation (sorting, loading states, error handling, AI integration)
- **AI Usage**: Manual evaluation from reflection form

Run `yarn test` to see which tests pass and understand what's expected.

## GitHub Actions Workflow

The `score_assessment.yaml` workflow runs tests and calculates scores:

```yaml
- name: Run Assessment Tests
  run: yarn test:score
  
- name: Calculate total score
  run: |
    BUILD_SCORE=${{ steps.tests.outputs.build_score }}
    COMPLETION_SCORE=${{ steps.tests.outputs.completion_score }}
    ENHANCED_SCORE=${{ steps.tests.outputs.enhanced_score }}
    TOTAL_SCORE=$((BUILD + COMPLETION + ENHANCED - PENALTY))
```

### Required Secrets
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key for admin access

## Score Interpretation

| Score | Interpretation |
|-------|----------------|
| 80-95 | Exceptional - Ready for founding engineer role |
| 65-79 | Strong - Worth intro to YC startups |
| 45-64 | Promising - Might need guidance |
| 25-44 | Developing - Not ready for 0→1 startup |
| < 25 | Not a fit - Needs more experience |

## Why Vitest Over Grep?

The previous grep-based scoring was:
- **Easily hackable**: Just add keywords without implementation
- **Not comprehensive**: Didn't test actual functionality
- **Brittle**: Depended on specific string patterns

Vitest-based scoring:
- ✅ Tests actual code behavior
- ✅ Harder to hack - must implement real features
- ✅ Better feedback - candidates see which tests fail
- ✅ Standard testing practices