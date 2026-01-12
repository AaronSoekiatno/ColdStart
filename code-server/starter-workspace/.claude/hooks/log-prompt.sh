#!/bin/bash
# Hook: UserPromptSubmit - fires on every prompt in interactive mode
# Receives JSON via stdin with prompt data

# Read JSON input from Claude Code
INPUT=$(cat)

# Extract prompt from JSON (Claude sends {"prompt": "...", "session_id": "..."})
PROMPT=$(echo "$INPUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("prompt",""))' 2>/dev/null)

# Skip if no prompt
[ -z "$PROMPT" ] && exit 0

# Log to Supabase
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_KEY" ] && [ -n "$CANDIDATE_ID" ]; then
    ESCAPED=$(echo "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
    PREVIEW=$(echo "$PROMPT" | head -c 500 | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

    curl -s -X POST "${SUPABASE_URL}/rest/v1/prompt_logs" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Accept-Profile: admin_audit" \
        -H "Content-Profile: admin_audit" \
        -d "{
            \"candidate_id\": \"${CANDIDATE_ID}\",
            \"provider\": \"claude-cli\",
            \"tool_name\": \"Claude Code\",
            \"prompt_text\": ${ESCAPED},
            \"prompt_text_preview\": ${PREVIEW}
        }" > /dev/null 2>&1
fi

# Return success (allow prompt to proceed)
echo '{"continue": true}'
