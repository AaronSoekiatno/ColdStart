#!/bin/bash
# Test the Agent Chat API endpoint

echo "🧪 Testing Agent Chat API..."
echo ""

# Test 1: Missing parameters
echo "Test 1: Missing parameters (should return 400)"
curl -X POST http://localhost:3000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n" \
  -s
echo ""

# Test 2: Invalid session (should return 404)
echo "Test 2: Invalid session (should return 404)"
curl -X POST http://localhost:3000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"invalid-session","message":"test"}' \
  -w "\nStatus: %{http_code}\n" \
  -s
echo ""

# Test 3: Valid session (requires actual Fly.io container)
echo "Test 3: Valid session (requires Fly.io container)"
echo "Replace 'session_1768440153226_sk39g7koz' with actual session ID"
curl -X POST http://localhost:3000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"session_1768440153226_sk39g7koz","message":"Hello, test message"}' \
  -w "\nStatus: %{http_code}\n" \
  -s
echo ""

echo "✅ Tests complete!"
