#!/bin/bash
# Production Docker Build Verification Script
# Tests that the Docker image builds correctly and runs in production mode

set -e

echo "🏗️  Production Docker Build Verification"
echo "=============================================="
echo ""

DOCKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="hermes-assessment:latest"
TEST_CONTAINER_NAME="hermes-prod-test"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Test 1: Build the image
echo "Test 1: Building Docker Image"
echo "------------------------------"
echo "Building from: $DOCKER_DIR/Dockerfile.assessment"
echo ""

if docker build -t "$IMAGE_NAME" -f "$DOCKER_DIR/Dockerfile.assessment" "$DOCKER_DIR"; then
    echo -e "${GREEN}✅ Image built successfully${NC}"
else
    echo -e "${RED}❌ Image build failed${NC}"
    exit 1
fi
echo ""

# Test 2: Inspect image
echo "Test 2: Image Inspection"
echo "------------------------"
IMAGE_SIZE=$(docker images "$IMAGE_NAME" --format "{{.Size}}")
echo "Image size: $IMAGE_SIZE"
echo ""

# Check for required files in the image
echo "Checking image contents..."
docker run --rm "$IMAGE_NAME" ls -la /workspace > /tmp/workspace-contents.txt
if grep -q "README.md" /tmp/workspace-contents.txt; then
    echo -e "${GREEN}✅ Workspace files present${NC}"
else
    echo -e "${YELLOW}⚠️  Workspace might be empty${NC}"
fi
echo ""

# Test 3: Start container with production-like environment
echo "Test 3: Production Environment Test"
echo "------------------------------------"
echo "Starting container with production environment variables..."
echo ""

# Clean up any existing test container
docker rm -f "$TEST_CONTAINER_NAME" 2>/dev/null || true

# Start container with production-like config
CONTAINER_ID=$(docker run -d \
    --name "$TEST_CONTAINER_NAME" \
    -p "8081:8080" \
    -e "CANDIDATE_ID=prod-test-user" \
    -e "SESSION_ID=prod-test-session" \
    -e "TELEMETRY_URL=http://host.docker.internal:3000" \
    -e "SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-}" \
    -e "SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" \
    "$IMAGE_NAME")

echo "Container ID: $CONTAINER_ID"
echo "Waiting for startup..."
sleep 5

# Test 4: Health check
echo ""
echo "Test 4: Container Health Check"
echo "-------------------------------"
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$TEST_CONTAINER_NAME" 2>/dev/null || echo "no health check")
echo "Health status: $HEALTH_STATUS"

# Test 5: Check if code-server is running
echo ""
echo "Test 5: Code-Server Status"
echo "--------------------------"
if docker exec "$TEST_CONTAINER_NAME" pgrep -f code-server > /dev/null; then
    echo -e "${GREEN}✅ code-server is running${NC}"
else
    echo -e "${RED}❌ code-server is not running${NC}"
    echo "Container logs:"
    docker logs "$TEST_CONTAINER_NAME" | tail -20
fi

# Test 6: HTTP endpoint test
echo ""
echo "Test 6: HTTP Endpoint Test"
echo "--------------------------"
sleep 2
if curl -s http://localhost:8081/healthz > /dev/null 2>&1; then
    RESPONSE=$(curl -s http://localhost:8081/healthz)
    echo "Health endpoint response: $RESPONSE"
    echo -e "${GREEN}✅ HTTP endpoint accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Health endpoint not responding (might need more time)${NC}"
fi

# Test 7: Check entrypoint execution
echo ""
echo "Test 7: Entrypoint Execution"
echo "----------------------------"
echo "Checking container logs for entrypoint messages..."
if docker logs "$TEST_CONTAINER_NAME" 2>&1 | grep -q "Environment ready"; then
    echo -e "${GREEN}✅ Entrypoint executed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Entrypoint might have issues${NC}"
fi

# Test 8: Workspace initialization
echo ""
echo "Test 8: Workspace Initialization"
echo "---------------------------------"
if docker exec "$TEST_CONTAINER_NAME" test -d /workspace/.git; then
    echo -e "${GREEN}✅ Git repository initialized${NC}"
else
    echo -e "${RED}❌ Git repository not initialized${NC}"
fi

# Test 9: Check for required binaries
echo ""
echo "Test 9: Required Binaries"
echo "-------------------------"
BINARIES=("git" "node" "npm" "code-server")
for binary in "${BINARIES[@]}"; do
    if docker exec "$TEST_CONTAINER_NAME" which "$binary" > /dev/null 2>&1; then
        VERSION=$(docker exec "$TEST_CONTAINER_NAME" "$binary" --version 2>&1 | head -1)
        echo -e "${GREEN}✅ $binary: $VERSION${NC}"
    else
        echo -e "${RED}❌ $binary: not found${NC}"
    fi
done

# Test 10: Environment variables in container
echo ""
echo "Test 10: Environment Variables"
echo "-------------------------------"
docker exec "$TEST_CONTAINER_NAME" env | grep -E "(CANDIDATE_ID|SESSION_ID|TELEMETRY_URL)" | sort

# Summary
echo ""
echo "=============================================="
echo "📊 Test Summary"
echo "=============================================="
echo ""
echo "Image: $IMAGE_NAME"
echo "Size: $IMAGE_SIZE"
echo "Container: $TEST_CONTAINER_NAME"
echo "Port: http://localhost:8081"
echo ""
echo "To view logs:"
echo "  docker logs $TEST_CONTAINER_NAME"
echo ""
echo "To access container:"
echo "  docker exec -it $TEST_CONTAINER_NAME /bin/bash"
echo ""
echo "To clean up:"
echo "  docker rm -f $TEST_CONTAINER_NAME"
echo ""
echo -e "${GREEN}✅ Production build verification complete!${NC}"
echo ""
