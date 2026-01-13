#!/bin/bash

# =============================================================================
# Claude CLI Configuration for Coldstart IDE
# =============================================================================
# This script configures Claude CLI to use the platform-provided ANTHROPIC_API_KEY
# so users don't need to authenticate with their own Anthropic account.
# It also logs all prompts to Supabase for tracking and analytics.
# =============================================================================

# Clear any cached OAuth credentials to prevent auth conflicts
rm -rf /home/coder/.claude 2>/dev/null || true

# Ensure .local/bin exists and is in PATH
mkdir -p /home/coder/.local/bin

# Create API key helper script for Claude Code
cat > /home/coder/.local/bin/get-claude-key << 'HELPER'
#!/bin/bash
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "$ANTHROPIC_API_KEY"
else
    exit 1
fi
HELPER
chmod +x /home/coder/.local/bin/get-claude-key

# Configure Claude Code global settings to use the helper
# This ensures both the CLI and Extension use the ENV var without asking for login
mkdir -p /home/coder/.claude
cat > /home/coder/.claude/config.json << 'CONFIG'
{
    "apiKeyHelper": "/home/coder/.local/bin/get-claude-key"
}
CONFIG

# Also write to settings.json in case it checks there
if [ -f "/home/coder/.claude/settings.json" ]; then
    # Merge using python if exists, else just overwrite/create (simple backup for now)
    # Since we copy from workspace later, we'll just append or rely on config.json
    # But let's verify if we need to set it in settings.json too.
    # We will trust config.json is the primary for the CLI.
    true
else
    cp /home/coder/.claude/config.json /home/coder/.claude/settings.json 2>/dev/null || true
fi

# Create Claude wrapper script that uses headless mode (no login required)
# This allows users to use Claude without authentication
cat > /home/coder/.local/bin/claude-code << 'WRAPPER'
#!/bin/bash
# Claude Code wrapper - uses headless mode with platform API key
# Logs prompts to Supabase admin_audit.prompt_logs
# Usage: claude-code "your prompt here"
#        claude-code (interactive prompt)

# =============================================================================
# Logging function - logs prompt to Supabase
# =============================================================================
log_prompt() {
    local prompt="$1"
    local start_time="$2"

    # Skip logging if Supabase not configured
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ] || [ -z "$CANDIDATE_ID" ]; then
        return 0
    fi

    # Escape prompt for JSON (handle quotes, newlines, etc.)
    local escaped_prompt=$(printf '%s' "$prompt" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

    # Create preview (first 500 chars)
    local preview=$(printf '%s' "$prompt" | head -c 500 | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

    # Log to Supabase via direct insert (using service key)
    local response=$(curl -s -X POST \
        "${SUPABASE_URL}/rest/v1/prompt_logs" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "{
            \"candidate_id\": \"${CANDIDATE_ID}\",
            \"provider\": \"claude-cli\",
            \"tool_name\": \"Claude Code\",
            \"prompt_text\": ${escaped_prompt},
            \"prompt_text_preview\": ${preview},
            \"request_metadata\": {\"workspace\": \"$(pwd)\", \"timestamp\": \"$(date -Iseconds)\"}
        }" 2>/dev/null)

    # Extract and return the log ID
    echo "$response" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data[0]["id"] if isinstance(data, list) and len(data) > 0 else "")' 2>/dev/null
}

