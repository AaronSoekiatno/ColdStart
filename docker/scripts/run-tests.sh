#!/bin/bash
# run-tests.sh
# Execute assessment tests inside the container
# Usage: ./run-tests.sh [quick|full]

set -e

MODE="${1:-quick}"
WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"
RESULTS_FILE="$WORKSPACE_DIR/test-results.json"

# ============================================
# Commit Logging Function
# ============================================
log_commit_to_supabase() {
    # Enable debug mode if DEBUG_COMMIT_LOGGING is set
    local DEBUG_MODE="${DEBUG_COMMIT_LOGGING:-false}"

    # Guard clause: Check if git repo exists
    if [ ! -d "$WORKSPACE_DIR/.git" ]; then
        echo "   ⚠️  No git repository found, skipping commit logging"
        [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Checked path: $WORKSPACE_DIR/.git"
        return 0
    fi

    # Guard clause: Check for required environment variables
    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
        echo "   ⚠️  NEXT_PUBLIC_SUPABASE_URL not set, skipping commit logging"
        [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Available env vars: CANDIDATE_ID=${CANDIDATE_ID:-unset}"
        return 0
    fi

    if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
        echo "   ⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY not set, skipping commit logging"
        [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] NEXT_PUBLIC_SUPABASE_URL is set to: $NEXT_PUBLIC_SUPABASE_URL"
        return 0
    fi

    echo "📝 Logging commit to Supabase..."
    local COMMIT_START=$(date +%s.%N)
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] CANDIDATE_ID: ${CANDIDATE_ID:-unknown}"

    # OPTIMIZED: Get all commit info in a single git log call
    read -r COMMIT_HASH COMMIT_AUTHOR COMMIT_TIMESTAMP RAW_COMMIT_MSG < <(
        git log -1 --format='%H %an %aI %s' 2>/dev/null || echo "no-commit unknown $(date -Iseconds) no-message"
    )
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Commit - Hash: $COMMIT_HASH, Author: $COMMIT_AUTHOR"
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Commit - Timestamp: $COMMIT_TIMESTAMP"
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Commit - Message: $RAW_COMMIT_MSG"

    # OPTIMIZED: Get stats with the same git show call (avoid separate git show)
    read -r ADDED DELETED < <(
        git diff --numstat HEAD~1 HEAD 2>/dev/null | awk '{ added += $1; deleted += $2 } END { print added+0, deleted+0 }' || echo "0 0"
    )
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Git metrics (HEAD commit) - Added: $ADDED, Deleted: $DELETED"

    # Sanitize commit message for JSON
    COMMIT_MSG=$(echo "$RAW_COMMIT_MSG" | sed 's/"/\\"/g' | tr -d '\n')

    # OPTIMIZED: Capture smaller diff (50KB instead of 500KB) and skip base64 encoding
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Capturing git diff..."
    DIFF_CONTENT_RAW=$(git diff --unified=1 HEAD~1 HEAD \
        -- . \
        ':!node_modules' ':!package-lock.json' ':!yarn.lock' \
        ':!pnpm-lock.yaml' ':!bun.lockb' ':!.next' ':!dist' \
        ':!build' ':!.cache' ':!coverage' ':!.env' ':!.env.local' \
        ':!.env.*' ':!*.log' ':!.DS_Store' ':!Thumbs.db' \
        ':!.git' ':!*.min.js' ':!*.min.css' ':!*.map' \
        2>/dev/null \
        | head -c 50000)

    # Base64 encode the diff to safely include in JSON
    DIFF_CONTENT=$(echo "$DIFF_CONTENT_RAW" | base64 | tr -d '\n')
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Diff content length (base64): ${#DIFF_CONTENT} characters"



    # Build JSON payload
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Building JSON payload..."
    PAYLOAD=$(cat <<EOF
{
  "p_candidate_id": "${CANDIDATE_ID:-unknown}",
  "p_event": "push",
  "p_added_lines": $ADDED,
  "p_deleted_lines": $DELETED,
  "p_commit_message": "$COMMIT_MSG",
  "p_session_id": "${SESSION_ID:-unknown}",
  "p_commit_hash": "$COMMIT_HASH",
  "p_commit_author": "$COMMIT_AUTHOR",
  "p_commit_timestamp": "$COMMIT_TIMESTAMP",
  "p_diff_content": "$DIFF_CONTENT"
}
EOF
)
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Payload size: ${#PAYLOAD} bytes"
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Payload preview (first 200 chars): ${PAYLOAD:0:200}..."

    # Call Supabase RPC function
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Calling Supabase RPC endpoint..."
    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Endpoint: $NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/log_session_commit"

    # Use echo + pipe to avoid "Argument list too long" error with large payloads
    RESPONSE=$(echo "$PAYLOAD" | curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/log_session_commit" \
        -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" \
        -d @- 2>&1) || true

    [ "$DEBUG_MODE" = "true" ] && echo "   [DEBUG] Response received: $RESPONSE"



    # Check response (handle both "success":true and "success" : true with spaces)
    if echo "$RESPONSE" | grep -qE '"success"\s*:\s*true' 2>/dev/null; then
        echo "   ✓ Commit logged successfully"
        [ "$DEBUG_MODE" = "true" ] && echo "   📋 Response: $RESPONSE"
    else
        echo "   ⚠️  Commit logging may have failed (tests will continue)"
        echo "   📋 Response: $RESPONSE"
    fi



    return 0  # Always return success to allow tests to proceed
}

# ============================================
# Phase Transition API Call Function
# ============================================
call_test_api() {
    # Guard clause: Check for required environment variables
    if [ -z "$TELEMETRY_URL" ]; then
        echo "   ⚠️  TELEMETRY_URL not set, skipping phase transition API call"
        return 0
    fi

    if [ -z "$SESSION_ID" ]; then
        echo "   ⚠️  SESSION_ID not set, skipping phase transition API call"
        return 0
    fi

    echo "📡 Calling phase transition API endpoint..."

    # Determine test conclusion from results file
    if [ ! -f "$RESULTS_FILE" ]; then
        echo "   ⚠️  Test results file not found, cannot determine conclusion"
        return 0
    fi

    # Parse test results to determine conclusion
    # Using jq if available, otherwise fallback to grep
    if command -v jq >/dev/null 2>&1; then
        TEST_SUCCESS=$(jq -r '.success // false' "$RESULTS_FILE" 2>/dev/null || echo "false")
        NUM_FAILED=$(jq -r '.numFailedTestSuites // 0' "$RESULTS_FILE" 2>/dev/null || echo "0")
    else
        # Fallback: check if "success" : true appears in JSON
        if grep -q '"success"\s*:\s*true' "$RESULTS_FILE" 2>/dev/null; then
            TEST_SUCCESS="true"
            NUM_FAILED="0"
        else
            TEST_SUCCESS="false"
            NUM_FAILED="1"
        fi
    fi

    # Get commit SHA
    COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "no-commit")

    # Determine conclusion based on test results
    if [ "$TEST_SUCCESS" = "true" ] && [ "$NUM_FAILED" = "0" ]; then
        CONCLUSION="success"
        STATUS="success"
    else
        CONCLUSION="failure"
        STATUS="failure"
    fi

    echo "   📊 Test Results: status=$STATUS, conclusion=$CONCLUSION, commit=$COMMIT_SHA"

    # Build JSON payload
    PAYLOAD=$(cat <<EOF
{
  "sessionId": "$SESSION_ID",
  "testData": {
    "status": "$STATUS",
    "conclusion": "$CONCLUSION",
    "head_sha": "$COMMIT_SHA"
  }
}
EOF
)

    # Call the API endpoint
    RESPONSE=$(echo "$PAYLOAD" | curl -s -X POST "$TELEMETRY_URL/api/interview/test" \
        -H "Content-Type: application/json" \
        -d @- 2>&1) || true

    # Check response
    if echo "$RESPONSE" | grep -qE '"success"\s*:\s*true' 2>/dev/null; then
        echo "   ✓ Phase transition API called successfully"
        # Log if phase transition occurred
        if echo "$RESPONSE" | grep -qE '"transitioned"\s*:\s*true' 2>/dev/null; then
            # Extract currentPhase from response (using grep/sed as fallback if jq not available)
            if command -v jq >/dev/null 2>&1; then
                NEW_PHASE=$(echo "$RESPONSE" | jq -r '.currentPhase // "unknown"' 2>/dev/null || echo "unknown")
            else
                NEW_PHASE=$(echo "$RESPONSE" | grep -oE '"currentPhase"\s*:\s*"[^"]*"' | cut -d'"' -f4 || echo "unknown")
            fi
            echo "   🎯 Phase transitioned to: $NEW_PHASE"
        else
            echo "   ℹ️  No phase transition (tests may have failed or already in final phase)"
        fi
    else
        echo "   ⚠️  API call may have failed (check logs for details)"
        echo "   📋 Response: $RESPONSE"
    fi

    return 0  # Always return success to allow script to continue
}

echo "🚀 Starting assessment tests (Mode: $MODE)..."
START_TIME=$(date +%s)
cd "$WORKSPACE_DIR"

# Update last test activity timestamp for auto-destruct monitoring
date +%s > /tmp/last_test_activity || true

# Ensure we have the necessary environment
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in $WORKSPACE_DIR"
    exit 1
fi

# Log commit in parallel (background) so tests start immediately
log_commit_to_supabase &
COMMIT_LOG_PID=$!

# Fix permissions for node_modules cache directory (vitest needs to write .vite cache)
# Optimization: Don't recursivley scan all of node_modules, just ensure .vite is writable
if [ -d "$WORKSPACE_DIR/node_modules" ]; then
    mkdir -p "$WORKSPACE_DIR/node_modules/.vite"
    chmod -R u+w "$WORKSPACE_DIR/node_modules/.vite" 2>/dev/null || true
fi

# Clean previous results
rm -f "$RESULTS_FILE"



# Define test command based on mode
# Add debug output to help diagnose issues
echo "   Working directory: $(pwd)"
echo "   Results file path: $RESULTS_FILE"
echo "   Vitest config: /usr/local/share/assessment/vitest.config.ts"

# Check if vitest is available
if ! command -v npx >/dev/null 2>&1; then
    echo "   ⚠️  ERROR: npx not found in PATH"
    echo "   PATH: $PATH"
fi

# Define test command based on mode
if [ "$MODE" == "full" ]; then
    # Full validation: Run all tests including build verification
    echo "Running FULL validation suite..."
    # We use a custom timeout for full tests as build can take time
    npx vitest run -c /usr/local/share/assessment/vitest.config.ts --reporter=json --outputFile="$RESULTS_FILE" 2>&1 || VITEST_EXIT=$?
else
    # Quick validation: Skip the slow build test
    echo "Running QUICK validation suite..."
    npx vitest run -c /usr/local/share/assessment/vitest.config.ts --exclude "**/build.test.ts" --reporter=json --outputFile="$RESULTS_FILE" 2>&1 || VITEST_EXIT=$?
fi

# Check vitest execution result
VITEST_EXIT=${VITEST_EXIT:-0}
if [ $VITEST_EXIT -ne 0 ]; then
    echo "   ⚠️  Vitest exited with code: $VITEST_EXIT"
fi

# Verify results file was created
if [ -f "$RESULTS_FILE" ]; then
    FILE_SIZE=$(stat -f%z "$RESULTS_FILE" 2>/dev/null || stat -c%s "$RESULTS_FILE" 2>/dev/null || echo "0")
    echo "   ✓ Results file created: $RESULTS_FILE (${FILE_SIZE} bytes)"
else
    echo "   ⚠️  Results file NOT created at: $RESULTS_FILE"
    echo "   Directory contents:"
    ls -la "$WORKSPACE_DIR/" | head -20 || true
fi

# Determine overall exit code
EXIT_CODE=0
if [ $VITEST_EXIT -ne 0 ] && [ ! -f "$RESULTS_FILE" ]; then
    # Vitest crashed without producing results
    EXIT_CODE=$VITEST_EXIT
    echo "⚠️  Vitest failed without producing results (exit code: $VITEST_EXIT)"
elif [ -f "$RESULTS_FILE" ]; then
    # Results exist - parse to determine if tests passed
    TEST_SUCCESS=$(grep -o '"success"\s*:\s*true' "$RESULTS_FILE" 2>/dev/null || echo "")
    if [ -n "$TEST_SUCCESS" ]; then
        echo "✅ Tests passed successfully!"
    else
        echo "⚠️  Some tests failed. Checking results..."
    fi
else
    echo "⚠️  Unexpected state: Vitest completed but no results file found"
fi

# Calculate and display execution time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo "⏱️  Total execution time: ${DURATION}s"

# Ensure the results file exists even if tests crashed (create empty error json if missing)
if [ ! -f "$RESULTS_FILE" ]; then
    echo "⚠️  Creating fallback results file due to missing output"

    # Create detailed error message
    ERROR_MSG="Test runner failed to produce output. Vitest exit code: ${VITEST_EXIT}."

    # Check for common issues
    if [ ! -f "/usr/local/share/assessment/vitest.config.ts" ]; then
        ERROR_MSG="${ERROR_MSG} Missing vitest config."
    fi

    if [ ! -d "$WORKSPACE_DIR/node_modules" ]; then
        ERROR_MSG="${ERROR_MSG} node_modules not found."
    fi

    echo "{\"numTotalTestSuites\": 0, \"numPassedTestSuites\": 0, \"numFailedTestSuites\": 0, \"testResults\": [], \"success\": false, \"message\": \"${ERROR_MSG}\", \"vitestExitCode\": ${VITEST_EXIT}}" > "$RESULTS_FILE"
fi

# Wait for commit logging to finish (if still running)
wait $COMMIT_LOG_PID 2>/dev/null || true
# Call phase transition API after tests complete
call_test_api

# Output the results file content for the caller to capture if needed
# (or they can read the file directly)
echo "" # Ensure newline separator
echo "___JSON_START___"
cat "$RESULTS_FILE"
echo "___JSON_END___"

exit $EXIT_CODE
