#!/bin/bash

# Script to check for potential Claude API usage sources

echo "🔍 Investigating Claude API Usage Sources"
echo "=========================================="
echo ""

# 1. Check if ANTHROPIC_API_KEY is in any public files
echo "1️⃣ Checking for exposed API keys in git history..."
if git log --all --source --full-history -S "sk-ant-" --pretty=format:"%h %s" 2>/dev/null | head -5; then
    echo "⚠️  WARNING: Found 'sk-ant-' in git history!"
    echo "   Your API key may have been committed to git."
else
    echo "✅ No API keys found in git history"
fi
echo ""

# 2. Check for any running Next.js processes
echo "2️⃣ Checking for running Next.js processes..."
if pgrep -f "next-server" > /dev/null; then
    echo "⚠️  Next.js server is running"
    pgrep -f "next-server" -l
else
    echo "✅ No Next.js server running locally"
fi
echo ""

# 3. Check Vercel deployments
echo "3️⃣ Checking Vercel deployment status..."
if command -v vercel &> /dev/null; then
    echo "Running: vercel ls"
    vercel ls 2>&1 | head -10
else
    echo "⚠️  Vercel CLI not installed (install with: npm i -g vercel)"
fi
echo ""

# 4. Check environment variables
echo "4️⃣ Checking environment variables..."
if [ -f ".env.local" ]; then
    echo "✅ .env.local exists"
    if grep -q "ANTHROPIC_API_KEY" .env.local; then
        echo "✅ ANTHROPIC_API_KEY is set in .env.local"
        # Show first few characters only
        key=$(grep "ANTHROPIC_API_KEY" .env.local | cut -d'=' -f2 | cut -c1-10)
        echo "   Key starts with: ${key}..."
    fi
else
    echo "⚠️  .env.local not found"
fi
echo ""

# 5. Check for any test scripts that might be running
echo "5️⃣ Checking for test/script processes..."
ps aux | grep -E "test-claude|analyze|inspect" | grep -v grep || echo "✅ No test scripts running"
echo ""

echo "=========================================="
echo "✅ Investigation complete"
echo ""
echo "Next steps:"
echo "1. Check Anthropic Console: https://console.anthropic.com/settings/usage"
echo "2. Check Vercel deployment logs if deployed"
echo "3. Rotate API key if you suspect it's compromised"
