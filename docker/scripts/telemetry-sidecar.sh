#!/bin/bash
# ============================================
# Telemetry Sidecar
# ============================================
# Collects and reports assessment metrics:
# - Container start/stop events
# - Periodic heartbeats with resource usage
# - Session activity tracking
#
# Integrates with: POST /api/interview/commit (heartbeat events)
# ============================================

TELEMETRY_URL=${TELEMETRY_URL:-""}
CANDIDATE_ID=${CANDIDATE_ID:-"unknown"}
SESSION_ID=${SESSION_ID:-""}
HEARTBEAT_INTERVAL=30
TEST_INACTIVITY_TIMEOUT=900  # 15 minutes - destroy if no test runs
LAST_TEST_ACTIVITY_FILE="/tmp/last_test_activity"

echo "[Telemetry] Starting sidecar for session: ${SESSION_ID}"
echo "[Telemetry] Endpoint: ${TELEMETRY_URL}"

# Function to send telemetry event via the commit endpoint
send_event() {
    local event_type="$1"
    local event_data="$2"

    if [ -z "$TELEMETRY_URL" ] || [ -z "$SESSION_ID" ]; then
        return 0
    fi

    # Use the existing commit endpoint with a special "telemetry" source
    curl -s -X POST "${TELEMETRY_URL}/api/interview/commit" \
        -H "Content-Type: application/json" \
        -d "{
            \"sessionId\": \"${SESSION_ID}\",
            \"commitHash\": \"telemetry-${event_type}-$(date +%s)\",
            \"commitMessage\": \"[Telemetry] ${event_type}\",
            \"source\": \"telemetry\",
            \"metadata\": ${event_data}
        }" 2>/dev/null || true
}

# Function to destroy the Fly.io machine (auto-destruct)
destroy_machine() {
    local reason="$1"
    echo "[Telemetry] ⚠️  AUTO-DESTRUCT INITIATED: ${reason}"

    # Send final telemetry event before shutdown
    send_event "auto_destruct" "{\"reason\": \"${reason}\", \"timestamp\": $(date +%s)}"

    # Wait briefly to ensure telemetry is sent
    sleep 2

    # Fly.io machines can be stopped by killing the main process
    # Find and kill the code-server process (main container process)
    echo "[Telemetry] Stopping code-server process..."
    pkill -TERM code-server || true

    # Wait for graceful shutdown
    sleep 3

    # If still running, force kill
    pkill -KILL code-server || true

    # Force container exit
    echo "[Telemetry] Container shutdown complete"
    exit 0
}

# Function to get resource metrics
get_metrics() {
    local uptime=$(cat /proc/uptime 2>/dev/null | awk '{print $1}' || echo "0")
    local memory_info=$(free -m 2>/dev/null | awk '/Mem:/ {print $3 "," $2}' || echo "0,0")
    local memory_used=$(echo "$memory_info" | cut -d',' -f1)
    local memory_total=$(echo "$memory_info" | cut -d',' -f2)
    local cpu_load=$(cat /proc/loadavg 2>/dev/null | awk '{print $1}' || echo "0")
    
    # Workspace stats
    local file_count=0
    local commit_count=0
    if [ -d "/workspace/.git" ]; then
        file_count=$(find /workspace -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l || echo 0)
        commit_count=$(cd /workspace && git rev-list --count HEAD 2>/dev/null || echo 0)
    fi
    
    echo "{
        \"uptime\": ${uptime},
        \"memoryUsedMb\": ${memory_used:-0},
        \"memoryTotalMb\": ${memory_total:-0},
        \"cpuLoad\": ${cpu_load},
        \"fileCount\": ${file_count},
        \"commitCount\": ${commit_count}
    }"
}

# Send container start event
echo "[Telemetry] Sending container_start event..."
send_event "container_start" "{\"environment\": \"docker-code-server\", \"nodeVersion\": \"$(node --version 2>/dev/null || echo 'unknown')\"}"

# Trap for cleanup on container stop
cleanup() {
    echo "[Telemetry] Container stopping, sending shutdown event..."
    send_event "container_stop" "$(get_metrics)"
    exit 0
}
trap cleanup SIGTERM SIGINT

# Heartbeat loop
HEARTBEAT_COUNT=0
while true; do
    sleep $HEARTBEAT_INTERVAL
    HEARTBEAT_COUNT=$((HEARTBEAT_COUNT + 1))

    # Only log every 10th heartbeat to reduce noise
    if [ $((HEARTBEAT_COUNT % 10)) -eq 0 ]; then
        echo "[Telemetry] Heartbeat #${HEARTBEAT_COUNT}"
    fi

    # Check 1: Session status is 'completed' or 'cancelled'
    if [ -n "$TELEMETRY_URL" ] && [ -n "$SESSION_ID" ]; then
        SESSION_STATUS=$(curl -s "${TELEMETRY_URL}/api/interview/status/${SESSION_ID}" 2>/dev/null || echo "unknown")
        if [ "$SESSION_STATUS" = "completed" ] || [ "$SESSION_STATUS" = "cancelled" ]; then
            destroy_machine "session_${SESSION_STATUS}"
        fi
    fi

    # Check 2: No test runs in the last 15 minutes
    CURRENT_TIME=$(date +%s)
    if [ -f "$LAST_TEST_ACTIVITY_FILE" ]; then
        LAST_TEST_TIME=$(cat "$LAST_TEST_ACTIVITY_FILE" 2>/dev/null || echo "0")
        TIME_SINCE_LAST_TEST=$((CURRENT_TIME - LAST_TEST_TIME))

        if [ $TIME_SINCE_LAST_TEST -gt $TEST_INACTIVITY_TIMEOUT ]; then
            echo "[Telemetry] No test activity for ${TIME_SINCE_LAST_TEST}s (threshold: ${TEST_INACTIVITY_TIMEOUT}s)"
            destroy_machine "test_inactivity_timeout"
        fi
    else
        # No test activity file exists yet - check if container has been running for 15+ minutes
        # This handles the case where a candidate never runs tests
        CONTAINER_UPTIME=$(cat /proc/uptime 2>/dev/null | awk '{print int($1)}' || echo "0")
        if [ $CONTAINER_UPTIME -gt $TEST_INACTIVITY_TIMEOUT ]; then
            echo "[Telemetry] No tests have been run since container start (uptime: ${CONTAINER_UPTIME}s)"
            destroy_machine "no_tests_run"
        fi
    fi

    send_event "heartbeat" "$(get_metrics)"
done
