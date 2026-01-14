#!/bin/bash
# ============================================
# Hermes Assessment Environment Entrypoint
# ============================================
# CRITICAL: Start code-server FIRST for fast port binding
# Then run setup tasks in background
# ============================================

echo "🚀 Starting Hermes Assessment Environment..."
echo "============================================"

# Ensure Supabase Service Key is available
export SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY:-$SUPABASE_SERVICE_ROLE_KEY}

# ============================================
# BACKGROUND SETUP FUNCTION
# Runs AFTER code-server starts
# ============================================
run_background_setup() {
    echo "⏳ Running background setup..."

    # 1. Claude Authentication & Configuration
    echo "🔐 Configuring Claude Authentication..."
    rm -rf /home/coder/.claude 2>/dev/null || true
    mkdir -p /home/coder/.claude
    mkdir -p /home/coder/.local/bin

    # Create API key helper script
    cat > /home/coder/.local/bin/get-claude-key << 'HELPER'
#!/bin/bash
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "$ANTHROPIC_API_KEY"
else
    exit 1
fi
HELPER
    chmod +x /home/coder/.local/bin/get-claude-key

    # Configure Claude Code global settings
    cat > /home/coder/.claude/config.json << 'CONFIG'
{
    "apiKeyHelper": "/home/coder/.local/bin/get-claude-key"
}
CONFIG

    # Force-append apiKey helper to settings.json
    python3 -c '
import json, os
try:
    path = "/home/coder/.claude/settings.json"
    if os.path.exists(path):
        with open(path, "r") as f:
            data = json.load(f)
    else:
        data = {}
    data["apiKeyHelper"] = "/home/coder/.local/bin/get-claude-key"
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if api_key:
        if "env" not in data:
            data["env"] = {}
        data["env"]["ANTHROPIC_API_KEY"] = api_key
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
except Exception as e:
    print(f"Error updating settings: {e}")
'

    # 2. Claude Headless Wrapper
    echo "🛡️  Installing Claude Code Wrapper..."
    cat > /home/coder/.local/bin/claude-code << 'WRAPPER'
#!/bin/bash
# Claude Code wrapper - logs prompts to Supabase

log_prompt() {
    local prompt="$1"
    local start_time="$2"
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ] || [ -z "$CANDIDATE_ID" ]; then
        return 0
    fi
    local escaped_prompt=$(printf '%s' "$prompt" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
    local preview=$(printf '%s' "$prompt" | head -c 500 | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
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
    echo "$response" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data[0]["id"] if isinstance(data, list) and len(data) > 0 else "")' 2>/dev/null
}

update_log_response() {
    local log_id="$1"
    local exit_code="$2"
    local response_time_ms="$3"
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

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY not configured"
    exit 1
fi

if [ $# -eq 0 ]; then
    echo "Claude Code (Headless Mode)"
    echo "Enter your prompt (Ctrl+D to submit):"
    PROMPT=$(cat)
else
    PROMPT="$*"
fi

if [ -z "$PROMPT" ]; then
    echo "No prompt provided"
    exit 1
fi

MAX_TOKENS=${CLAUDE_PROMPT_TOKEN_LIMIT:-5000}
EST_TOKENS=$((${#PROMPT} / 4))

if [ $EST_TOKENS -gt $MAX_TOKENS ]; then
    echo "Error: Prompt exceeds token limit."
    echo "Limit: $MAX_TOKENS tokens (approx)"
    echo "Your prompt: ~$EST_TOKENS tokens"
    exit 1
fi

START_TIME=$(date +%s%3N)
LOG_ID=$(log_prompt "$PROMPT" "$START_TIME")

CLAUDE_BIN="${HOME}/.npm-global/bin/claude-real"
if [ ! -f "$CLAUDE_BIN" ]; then
    CLAUDE_BIN=$(which claude-real 2>/dev/null || which claude)
fi

$CLAUDE_BIN -p "$PROMPT" --allowedTools "Bash(*)" "Read(*)" "Write(*)" "Edit(*)"
EXIT_CODE=$?

END_TIME=$(date +%s%3N)
RESPONSE_TIME_MS=$((END_TIME - START_TIME))

update_log_response "$LOG_ID" "$EXIT_CODE" "$RESPONSE_TIME_MS"

exit $EXIT_CODE
WRAPPER
    chmod +x /home/coder/.local/bin/claude-code

    # 3. Bash aliases and Welcome Message
    cat >> /home/coder/.bashrc << 'BASHRC'
export PATH="$HOME/.local/bin:$PATH"
alias claude='claude-code'
alias ask='claude-code'

# Welcome Message
echo -e "\n\033[1;34m🚀 Welcome to Hermes Assessment Environment!\033[0m"
echo -e "\033[0;32m------------------------------------------\033[0m"
echo -e "To start your application, run: \033[1;33mnpm run dev\033[0m"
echo -e "To preview your app visually, click the \033[1;34m'Preview App'\033[0m button at the top of the IDE."
echo -e "Your app will be available on \033[1;36mport 3000\033[0m by default."
echo -e "\033[0;32m------------------------------------------\033[0m\n"
BASHRC

    # 4. Interactive Mode logging hooks
    mkdir -p /home/coder/.claude/hooks
    if [ -f "/usr/local/bin/log-prompt.sh" ]; then
        cp /usr/local/bin/log-prompt.sh /home/coder/.claude/hooks/log-prompt.sh
        chmod +x /home/coder/.claude/hooks/log-prompt.sh
    fi

    # 5. Git & Workspace Initialization
    echo "📝 Configuring Git..."
    git config --global user.name "${GIT_USER_NAME:-Candidate}"
    git config --global user.email "${GIT_USER_EMAIL:-candidate@assessment.local}"
    git config --global init.defaultBranch main

    if [ ! -d "/workspace/.git" ]; then
        echo "📁 Initializing workspace..."
        cd /workspace
        git init
        git config user.email "${GIT_USER_EMAIL:-candidate@hermes.com}"
        git config user.name "${GIT_USER_NAME:-Candidate}"
        git add -A 2>/dev/null || true
        git commit -m "Initial workspace setup" 2>/dev/null || true
    fi

    # 6. Generate .env.local
    echo "🔑 Provisioning credentials to .env.local..."
    ENV_FILE="/workspace/.env.local"
    echo "# Auto-generated by Hermes Assessment Environment" > "$ENV_FILE"
    KEYS=("CANDIDATE_ID" "SESSION_ID" "NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "GEMINI_BASE_URL" "GOOGLE_BASE_URL" "GOOGLE_API_KEY" "QUARTERMASTER_API_URL")

    for KEY in "${KEYS[@]}"; do
        if [ -n "${!KEY}" ]; then
            echo "$KEY=${!KEY}" >> "$ENV_FILE"
        fi
    done
    
    # Force development servers to bind to all interfaces for external access
    echo "HOST=0.0.0.0" >> "$ENV_FILE"
    echo "PORT=3000" >> "$ENV_FILE"

    # 7. Start Telemetry Sidecar
    if [ -n "$TELEMETRY_URL" ] && [ -n "$SESSION_ID" ]; then
        echo "📊 Starting telemetry sidecar..."
        /usr/local/bin/telemetry-sidecar.sh &
    fi

    # Final ownership check
    chown -R coder:coder /home/coder/.claude 2>/dev/null || true

    echo "✅ Background setup complete!"
}

# ============================================
# MAIN: Start code-server IMMEDIATELY
# ============================================
echo "🖥️  Starting code-server on 0.0.0.0:8080..."

# Run background setup after code-server starts (non-blocking)
run_background_setup &

# Start code-server (this blocks and keeps container running)
exec code-server --bind-addr 0.0.0.0:8080 --auth none /workspace
