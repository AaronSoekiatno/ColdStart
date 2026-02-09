# Claude Prompt Logging Implementation Plan

## Overview

Log all Claude CLI prompts from the code-server IDE to Supabase for tracking, auditing, and analytics.

## Recommended Schema: `admin_audit.prompt_logs`

This schema provides comprehensive logging including full prompt text, response data, tokens used, and metadata.

---

## Step 1: Create Supabase Migration

Create `supabase/migrations/add_prompt_logging.sql`:

```sql
-- Create admin_audit schema if not exists
CREATE SCHEMA IF NOT EXISTS admin_audit;

-- Prompt logs table
CREATE TABLE IF NOT EXISTS admin_audit.prompt_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id TEXT NOT NULL,           -- User identifier
    session_id UUID,                       -- IDE session ID
    provider TEXT DEFAULT 'claude-cli',    -- 'claude-cli', 'cursor', 'gemini', etc.
    tool_name TEXT DEFAULT 'Claude Code',  -- Tool identifier
    model_requested TEXT,                  -- e.g., 'claude-sonnet-4-20250514'
    prompt_text_preview TEXT,              -- First 500 chars for quick viewing
    prompt_text TEXT,                      -- Full prompt
    prompt_json JSONB,                     -- Full request as JSON (if applicable)
    request_metadata JSONB,                -- Additional context
    response_status INTEGER,               -- HTTP status or exit code
    response_time_ms INTEGER,              -- Latency
    tokens_used INTEGER,                   -- Token consumption
    response_json JSONB,                   -- Full response (optional)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_prompt_logs_candidate ON admin_audit.prompt_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_prompt_logs_created ON admin_audit.prompt_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_logs_session ON admin_audit.prompt_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_prompt_logs_provider ON admin_audit.prompt_logs(provider);

-- RPC function to log prompts
CREATE OR REPLACE FUNCTION admin_audit.log_prompt(
    p_candidate_id TEXT,
    p_session_id UUID DEFAULT NULL,
    p_prompt_text TEXT DEFAULT NULL,
    p_prompt_json JSONB DEFAULT NULL,
    p_provider TEXT DEFAULT 'claude-cli',
    p_tool_name TEXT DEFAULT 'Claude Code',
    p_model_requested TEXT DEFAULT NULL,
    p_request_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
    v_preview TEXT;
BEGIN
    -- Generate preview (first 500 chars)
    v_preview := LEFT(COALESCE(p_prompt_text, ''), 500);

    INSERT INTO admin_audit.prompt_logs (
        candidate_id,
        session_id,
        provider,
        tool_name,
        model_requested,
        prompt_text_preview,
        prompt_text,
        prompt_json,
        request_metadata
    ) VALUES (
        p_candidate_id,
        p_session_id,
        p_provider,
        p_tool_name,
        p_model_requested,
        v_preview,
        p_prompt_text,
        p_prompt_json,
        p_request_metadata
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- RPC function to update log with response data
CREATE OR REPLACE FUNCTION admin_audit.update_prompt_log_response(
    p_log_id UUID,
    p_response_status INTEGER DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL,
    p_response_json JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE admin_audit.prompt_logs
    SET
        response_status = COALESCE(p_response_status, response_status),
        response_time_ms = COALESCE(p_response_time_ms, response_time_ms),
        tokens_used = COALESCE(p_tokens_used, tokens_used),
        response_json = COALESCE(p_response_json, response_json)
    WHERE id = p_log_id;

    RETURN FOUND;
END;
$$;

-- Grant execute to service role
GRANT USAGE ON SCHEMA admin_audit TO service_role;
GRANT ALL ON admin_audit.prompt_logs TO service_role;
GRANT EXECUTE ON FUNCTION admin_audit.log_prompt TO service_role;
GRANT EXECUTE ON FUNCTION admin_audit.update_prompt_log_response TO service_role;
```

---

## Step 2: Update Docker Compose to Pass Credentials

Update `code-server/docker-compose.yml`:

```yaml
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  - SUPABASE_URL=${SUPABASE_URL}
  - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
  - USER_ID=${USER_ID}        # Passed per-session
  - SESSION_ID=${SESSION_ID}  # Passed per-session
```

For dynamic per-user sessions, these would be passed when starting the container via API.

---

## Step 3: Update Wrapper Script with Logging

Update `code-server/entrypoint.sh` to create a logging wrapper:

