#!/bin/bash

# Start ATS Filter API Server
# This script starts the FastAPI server for the ATS filtering service

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting ATS Filter API...${NC}"

# Change to the scripts directory
cd "$(dirname "$0")"

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo -e "${BLUE}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo -e "${BLUE}Activating virtual environment...${NC}"
source venv/bin/activate

# Install/upgrade dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pip install -q --upgrade pip
pip install -q -r ../requirements.txt

# Download spaCy model if not already downloaded
echo -e "${BLUE}Checking spaCy model...${NC}"
python3 -m spacy download en_core_web_sm --quiet 2>/dev/null || echo "spaCy model already installed"

# Check if .env.local exists
if [ ! -f "../.env.local" ]; then
    echo -e "${RED}Warning: .env.local file not found${NC}"
    echo -e "${RED}Please create .env.local with required environment variables${NC}"
    exit 1
fi

# Start the server
echo -e "${GREEN}✓ Starting ATS Filter API server...${NC}"
echo -e "${GREEN}API will be available at: http://localhost:8000${NC}"
echo -e "${GREEN}API documentation at: http://localhost:8000/docs${NC}"
echo ""

# Run uvicorn
python3 ats_api.py
