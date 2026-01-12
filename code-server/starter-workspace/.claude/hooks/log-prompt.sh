#!/bin/bash

# Claude Code CLI Hook: Log prompts to Supabase
# Triggered by UserPromptSubmit event
# Receives JSON: {session_id, cwd, permission_mode, prompt, ...}

debug_log() {
    echo "[PromptLog] $1" >&2
}

# Check required env vars
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    debug_log "ERROR: Supabase credentials missing"
    exit 0
fi

# Read JSON input from stdin
INPUT_JSON=""
if [ ! -t 0 ]; then
    INPUT_JSON=$(cat)
fi

if [ -z "$INPUT_JSON" ]; then
    debug_log "No input received"
    exit 0
fi

debug_log "Received: $INPUT_JSON"

# Parse all fields from the hook input
PARSED=$(echo "$INPUT_JSON" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    result = {
        "prompt": data.get("prompt", ""),
        "session_id": data.get("session_id", ""),
        "cwd": data.get("cwd", ""),
        "permission_mode": data.get("permission_mode", "")
    }
    print(json.dumps(result))
except Exception as e:
    print("{}")
' 2>/dev/null)

# Extract individual fields
PROMPT_TEXT=$(echo "$PARSED" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("prompt", ""))' 2>/dev/null)
SESSION_ID=$(echo "$PARSED" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id", ""))' 2>/dev/null)
CWD=$(echo "$PARSED" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd", ""))' 2>/dev/null)
PERMISSION_MODE=$(echo "$PARSED" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("permission_mode", ""))' 2>/dev/null)

if [ -z "$PROMPT_TEXT" ]; then
    debug_log "No prompt text found"
    exit 0
fi

# Escape strings for JSON
ESCAPED_PROMPT=$(printf '%s' "$PROMPT_TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
PREVIEW=$(printf '%s' "$PROMPT_TEXT" | head -c 500 | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
ESCAPED_CWD=$(printf '%s' "$CWD" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

debug_log "Sending to Supabase..."

RESPONSE=$(curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/prompt_logs" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{
        \"candidate_id\": \"${CANDIDATE_ID}\",
        \"provider\": \"claude-cli\",
        \"tool_name\": \"Claude Code CLI\",
        \"session_id\": \"${SESSION_ID}\",
        \"cwd\": ${ESCAPED_CWD},
        \"permission_mode\": \"${PERMISSION_MODE}\",
        \"prompt_text\": ${ESCAPED_PROMPT},
        \"prompt_text_preview\": ${PREVIEW}
    }" 2>&1)

debug_log "Response: $RESPONSE"
