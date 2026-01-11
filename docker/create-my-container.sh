#!/bin/bash
# Helper script to create a container for your authenticated user account

echo "🔍 Finding Your User Account"
echo "=============================================="
echo ""

# Check if user provided their email
if [ -z "$1" ]; then
    echo "Usage: ./docker/create-my-container.sh <your-email@example.com>"
    echo ""
    echo "This script will:"
    echo "  1. Look up your candidate ID from the database"
    echo "  2. Stop any existing test containers"
    echo "  3. Create a container specific to your account"
    echo ""
    echo "Example:"
    echo "  ./docker/create-my-container.sh aidan@hermes.com"
    echo ""
    exit 1
fi

USER_EMAIL="$1"

echo "📧 Email: $USER_EMAIL"
echo ""

# Note: This requires Supabase CLI or direct database access
# For now, we'll create a container with the email as the ID
# In production, you'd query the database to get the actual UUID

echo "⚠️  Manual Step Required:"
echo "=============================================="
echo ""
echo "To get your candidate ID, run this SQL query in Supabase:"
echo ""
echo "SELECT id, email, name FROM candidates WHERE email = '$USER_EMAIL';"
echo ""
echo "Then run:"
echo ""
echo "./docker/start-assessment.sh <your-candidate-id>"
echo ""
echo "=============================================="
echo ""

# Alternative: If you know your candidate ID, just pass it directly
if [ -n "$2" ]; then
    CANDIDATE_ID="$2"
    echo "✅ Using provided candidate ID: $CANDIDATE_ID"
    echo ""
    
    # Stop test container
    echo "🛑 Stopping test container..."
    docker rm -f hermes-assessment-test-user-123 2>/dev/null || true
    
    # Start your container
    echo "🚀 Starting your container..."
    ./docker/start-assessment.sh "$CANDIDATE_ID"
    
    echo ""
    echo "✅ Done! Your container is running."
    echo "Test it with: ./docker/test-environment.sh"
else
    echo "💡 Quick Start (if you know your ID):"
    echo "./docker/create-my-container.sh $USER_EMAIL <your-candidate-id>"
fi
