# Docker Assessment Environment Setup

This guide explains how to set up and use the containerized code-server environment for Minerva assessments.

## Overview

The Docker-based assessment environment provides:

- **Pre-configured IDE**: code-server (VS Code in browser)
- **Claude Code Integration**: Pre-installed and configured to route through telemetry
- **Auto-Save**: Files save automatically every second
- **Auto-Commit**: Git commits every 2 minutes with telemetry integration
- **Pre-installed Dependencies**: React, Testing Library, Vitest ready to go

## Quick Start

### 1. Build the Image

```bash
cd docker
docker build -t hermes-assessment:latest -f Dockerfile.assessment .
```

### 2. Run with Docker Compose

```bash
# Set required environment variables
export CANDIDATE_ID="your-candidate-uuid"
export SESSION_ID="session_xxx"
export TELEMETRY_URL="https://your-hermes-instance.com"
export ASSESSMENT_PASSWORD="secure-password"

# Start the container
docker-compose -f docker-compose.assessment.yml up -d
```

### 3. Access the IDE

Open your browser to `http://localhost:8080` and enter the password.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CANDIDATE_ID` | Yes | - | Unique candidate identifier |
| `SESSION_ID` | Yes | - | Interview session ID for telemetry |
| `TELEMETRY_URL` | Yes | - | Hermes API base URL |
| `ASSESSMENT_PASSWORD` | Yes | `assessment123` | code-server access password |
| `AUTO_COMMIT_INTERVAL` | No | `120` | Seconds between auto-commits |
| `GIT_USER_NAME` | No | `Candidate` | Git commit author name |
| `GIT_USER_EMAIL` | No | `candidate@assessment.local` | Git commit author email |
| `PORT` | No | `8080` | Host port to expose |

## Features

### Auto-Save

Files are automatically saved every 1 second. This is configured in the VS Code settings.

### Auto-Commit

A background daemon commits all changes every 2 minutes (configurable via `AUTO_COMMIT_INTERVAL`). Each commit:

1. Stages all modified files
2. Creates a timestamped commit
3. Reports to the Hermes `/api/interview/commit` endpoint

### Telemetry

The telemetry sidecar reports:

- Container start/stop events
- Periodic heartbeats with resource usage
- Workspace statistics (file count, commit count)

### Claude Code Integration

Claude Code is pre-configured to route through the telemetry proxy at `${TELEMETRY_URL}/api/proxy/claude`. This enables:

- Prompt/response logging
- Token usage tracking
- Session-linked AI interactions

## Verification

### Test Container Startup Time

```bash
# Target: <30 seconds
time docker run -d --name timing-test \
    -e PASSWORD=test \
    hermes-assessment:latest

# Check it's running
docker exec timing-test curl -f http://localhost:8080/healthz

# Clean up
docker rm -f timing-test
```

### Test Auto-Commit

```bash
# Start with short interval for testing
docker run -d --name commit-test \
    -e AUTO_COMMIT_INTERVAL=10 \
    -e PASSWORD=test \
    hermes-assessment:latest

# Create a test file
docker exec commit-test bash -c "echo 'test' > /workspace/test.txt"

# Wait for auto-commit
sleep 15

# Check git log
docker exec commit-test bash -c "cd /workspace && git log --oneline"

# Clean up
docker rm -f commit-test
```

### Test Claude Code

```bash
docker exec -it hermes-assessment claude --version
docker exec -it hermes-assessment claude "What is 2+2?"
```

## Troubleshooting

### Container won't start

Check Docker logs:
```bash
docker logs hermes-assessment
```

### Auto-commit not working

Verify the workspace is a git repository:
```bash
docker exec hermes-assessment ls -la /workspace/.git
```

### Telemetry not sending

Check environment variables are set:
```bash
docker exec hermes-assessment env | grep -E "(TELEMETRY|SESSION)"
```

## File Structure

```
docker/
├── Dockerfile.assessment     # Main Dockerfile
├── docker-compose.assessment.yml  # Compose orchestration
├── scripts/
│   ├── entrypoint.sh        # Container startup
│   ├── auto-commit.sh       # Git auto-commit daemon
│   └── telemetry-sidecar.sh # Metrics collection
├── workspace/
│   └── package.json         # Pre-installed dependencies
├── config/
│   └── settings.json        # VS Code settings
└── .claude/
    └── settings.local.json  # Claude Code telemetry config
```

## Security Notes

1. **Password**: Always set a strong `ASSESSMENT_PASSWORD` in production
2. **Network**: Consider running behind a reverse proxy with TLS
3. **Isolation**: Each candidate should get their own container instance
4. **Telemetry**: Only assessment-relevant data is collected
