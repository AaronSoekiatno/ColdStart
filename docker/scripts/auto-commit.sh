#!/bin/bash
# ============================================
# Auto-Commit Daemon
# ============================================
# Automatically commits all changes every AUTO_COMMIT_INTERVAL seconds
# and reports commits to the Hermes telemetry endpoint.
#
# Integrates with: POST /api/interview/commit
# ============================================

INTERVAL=${AUTO_COMMIT_INTERVAL:-120}  # Default: 2 minutes (120 seconds)
WORKSPACE_DIR=${WORKSPACE_DIR:-/workspace}
COMMIT_COUNTER=0

echo "[Auto-Commit] Starting daemon with ${INTERVAL}s interval"
echo "[Auto-Commit] Workspace: ${WORKSPACE_DIR}"

# Function to send commit notification to Hermes API
send_commit_notification() {
    local commit_hash="$1"
    local commit_message="$2"
    local added_lines="$3"
    local deleted_lines="$4"
    local diff_content="$5"
    
    if [ -z "$TELEMETRY_URL" ] || [ -z "$SESSION_ID" ]; then
        echo "[Auto-Commit] Telemetry not configured, skipping notification"
        return 0
    fi
    
    # Call the existing /api/interview/commit endpoint
    local response=$(curl -s -w "\n%{http_code}" -X POST "${TELEMETRY_URL}/api/interview/commit" \
        -H "Content-Type: application/json" \
        -d "{
            \"sessionId\": \"${SESSION_ID}\",
            \"commitHash\": \"${commit_hash}\",
            \"commitMessage\": \"${commit_message}\",
            \"addedLines\": ${added_lines},
            \"deletedLines\": ${deleted_lines},
            \"diffContent\": $(echo "$diff_content" | jq -Rs .),
            \"source\": \"auto-commit\"
        }" 2>/dev/null)
    
    local http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "[Auto-Commit] ✓ Commit notification sent successfully"
    else
        echo "[Auto-Commit] ⚠ Failed to send notification (HTTP $http_code)"
    fi
}

# Main loop
while true; do
    sleep $INTERVAL
    
    cd "$WORKSPACE_DIR" || {
        echo "[Auto-Commit] ⚠ Could not access workspace directory"
        continue
    }
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        echo "[Auto-Commit] ⚠ Not a git repository, initializing..."
        git init
        continue
    fi
    
    # Check if there are any changes to commit
    if git status --porcelain | grep -q .; then
        COMMIT_COUNTER=$((COMMIT_COUNTER + 1))
        TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
        COMMIT_MESSAGE="🤖 Auto-commit #${COMMIT_COUNTER}: ${TIMESTAMP}"
        
        # Get diff stats before committing
        ADDED_LINES=$(git diff --numstat | awk '{sum+=$1} END {print sum+0}')
        DELETED_LINES=$(git diff --numstat | awk '{sum+=$2} END {print sum+0}')
        
        # Get the actual diff content (limited to 50KB to avoid huge payloads)
        DIFF_CONTENT=$(git diff --no-color 2>/dev/null | head -c 51200)
        
        # Stage all changes
        git add -A
        
        # Create commit
        git commit -m "$COMMIT_MESSAGE" \
            --author="Assessment Bot <bot@hermes.assessment>" \
            2>/dev/null
        
        COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null)
        
        echo "[Auto-Commit] ✓ Committed: $COMMIT_HASH"
        echo "[Auto-Commit]   +${ADDED_LINES} -${DELETED_LINES} lines"
        
        # Send notification to Hermes
        send_commit_notification \
            "$COMMIT_HASH" \
            "$COMMIT_MESSAGE" \
            "${ADDED_LINES:-0}" \
            "${DELETED_LINES:-0}" \
            "$DIFF_CONTENT"
    else
        echo "[Auto-Commit] No changes detected"
    fi
done
