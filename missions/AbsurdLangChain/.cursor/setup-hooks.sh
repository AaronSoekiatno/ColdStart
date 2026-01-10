#!/bin/bash
# Setup Cursor hooks with candidate ID

CANDIDATE_ID="$1"

if [ -z "$CANDIDATE_ID" ]; then
  echo "Error: Candidate ID required"
  echo "Usage: $0 <candidate-id>"
  exit 1
fi

# Read Supabase credentials from .env.local if it exists
if [ -f ".env.local" ]; then
  export $(grep -v '^#' .env.local | grep -E '^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_PRIVATE_KEY)=' | xargs)
fi

# Use SUPABASE_PRIVATE_KEY if SUPABASE_SERVICE_ROLE_KEY is not set
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_PRIVATE_KEY:-}}"

# Create hooks.json with candidate ID (Cursor format)
cat > .cursor/hooks.json <<EOF
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [
      {
        "command": ".cursor/hooks/beforeSubmitPrompt.sh"
      }
    ],
    "stop": [
      {
        "command": ".cursor/hooks/stop.sh"
      }
    ]
  },
  "candidateId": "$CANDIDATE_ID",
  "supabaseUrl": "${SUPABASE_URL:-}",
  "supabaseServiceKey": "${SUPABASE_KEY}"
}
EOF

echo "✅ Cursor hooks configured for candidate: $CANDIDATE_ID"
echo "   hooks.json created at .cursor/hooks.json"

