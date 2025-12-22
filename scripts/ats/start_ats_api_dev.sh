#!/bin/bash

# Start ATS Filter API Server (Development Mode - No Virtual Environment)
# Use this for development when packages are already installed globally

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting ATS Filter API (Development Mode)...${NC}"

# Change to the scripts directory
cd "$(dirname "$0")"

# Check if .env.local exists
if [ ! -f "../.env.local" ]; then
    echo -e "${RED}Warning: .env.local file not found${NC}"
    echo -e "${RED}Please create .env.local with required environment variables${NC}"
    exit 1
fi

# Export environment variables
export $(grep -v '^#' ../.env.local | xargs)

# Start the server
echo -e "${GREEN}✓ Starting ATS Filter API server...${NC}"
echo -e "${GREEN}API will be available at: http://localhost:8000${NC}"
echo -e "${GREEN}API documentation at: http://localhost:8000/docs${NC}"
echo ""

# Run with python3 directly
python3 ats_api.py
