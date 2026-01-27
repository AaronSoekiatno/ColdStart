#!/bin/bash
# Test script to verify container environment configuration

echo "🧪 Testing Container Environment Configuration"
echo "=============================================="
echo ""

# Get container name
CONTAINER_NAME=$(docker ps --filter "name=hermes-assessment" --format "{{.Names}}" | head -1)

if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ No running container found"
    echo "Start a container first: ./docker/start-assessment.sh <candidate-id>"
    exit 1
fi

echo "✅ Found container: $CONTAINER_NAME"
echo ""

# Test 1: Check container health
echo "Test 1: Container Health"
echo "------------------------"
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "no health check")
echo "Health Status: $HEALTH"
echo ""

# Test 2: Check environment variables
echo "Test 2: Environment Variables"
echo "-----------------------------"
docker exec $CONTAINER_NAME env | grep -E "(CANDIDATE_ID|SESSION_ID|TELEMETRY_URL)" | sort
echo ""

# Test 3: Check code-server is running
echo "Test 3: Code-Server Status"
echo "--------------------------"
CODESERVER_PID=$(docker exec $CONTAINER_NAME pgrep -f code-server)
if [ -n "$CODESERVER_PID" ]; then
    echo "✅ code-server is running (PID: $CODESERVER_PID)"
else
    echo "❌ code-server is not running"
fi
echo ""

# Test 4: Check health endpoint
echo "Test 4: Health Endpoint"
echo "----------------------"
HEALTH_RESPONSE=$(curl -s http://localhost:8080/healthz)
echo "Response: $HEALTH_RESPONSE"
if echo "$HEALTH_RESPONSE" | grep -q "alive"; then
    echo "✅ Health endpoint responding"
else
    echo "❌ Health endpoint not responding"
fi
echo ""

# Test 5: Check workspace structure
echo "Test 5: Workspace Structure"
echo "--------------------------"
docker exec $CONTAINER_NAME ls -la /workspace | head -10
echo ""

# Test 6: Check git configuration
echo "Test 6: Git Configuration"
echo "------------------------"
docker exec $CONTAINER_NAME git config --list | grep -E "(user.name|user.email)"
echo ""


# Test 7: Check Claude Code configuration

# Test 7: Check Claude Code configuration
echo "Test 7: Claude Code Configuration"
echo "---------------------------------"
if docker exec $CONTAINER_NAME test -f /home/coder/.claude/settings.local.json; then
    echo "✅ Claude Code settings found"
    docker exec $CONTAINER_NAME cat /home/coder/.claude/settings.local.json
else
    echo "⚠️  Claude Code settings not found"
fi
echo ""

# Summary
echo "=============================================="
echo "✅ Environment test complete!"
echo ""
echo "Container: $CONTAINER_NAME"
echo "Access at: http://localhost:8080"
echo ""
