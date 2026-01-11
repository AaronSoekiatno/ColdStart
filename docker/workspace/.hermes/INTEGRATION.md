# Hermes Interview Integration Guide

This document explains how the Hermes interview integration works in this assessment repository.

## Overview

When tests pass in GitHub Actions, the system automatically notifies the Hermes orchestrator, which can trigger phase transitions and Vapi calls for the interview process.

## Components

### 1. Configuration File

**File:** `.hermes/config.json` (not committed to git)

This file contains:
- `sessionId`: The unique interview session identifier
- `apiBaseUrl`: The base URL for the Hermes interview API

**Creation:** This file is automatically created when the interview repository is initialized by the orchestrator system. It should NOT be manually created by candidates.

**Template:** See `.hermes/config.json.example` for the expected format.

### 2. Workflows

#### `test.yaml` (Runs on every push)
- Runs the test suite using `yarn test`
- On success, directly calls the Hermes API to notify of test completion
- Creates a GitHub check suite that can trigger other workflows

#### `score_assessment.yaml` (Runs on specific triggers)
- Runs assessment scoring tests
- On success, notifies Hermes with detailed score information
- Includes scores (build, completion, enhanced) in the notification

#### `hermes-integration.yaml` (Event listener)
- Listens for `check_suite` completion events
- Listens for `workflow_run` completion events as a fallback
- Acts as a backup notification method in case direct workflow notifications fail

### 3. Test Script

**File:** `.hermes/test-notification.sh`

A manual testing script to verify the integration is working:
```bash
bash .hermes/test-notification.sh
```

## How It Works

### Flow 1: Direct Workflow Notification (Primary)

1. Developer pushes code
2. `test.yaml` workflow runs
3. Tests execute
4. If tests pass, workflow calls Hermes API directly
5. Hermes orchestrator receives notification and processes phase transition

### Flow 2: Check Suite Event (Backup)

1. Developer pushes code
2. Workflow runs and creates a check suite
3. GitHub fires `check_suite` completion event
4. `hermes-integration.yaml` workflow triggers
5. Workflow reads config and calls Hermes API
6. Hermes orchestrator receives notification

### Flow 3: Workflow Run Event (Fallback)

1. Workflow completes
2. GitHub fires `workflow_run` completion event
3. `hermes-integration.yaml` workflow triggers (if workflow name matches)
4. Same as Flow 2 from step 5

## Error Handling

All notification steps include graceful error handling:
- Missing config file: Skips notification (normal for non-interview repos)
- Invalid session ID: Skips notification with warning
- API call failure: Logs error but doesn't fail the workflow

This ensures the integration doesn't break normal development workflows.

## API Endpoint

The integration calls:
```
POST {apiBaseUrl}/test
Content-Type: application/json

{
  "sessionId": "session_...",
  "testData": {
    "status": "success",
    "conclusion": "success",
    "head_sha": "...",
    "workflow_run_id": "...",
    "details_url": "...",
    "repository": "owner/repo",
    ...
  }
}
```

## Repository Setup (For Orchestrator)

When creating an interview repository, the orchestrator should:

1. Create `.hermes/config.json` with the session ID:
```bash
octokit.repos.createOrUpdateFileContents({
  owner: repoOwner,
  repo: repoName,
  path: '.hermes/config.json',
  message: 'Add Hermes interview session config',
  content: Buffer.from(JSON.stringify({
    sessionId: sessionId,
    apiBaseUrl: process.env.HERMES_API_BASE_URL || 'https://your-domain.com/api/interview'
  }, null, 2)).toString('base64'),
  branch: 'main'
});
```

2. Ensure the repository has these workflow files:
   - `.github/workflows/test.yaml`
   - `.github/workflows/hermes-integration.yaml`
   - `.github/workflows/score_assessment.yaml` (if using assessment)

## Troubleshooting

### Tests pass but no notification

1. Check if `.hermes/config.json` exists
2. Verify session ID is valid (not the example placeholder)
3. Check workflow logs for notification step output
4. Verify API base URL is correct and accessible
5. Test manually with `bash .hermes/test-notification.sh`

### Notification fails silently

- Check workflow logs for the "Notify Hermes Interview System" step
- Look for HTTP status codes and error messages
- Verify network access from GitHub Actions to your API endpoint

### Config file not found

- This is normal for non-interview repositories
- The workflows gracefully skip notification if config is missing
- Only interview repositories created by the orchestrator should have this file

## Security Notes

- The actual `config.json` with real session IDs is in `.gitignore`
- Only the example template is committed to the repository
- API base URL should be configurable per environment
- Session IDs should be unique per interview session