```bash
#!/bin/bash

# ... existing setup ...

# Create Claude wrapper script with logging
cat > /home/coder/.local/bin/claude-code << 'WRAPPER'
#!/bin/bash

# Configuration
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY:-}"
USER_ID="${USER_ID:-anonymous}"
SESSION_ID="${SESSION_ID:-}"

# Function to log prompt to Supabase
log_prompt() {
    local prompt="$1"

    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
        return 0  # Skip logging if not configured
    fi

    # Escape prompt for JSON
    local escaped_prompt=$(echo "$prompt" | jq -Rs .)

    # Call Supabase RPC
    local response=$(curl -s -X POST \
        "${SUPABASE_URL}/rest/v1/rpc/log_prompt" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"p_candidate_id\": \"${USER_ID}\",
            \"p_session_id\": ${SESSION_ID:-null},
            \"p_prompt_text\": ${escaped_prompt},
            \"p_provider\": \"claude-cli\",
            \"p_tool_name\": \"Claude Code\"
        }")

    # Extract log ID for later response update
    echo "$response" | tr -d '"'
}

# Function to update log with response
update_log_response() {
    local log_id="$1"
    local status="$2"
    local time_ms="$3"

    if [ -z "$SUPABASE_URL" ] || [ -z "$log_id" ]; then
        return 0
    fi

    curl -s -X POST \
        "${SUPABASE_URL}/rest/v1/rpc/update_prompt_log_response" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"p_log_id\": \"${log_id}\",
            \"p_response_status\": ${status},
            \"p_response_time_ms\": ${time_ms}
        }" > /dev/null
}

# Check API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY not configured"
    exit 1
fi

# Get the prompt
if [ $# -eq 0 ]; then
    echo "Claude Code (Headless Mode)"
    echo "============================"
    echo "Enter your prompt (Ctrl+D to submit, Ctrl+C to cancel):"
    echo ""
    PROMPT=$(cat)
else
    PROMPT="$*"
fi

if [ -z "$PROMPT" ]; then
    echo "No prompt provided"
    exit 1
fi

# Log the prompt (before execution)
START_TIME=$(date +%s%3N)
LOG_ID=$(log_prompt "$PROMPT")

# Execute Claude CLI
claude -p "$PROMPT" --allowedTools "Bash(*)" "Read(*)" "Write(*)" "Edit(*)"
EXIT_CODE=$?

# Calculate response time
END_TIME=$(date +%s%3N)
RESPONSE_TIME=$((END_TIME - START_TIME))

# Update log with response data
update_log_response "$LOG_ID" "$EXIT_CODE" "$RESPONSE_TIME"

exit $EXIT_CODE
WRAPPER

chmod +x /home/coder/.local/bin/claude-code
```

---

## Step 4: Dynamic Session Provisioning

When a user starts an IDE session via `/api/ide/start-session`, pass their credentials:

```typescript
// In the session provisioning logic
const containerEnv = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    USER_ID: user.id,
    SESSION_ID: sessionId,
};
```

For local development, add these to `code-server/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
USER_ID=local-dev-user
SESSION_ID=local-dev-session
```

---

## Step 5: Query Logged Prompts

### View all prompts for a user:
```sql
SELECT
    created_at,
    prompt_text_preview,
    tokens_used,
    response_time_ms
FROM admin_audit.prompt_logs
WHERE candidate_id = 'user-uuid'
ORDER BY created_at DESC;
```

### Analytics - prompts per day:
```sql
SELECT
    DATE(created_at) as date,
    COUNT(*) as prompt_count,
    SUM(tokens_used) as total_tokens
FROM admin_audit.prompt_logs
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### View full prompt/response:
```sql
SELECT prompt_text, response_json
FROM admin_audit.prompt_logs
WHERE id = 'log-uuid';
```

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        User in IDE                               │
│                              │                                   │
│                              ▼                                   │
│                   claude-code "prompt"                           │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Wrapper Script                                │
│  1. Capture prompt text                                          │
│  2. POST to Supabase RPC: log_prompt()  ─────────┐              │
│  3. Get log_id back                               │              │
│  4. Execute: claude -p "$PROMPT"                  │              │
│  5. Capture exit code & timing                    │              │
│  6. POST to Supabase RPC: update_prompt_log()    │              │
└───────────────────────────────────────────────────┼──────────────┘
                                                    │
                                                    ▼
                                    ┌──────────────────────────┐
                                    │  Supabase                │
                                    │  admin_audit.prompt_logs │
                                    │                          │
                                    │  - candidate_id          │
                                    │  - session_id            │
                                    │  - prompt_text           │
                                    │  - response_time_ms      │
                                    │  - tokens_used           │
                                    │  - created_at            │
                                    └──────────────────────────┘
```

---

## Security Considerations

1. **Service Key** - Use `SUPABASE_SERVICE_ROLE_KEY` for logging (bypasses RLS)
2. **Never expose** service key to client - only inject into server-side container
3. **Prompt data** - Contains potentially sensitive user code/questions
4. **Retention policy** - Consider adding TTL/cleanup for old logs

---

## Files to Modify

1. `supabase/migrations/add_prompt_logging.sql` - New migration
2. `code-server/.env` - Add Supabase credentials
3. `code-server/docker-compose.yml` - Pass environment variables
4. `code-server/entrypoint.sh` - Update wrapper script with logging
5. `app/api/ide/start-session/route.ts` - Pass user/session IDs to container

---

## Testing

1. Run migration: `supabase db push` or apply via dashboard
2. Rebuild container: `docker-compose build --no-cache`
3. Start container: `docker-compose up`
4. Open IDE and run: `claude-code "Hello, test prompt"`
5. Check Supabase: `SELECT * FROM admin_audit.prompt_logs ORDER BY created_at DESC LIMIT 1;`
