#!/bin/bash
set -e

CONFIG_FILE=".hermes/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Error: $CONFIG_FILE not found"
  echo ""
  echo "This script requires a valid .hermes/config.json file."
  echo "If this is an interview repository, the config file should have been created"
  echo "when the repository was initialized."
  echo ""
  echo "To test manually, create .hermes/config.json with:"
  echo '{'
  echo '  "sessionId": "your-session-id-here",'
  echo '  "apiBaseUrl": "https://your-domain.com/api/interview"'
  echo '}'
  exit 1
fi

SESSION_ID=$(jq -r .sessionId "$CONFIG_FILE")
API_BASE_URL=$(jq -r .apiBaseUrl "$CONFIG_FILE")

if [ "$SESSION_ID" == "null" ] || [ -z "$SESSION_ID" ] || [ "$SESSION_ID" == "session_EXAMPLE_REPLACE_WITH_ACTUAL_SESSION_ID" ]; then
  echo "❌ Error: Invalid or missing sessionId in $CONFIG_FILE"
  echo "Found: '$SESSION_ID'"
  exit 1
fi

if [ "$API_BASE_URL" == "null" ] || [ -z "$API_BASE_URL" ]; then
  echo "❌ Error: Invalid or missing apiBaseUrl in $CONFIG_FILE"
  exit 1
fi

echo "🧪 Testing Hermes integration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Session ID: $SESSION_ID"
echo "API Base URL: $API_BASE_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Generate a test commit SHA
TEST_SHA="test-$(date +%s)"

echo "📤 Sending test notification..."
echo ""

# Test the endpoint
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/test" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"testData\": {
      \"status\": \"success\",
      \"conclusion\": \"success\",
      \"head_sha\": \"$TEST_SHA\",
      \"check_run_id\": \"test-run-$(date +%s)\",
      \"workflow_run_id\": \"test-workflow-$(date +%s)\",
      \"details_url\": \"https://github.com/test/test/actions/runs/test\",
      \"repository\": \"test/test\",
      \"event_type\": \"manual_test\"
    }
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "HTTP Status: $HTTP_CODE"
echo "Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "✅ Notification sent successfully!"
  echo ""
  echo "The Hermes orchestrator should have received the notification and"
  echo "processed it according to the current interview phase."
  exit 0
else
  echo "❌ Notification failed with HTTP $HTTP_CODE"
  echo ""
  echo "Please check:"
  echo "  1. The API base URL is correct"
  echo "  2. The endpoint is accessible"
  echo "  3. The session ID is valid"
  exit 1
fi
