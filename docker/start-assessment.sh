#!/bin/bash
# ============================================
# Quick Start Script for Hermes Assessment Container
# ============================================
# Usage: ./start-assessment.sh [candidate_id] [session_id]
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DOCKER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$DOCKER_DIR")"

# Auto-source .env.local if it exists (for Supabase credentials, etc.)
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    set -a  # Auto-export all variables
    source "$PROJECT_ROOT/.env.local"
    set +a
    echo -e "${YELLOW}Loaded environment from .env.local${NC}"
fi

echo -e "${GREEN}🚀 Hermes Assessment Container Launcher${NC}"
echo "============================================"

# Parse arguments or use environment
CANDIDATE_ID="${1:-$CANDIDATE_ID}"
SESSION_ID="${2:-$SESSION_ID}"

# Validate required variables
if [ -z "$CANDIDATE_ID" ]; then
    echo -e "${RED}Error: CANDIDATE_ID is required${NC}"
    echo "Usage: ./start-assessment.sh [candidate_id] [session_id]"
    echo "Or set: export CANDIDATE_ID=xxx"
    exit 1
fi

if [ -z "$SESSION_ID" ]; then
    echo -e "${YELLOW}Warning: SESSION_ID not set, telemetry will be disabled${NC}"
fi

# Set defaults
TELEMETRY_URL="${TELEMETRY_URL:-http://host.docker.internal:3000}"
ASSESSMENT_PASSWORD="" # Auth is disabled
PORT="${PORT:-8080}"

echo ""
echo "Configuration:"
echo "  Candidate ID: $CANDIDATE_ID"
echo "  Session ID:   ${SESSION_ID:-not set}"
echo "  Telemetry:    $TELEMETRY_URL"
echo "  Port:         $PORT"
echo "  Password:     $ASSESSMENT_PASSWORD"
echo ""

# Sync mission code into workspace before building
echo -e "${YELLOW}Syncing mission: AbsurdLangChain...${NC}"
# Use rsync if available, otherwise cp
if command -v rsync >/dev/null 2>&1; then
    rsync -av --delete "$PROJECT_ROOT/missions/AbsurdLangChain/" "$DOCKER_DIR/workspace/" --exclude node_modules --exclude .next
else
    cp -R "$PROJECT_ROOT/missions/AbsurdLangChain/." "$DOCKER_DIR/workspace/"
fi

# Build the image (always build to pick up code changes)
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t hermes-assessment:latest -f "$DOCKER_DIR/Dockerfile.assessment" "$DOCKER_DIR"



# Stop any existing container
if docker ps -a | grep -q "hermes-assessment-$CANDIDATE_ID"; then
    echo "Stopping existing container..."
    docker rm -f "hermes-assessment-$CANDIDATE_ID" 2>/dev/null || true
fi

# Start the container
echo -e "${GREEN}Starting container...${NC}"
CONTAINER_ID=$(docker run -d \
    --name "hermes-assessment-$CANDIDATE_ID" \
    -p "$PORT:8080" \
    -e "CANDIDATE_ID=$CANDIDATE_ID" \
    -e "SESSION_ID=$SESSION_ID" \
    -e "TELEMETRY_URL=$TELEMETRY_URL" \
    -e "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-$SUPABASE_URL}" \
    -e "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-$SUPABASE_ANON_KEY}" \
    -e "SUPABASE_PRIVATE_KEY=${SUPABASE_PRIVATE_KEY:-}" \
    -e "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-}" \
    -e "GEMINI_BASE_URL=${GEMINI_BASE_URL:-$TELEMETRY_URL/api/proxy/gemini}" \
    -e "GOOGLE_BASE_URL=${GOOGLE_BASE_URL:-$TELEMETRY_URL/api/proxy/gemini}" \
    -e "GOOGLE_API_KEY=${GOOGLE_API_KEY:-managed-by-proxy}" \
    -e "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}" \
    -e "QUARTERMASTER_API_URL=${QUARTERMASTER_API_URL:-$TELEMETRY_URL/api/topcandidates/provision}" \
    hermes-assessment:latest)



# Wait for startup
echo "Waiting for container to be ready..."
sleep 3

# Check health
if docker exec "$CONTAINER_ID" curl -sf http://localhost:8080/healthz > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}✅ Assessment environment is ready!${NC}"
    echo ""
    echo "============================================"
    echo -e "🌐 URL:      ${GREEN}http://localhost:${PORT}${NC}"
    echo -e "🔐 Password: ${GREEN}(Authentication Disabled)${NC}"
    echo "============================================"
    echo ""
    echo "To view logs:  docker logs -f hermes-assessment-$CANDIDATE_ID"
    echo "To stop:       docker rm -f hermes-assessment-$CANDIDATE_ID"
else
    echo -e "${YELLOW}Container started but health check pending...${NC}"
    echo "Check logs: docker logs hermes-assessment-$CANDIDATE_ID"
fi