# =============================================================================
# Update log with response data
# =============================================================================
update_log_response() {
    local log_id="$1"
    local exit_code="$2"
    local response_time_ms="$3"

    # Skip if no log ID or Supabase not configured
    if [ -z "$log_id" ] || [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
        return 0
    fi

    curl -s -X PATCH \
        "${SUPABASE_URL}/rest/v1/prompt_logs?id=eq.${log_id}" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{
            \"response_status\": ${exit_code},
            \"response_time_ms\": ${response_time_ms}
        }" > /dev/null 2>&1
}

# =============================================================================
# Main script
# =============================================================================

# Check API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY not configured"
    exit 1
fi

# Get the prompt
if [ $# -eq 0 ]; then
    # No arguments - prompt for input
    echo "Claude Code (Headless Mode)"
    echo "============================"
    echo "Enter your prompt (Ctrl+D to submit, Ctrl+C to cancel):"
    echo ""
    PROMPT=$(cat)
else
    # Arguments provided - use them as the prompt
    PROMPT="$*"
fi

# Exit if no prompt
if [ -z "$PROMPT" ]; then
    echo "No prompt provided"
    exit 1
fi

# Enforce token limit (approx 4 chars per token)
# Default: 5000 tokens (~20k chars)
MAX_TOKENS=${CLAUDE_PROMPT_TOKEN_LIMIT:-5000}
EST_TOKENS=$((${#PROMPT} / 4))

if [ $EST_TOKENS -gt $MAX_TOKENS ]; then
    echo "Error: Prompt exceeds token limit."
    echo "Limit: $MAX_TOKENS tokens (approx)"
    echo "Your prompt: ~$EST_TOKENS tokens"
    exit 1
fi

# Record start time (milliseconds)
START_TIME=$(date +%s%3N)

# Log the prompt to Supabase (before execution)
LOG_ID=$(log_prompt "$PROMPT" "$START_TIME")

# Execute Claude CLI (use claude-real if binary was replaced, otherwise claude)
CLAUDE_BIN="${HOME}/.npm-global/bin/claude-real"
if [ ! -f "$CLAUDE_BIN" ]; then
    CLAUDE_BIN=$(which claude-real 2>/dev/null || which claude)
fi

$CLAUDE_BIN -p "$PROMPT" --allowedTools "Bash(*)" "Read(*)" "Write(*)" "Edit(*)"
EXIT_CODE=$?

# Calculate response time in milliseconds
END_TIME=$(date +%s%3N)
RESPONSE_TIME_MS=$((END_TIME - START_TIME))

# Update log with response data
update_log_response "$LOG_ID" "$EXIT_CODE" "$RESPONSE_TIME_MS"

exit $EXIT_CODE
WRAPPER

chmod +x /home/coder/.local/bin/claude-code

# =============================================================================
# Set up Claude Code hooks for interactive mode prompt logging
# =============================================================================

# Make hook script executable
chmod +x /workspace/.claude/hooks/log-prompt.sh 2>/dev/null || true

# Copy Claude settings to user's home directory (Claude Code looks here too)
# Source from /opt/starter to ensure we get the latest config from the image
# (avoiding stale config if /workspace volume is old)
mkdir -p /home/coder/.claude
cp /opt/starter/.claude/settings.json /home/coder/.claude/settings.json 2>/dev/null || true

# Force-append apiKeyHelper and env block to settings.json to guarantee auth config works
# (jq is not installed by default in minimal images, so we use python)
python3 -c '
import json, os
try:
    path = "/home/coder/.claude/settings.json"
    if os.path.exists(path):
        with open(path, "r") as f:
            data = json.load(f)
    else:
        data = {}
    
    # Force the helper path
    data["apiKeyHelper"] = "/home/coder/.local/bin/get-claude-key"
    
    # Add env block with the API key from environment
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if api_key:
        if "env" not in data:
            data["env"] = {}
        data["env"]["ANTHROPIC_API_KEY"] = api_key
    
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print("Updated settings.json with apiKeyHelper and env")
except Exception as e:
    print(f"Error updating settings: {e}")
'

# Ensure hooks are executable
mkdir -p /home/coder/.claude/hooks
if [ -f "/opt/starter/.claude/hooks/log-prompt.sh" ]; then
    cp /opt/starter/.claude/hooks/log-prompt.sh /home/coder/.claude/hooks/log-prompt.sh
    chmod +x /home/coder/.claude/hooks/log-prompt.sh
fi

# =============================================================================
# Fix for Claude Code Extension ENOENT error
# The extension expects specific project directories to exist based on workspace path
# It seems to map /workspace to "-workspace" or similar hash
# =============================================================================
mkdir -p /home/coder/.claude/projects/-workspace
mkdir -p /home/coder/.claude/projects/workspace
# Create a default project folder for the workspace (using the default name hash often used)
# We map the current workspace to a specific project folder if needed, but creating the base is critical.
chown -R coder:coder /home/coder/.claude

# =============================================================================
# Binary replacement - ensures ALL claude invocations go through our wrapper
# Even if users find the original binary path, they still hit our logging
# =============================================================================

ORIGINAL_CLAUDE=$(which claude 2>/dev/null || echo "/home/coder/.npm-global/bin/claude")
if [ -f "$ORIGINAL_CLAUDE" ] && [ ! -f "${ORIGINAL_CLAUDE}-real" ]; then
    # Backup original binary
    mv "$ORIGINAL_CLAUDE" "${ORIGINAL_CLAUDE}-real"

    # Create wrapper that redirects to our logging wrapper
    cat > "$ORIGINAL_CLAUDE" << 'BINARY_WRAPPER'
#!/bin/bash
# This wrapper ensures ALL claude invocations are logged
# The real binary is at claude-real

SCRIPT_DIR="$(dirname "$0")"

# If called with -p flag (single prompt mode), use our logging wrapper
if [[ "$*" == *"-p"* ]] || [ $# -gt 0 ]; then
    if [ -f "/home/coder/.local/bin/claude-code" ]; then
        exec /home/coder/.local/bin/claude-code "$@"
    fi
fi

# For interactive mode, call the real binary (hooks will capture prompts)
exec "${SCRIPT_DIR}/claude-real" "$@"
BINARY_WRAPPER

    chmod +x "$ORIGINAL_CLAUDE"
fi

# Create a simple alias helper in bashrc
cat >> /home/coder/.bashrc << 'BASHRC'

# Add .local/bin to PATH
export PATH="$HOME/.local/bin:$PATH"

# Claude Code aliases - all commands route through our logging wrapper
alias claude='claude-code'
alias ask='claude-code'
alias claude-ask='claude-code'

# Welcome message for Claude
echo ""
echo "Claude Code is ready! Use these commands:"
echo "  claude \"your prompt\"  - Ask Claude anything"
echo "  ask \"your prompt\"     - Shorthand alias"
echo ""
BASHRC

# Start code-server
exec code-server --bind-addr 0.0.0.0:8080 --auth none /workspace
