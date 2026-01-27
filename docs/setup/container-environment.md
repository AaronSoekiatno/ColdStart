# Container Environment Configuration

This document describes the environment variables required for the Hermes assessment container and how they are provisioned.

## Overview

Each assessment container requires a complete set of credentials and configuration to function properly. These are automatically injected during container provisioning and written to `/workspace/.env.local` by the entrypoint script.

## Required Environment Variables

### Core Identification
- **CANDIDATE_ID**: Unique identifier for the candidate (primary)
- **CANDIDATE_UUID**: Alias for CANDIDATE_ID (for compatibility)
- **SESSION_ID**: Interview session identifier for telemetry tracking

### Supabase Database Credentials
- **SUPABASE_URL**: Supabase project URL
- **SUPABASE_ANON_KEY**: Public anonymous key
- **SUPABASE_PRIVATE_KEY**: Schema-specific JWT token (24-hour expiration)
- **SUPABASE_SERVICE_ROLE_KEY**: Alias for SUPABASE_PRIVATE_KEY (for compatibility)

### API Proxy Configuration
- **GEMINI_BASE_URL**: Proxy URL for Gemini API requests (e.g., `https://app.com/api/proxy/gemini`)
- **GOOGLE_BASE_URL**: Alias for GEMINI_BASE_URL (for compatibility)
- **GOOGLE_API_KEY**: Set to `managed-by-proxy` to indicate proxy-managed keys
- **QUARTERMASTER_API_URL**: URL for credential provisioning endpoint

### Operational Configuration
- **TELEMETRY_URL**: Base URL for telemetry reporting (usually the main app URL)
- **AUTO_COMMIT_INTERVAL**: Seconds between auto-commits (default: 120)
- **PASSWORD**: Code-server password (empty string = auth disabled)

### Git Configuration (Optional)
- **GIT_USER_NAME**: Git commit author name (default: "Candidate")
- **GIT_USER_EMAIL**: Git commit author email (default: "candidate@assessment.local")

## Provisioning Flow

### 1. API Endpoint (`/api/topcandidates/provision-container`)
When a candidate starts an assessment:
1. Authenticates the candidate
2. Calls `/api/topcandidates/provision` to create schema and get credentials
3. Provisions Fly.io machine with all required environment variables
4. Updates `interview_sessions` table with container URL and status

### 2. Container Startup (`entrypoint.sh`)
When the container starts:
1. Configures Git with user name/email
2. Initializes workspace Git repository
3. **Generates `.env.local`** from environment variables (lines 57-91)
4. Starts telemetry sidecar (if TELEMETRY_URL and SESSION_ID are set)
5. Configures Claude Code settings with runtime environment
6. Starts auto-commit daemon
7. Launches code-server on port 8080

### 3. Workspace Application
The Next.js application in `/workspace` reads `.env.local` to:
- Connect to candidate-specific Supabase schema
- Make API calls through the Gemini proxy
- Track usage by candidate ID

## Deployment Methods

### Production (Fly.io)
Environment variables are passed via `flyctl machine run --env` commands.
See: `lib/container-orchestration/flyio.ts`

### Local Development (Docker Script)
Environment variables are passed via `docker run -e` flags.
See: `docker/start-assessment.sh`

Usage:
```bash
export CANDIDATE_ID="test-candidate-123"
export SESSION_ID="test-session-456"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_PRIVATE_KEY="your-jwt-token"
./docker/start-assessment.sh
```

### Local Development (Docker Compose)
Environment variables are read from shell environment or `.env` file.
See: `docker/docker-compose.assessment.yml`

Usage:
```bash
# Create .env file with required variables
cat > .env << EOF
CANDIDATE_ID=test-candidate-123
SESSION_ID=test-session-456
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PRIVATE_KEY=your-jwt-token
TELEMETRY_URL=http://host.docker.internal:3000
EOF

docker-compose -f docker/docker-compose.assessment.yml up --build
```

## Environment Variable Injection

The `entrypoint.sh` script (lines 64-76) defines which variables are injected into `.env.local`:

```bash
KEYS=(
    "CANDIDATE_ID"
    "CANDIDATE_UUID"
    "SESSION_ID"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "SUPABASE_PRIVATE_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "GEMINI_BASE_URL"
    "GOOGLE_BASE_URL"
    "GOOGLE_API_KEY"
    "QUARTERMASTER_API_URL"
)
```

Only variables that are **present in the container environment** will be written to `.env.local`.

## Troubleshooting

### Missing Credentials in Container
If the workspace application can't connect to Supabase or APIs:

1. Check container logs:
   ```bash
   docker logs hermes-assessment-<candidate-id>
   ```

2. Look for the credential injection message:
   ```
   🔑 Provisioning credentials to .env.local...
      ✓ Injected N credentials into .env.local
   ```

3. Verify environment variables were passed:
   ```bash
   docker exec hermes-assessment-<candidate-id> env | grep SUPABASE
   ```

4. Check `.env.local` contents:
   ```bash
   docker exec hermes-assessment-<candidate-id> cat /workspace/.env.local
   ```

### Local Development Issues
If running locally with `start-assessment.sh`:
- Ensure all required environment variables are exported in your shell
- Use `export VARIABLE=value` before running the script
- Check that `TELEMETRY_URL` points to your local dev server (e.g., `http://host.docker.internal:3000`)

### Fly.io Deployment Issues
If containers fail to start on Fly.io:
- Verify `FLY_API_TOKEN` is set in production environment
- Check Fly.io machine logs: `flyctl logs -a <app-name>`
- Ensure the provision endpoint returned valid credentials
- Verify the Docker image is accessible: `ghcr.io/hermes-startup/hermes-assessment:latest`

## Security Notes

1. **JWT Expiration**: Schema-specific JWTs expire after 24 hours
2. **Credential Scope**: Supabase credentials are scoped to candidate-specific schema only
3. **API Key Management**: Google API keys are managed server-side via proxy
4. **Container Isolation**: Each candidate gets an isolated container and database schema
5. **Password Authentication**: Code-server password auth is disabled (`--auth none`)

## Related Files

- `/docker/scripts/entrypoint.sh` - Container startup and environment injection
- `/lib/container-orchestration/flyio.ts` - Fly.io provisioning logic
- `/app/api/topcandidates/provision-container/route.ts` - Container provisioning API
- `/app/api/topcandidates/provision/route.ts` - Credential provisioning API
- `/docker/start-assessment.sh` - Local development script
- `/docker/docker-compose.assessment.yml` - Docker Compose configuration
