#!/bin/bash
# Cursor hook: Runs before submitting a prompt to AI
# Logs the prompt to Supabase prompt_logs table
# Cursor passes JSON via stdin with prompt data

# #region agent log - script start
echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"A\",\"location\":\"beforeSubmitPrompt.sh:5\",\"message\":\"Bash hook script started\",\"data\":{\"timestamp\":$(date +%s)},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
# #endregion

# Read JSON from stdin (Cursor passes hook data this way)
# #region agent log - stdin reading
echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"A\",\"location\":\"beforeSubmitPrompt.sh:10\",\"message\":\"Attempting stdin read with cat\",\"data\":{},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
# #endregion
INPUT_JSON=$(cat)
# #region agent log - stdin read result
echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"A\",\"location\":\"beforeSubmitPrompt.sh:12\",\"message\":\"Stdin read completed\",\"data\":{\"inputLength\":${#INPUT_JSON}},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
# #endregion
PROMPT_TEXT=""

# Extract prompt text from Cursor's JSON format
# Cursor may pass: { "userMessage": "...", "agentMessage": "...", etc. }
if [ -n "$INPUT_JSON" ]; then
  # #region agent log - JSON parsing attempt
  echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"B\",\"location\":\"beforeSubmitPrompt.sh:15\",\"message\":\"Attempting JSON parsing\",\"data\":{\"inputLength\":${#INPUT_JSON}},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
  # #endregion
  # Try to extract userMessage, prompt, message, or content fields
  PROMPT_TEXT=$(echo "$INPUT_JSON" | grep -o '"userMessage":"[^"]*' | cut -d'"' -f4)
  if [ -z "$PROMPT_TEXT" ]; then
    PROMPT_TEXT=$(echo "$INPUT_JSON" | grep -o '"prompt":"[^"]*' | cut -d'"' -f4)
  fi
  if [ -z "$PROMPT_TEXT" ]; then
    PROMPT_TEXT=$(echo "$INPUT_JSON" | grep -o '"message":"[^"]*' | cut -d'"' -f4)
  fi
  if [ -z "$PROMPT_TEXT" ]; then
    PROMPT_TEXT=$(echo "$INPUT_JSON" | grep -o '"content":"[^"]*' | cut -d'"' -f4)
  fi
  # #region agent log - prompt extraction result
  echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"B\",\"location\":\"beforeSubmitPrompt.sh:27\",\"message\":\"Prompt extraction result\",\"data\":{\"promptLength\":${#PROMPT_TEXT}},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
  # #endregion
fi

# If no prompt found, try command line argument
if [ -z "$PROMPT_TEXT" ] && [ -n "$1" ]; then
  PROMPT_TEXT="$1"
fi

# If still no prompt, log what we received for debugging
if [ -z "$PROMPT_TEXT" ]; then
  LOG_FILE=".cursor/logs/prompts-$(date +%Y%m%d).log"
  echo "[$(date -Iseconds)] DEBUG: No prompt text found. Input: $INPUT_JSON" >> "$LOG_FILE"
  # Return continue to Cursor
  echo '{"continue":true}'
  exit 0
fi

# Read configuration from hooks.json
HOOKS_JSON=".cursor/hooks.json"
# #region agent log - config file check
if [ -f "$HOOKS_JSON" ]; then
  echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"E\",\"location\":\"beforeSubmitPrompt.sh:42\",\"message\":\"hooks.json exists\",\"data\":{},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
else
  echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"E\",\"location\":\"beforeSubmitPrompt.sh:42\",\"message\":\"hooks.json not found\",\"data\":{},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
  echo "Warning: hooks.json not found" >&2
  exit 0
fi
# #endregion

CANDIDATE_ID=$(grep -o '"candidateId": "[^"]*' "$HOOKS_JSON" | cut -d'"' -f4)
SUPABASE_URL=$(grep -o '"supabaseUrl": "[^"]*' "$HOOKS_JSON" | cut -d'"' -f4)
SUPABASE_KEY=$(grep -o '"supabaseServiceKey": "[^"]*' "$HOOKS_JSON" | cut -d'"' -f4)

# #region agent log - config values read
echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"E\",\"location\":\"beforeSubmitPrompt.sh:50\",\"message\":\"Configuration values read\",\"data\":{\"candidateIdPresent\":$(if [ -n \"$CANDIDATE_ID\" ]; then echo true; else echo false; fi),\"supabaseUrlPresent\":$(if [ -n \"$SUPABASE_URL\" ]; then echo true; else echo false; fi),\"supabaseKeyPresent\":$(if [ -n \"$SUPABASE_KEY\" ]; then echo true; else echo false; fi)},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
# #endregion

if [ -z "$CANDIDATE_ID" ] || [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  # #region agent log - config incomplete
  echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"E\",\"location\":\"beforeSubmitPrompt.sh:55\",\"message\":\"Configuration incomplete, exiting\",\"data\":{},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
  # #endregion
  echo "Warning: Missing configuration in hooks.json" >&2
  exit 0
fi

# Create logs directory
mkdir -p .cursor/logs

# Escape JSON special characters in prompt text
ESCAPED_PROMPT=$(echo "$PROMPT_TEXT" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed 's/$/\\n/' | tr -d '\n' | sed 's/\\n$//')

# Prepare JSON payload (simple approach without jq)
PAYLOAD=$(cat <<EOF
{
  "p_candidate_id": "${CANDIDATE_ID}",
  "p_prompt_text": "${ESCAPED_PROMPT}",
  "p_prompt_json": {"messages": [{"role": "user", "content": "${ESCAPED_PROMPT}"}]},
  "p_provider": "cursor-hooks",
  "p_tool_name": "Cursor",
  "p_user_agent": "Cursor/$(date +%s)",
  "p_model_requested": "unknown",
  "p_request_metadata": {}
}
EOF
)

# #region agent log - Supabase call attempt
echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"C\",\"location\":\"beforeSubmitPrompt.sh:78\",\"message\":\"Attempting Supabase call\",\"data\":{\"url\":\"${SUPABASE_URL}/rest/v1/rpc/log_prompt\",\"candidateId\":\"$CANDIDATE_ID\",\"promptLength\":${#PROMPT_TEXT}},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
# #endregion

# Call Supabase RPC function to log the prompt
RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/log_prompt" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -d "$PAYLOAD" 2>&1)

# #region agent log - Supabase call result
echo "{\"sessionId\":\"debug-session\",\"runId\":\"initial\",\"hypothesisId\":\"C\",\"location\":\"beforeSubmitPrompt.sh:87\",\"message\":\"Supabase call completed\",\"data\":{\"responseLength\":${#RESPONSE}},\"timestamp\":$(date +%s)}" >> /Users/aidannguyen/hermes-assessment-b206aa10/.cursor/debug.log
# #endregion

# Log to local file for debugging
LOG_FILE=".cursor/logs/prompts-$(date +%Y%m%d).log"
echo "[$(date -Iseconds)] Candidate: $CANDIDATE_ID | Prompt: ${PROMPT_TEXT:0:100}... | Response: $RESPONSE" >> "$LOG_FILE"

# Return continue to Cursor (required format)
echo '{"continue":true}'
exit 0

