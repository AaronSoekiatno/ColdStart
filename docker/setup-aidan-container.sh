#!/bin/bash
# Script to create a container for Aidan's account
# This mimics the production flow by calling the provision API

set -e

echo "🔍 Setting up container for Aidan Nguyen-Tran"
echo "=============================================="
echo ""

USER_EMAIL="aidan.nt76@gmail.com"
API_URL="http://localhost:3000"

# Check if the app is running
if ! curl -s "$API_URL" > /dev/null 2>&1; then
    echo "❌ Error: Hermes app is not running at $API_URL"
    echo "Please start it with: npm run dev"
    exit 1
fi

echo "✅ App is running at $API_URL"
echo ""

# Step 1: Call the provision API to get credentials
echo "📡 Calling provision API..."
echo "   (This will create your schema and get credentials)"
echo ""

# Note: This requires authentication. For local dev, we can use the service role key
# or you need to be signed in and pass cookies

PROVISION_RESPONSE=$(curl -s -X POST "$API_URL/api/topcandidates/provision" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY:-}" \
    2>&1)

# Check if we got a valid response
if echo "$PROVISION_RESPONSE" | grep -q "CANDIDATE_ID"; then
    echo "✅ Got credentials from provision API"
    echo ""
    
    # Parse the response (assuming JSON)
    CANDIDATE_ID=$(echo "$PROVISION_RESPONSE" | grep -o '"CANDIDATE_ID":"[^"]*"' | cut -d'"' -f4)
    SUPABASE_URL=$(echo "$PROVISION_RESPONSE" | grep -o '"SUPABASE_URL":"[^"]*"' | cut -d'"' -f4)
    SUPABASE_ANON_KEY=$(echo "$PROVISION_RESPONSE" | grep -o '"SUPABASE_ANON_KEY":"[^"]*"' | cut -d'"' -f4)
    SUPABASE_PRIVATE_KEY=$(echo "$PROVISION_RESPONSE" | grep -o '"SUPABASE_PRIVATE_KEY":"[^"]*"' | cut -d'"' -f4)
    GEMINI_BASE_URL=$(echo "$PROVISION_RESPONSE" | grep -o '"GEMINI_BASE_URL":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$CANDIDATE_ID" ]; then
        echo "❌ Could not parse CANDIDATE_ID from response"
        echo "Response: $PROVISION_RESPONSE"
        exit 1
    fi
    
    echo "📝 Your Details:"
    echo "   Email: $USER_EMAIL"
    echo "   Candidate ID: $CANDIDATE_ID"
    echo ""
else
    echo "⚠️  Could not authenticate with provision API"
    echo "Response: $PROVISION_RESPONSE"
    echo ""
    echo "Alternative: Manual lookup"
    echo "=============================================="
    echo ""
    echo "Run this SQL in Supabase to get your candidate ID:"
    echo ""
    echo "SELECT id, email, name FROM candidates WHERE email = '$USER_EMAIL';"
    echo ""
    echo "Then run:"
    echo "./docker/start-assessment.sh <your-candidate-id>"
    echo ""
    exit 1
fi

# Step 2: Stop any existing test container
echo "🛑 Stopping test container..."
docker rm -f hermes-assessment-test-user-123 2>/dev/null || true
docker rm -f "hermes-assessment-$CANDIDATE_ID" 2>/dev/null || true
echo ""

# Step 3: Start container with your credentials
echo "🚀 Starting YOUR container..."
echo "   Container name: hermes-assessment-$CANDIDATE_ID"
echo ""

# Export credentials for the start script
export CANDIDATE_ID="$CANDIDATE_ID"
export SESSION_ID=""  # Will be set when you start an interview
export TELEMETRY_URL="$API_URL"
export SUPABASE_URL="$SUPABASE_URL"
export SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export SUPABASE_PRIVATE_KEY="$SUPABASE_PRIVATE_KEY"
export GEMINI_BASE_URL="$GEMINI_BASE_URL"

# Run the start script
./docker/start-assessment.sh "$CANDIDATE_ID"

echo ""
echo "=============================================="
echo "✅ Your container is ready!"
echo ""
echo "📊 Test it:"
echo "   ./docker/test-environment.sh"
echo ""
echo "🌐 Access it:"
echo "   http://localhost:8080"
echo ""
echo "🖥️  Use it in the app:"
echo "   1. Visit http://localhost:3000/ide"
echo "   2. Sign in as $USER_EMAIL"
echo "   3. Your container will load automatically"
echo ""
echo "=============================================="
