#!/bin/bash
# ============================================
# Hermes Assessment Environment Entrypoint
# ============================================
# This script:
# 1. Configures Git for the candidate
# 2. Initializes the workspace repository
# 3. Starts telemetry sidecar (background)
# 4. Starts auto-commit daemon (background)
# 5. Launches code-server
# ============================================

set -e

echo "🚀 Starting Hermes Assessment Environment..."
echo "============================================"

# ============================================
# 1. Configure Git
# ============================================
echo "📝 Configuring Git..."
git config --global user.name "${GIT_USER_NAME:-Candidate}"
git config --global user.email "${GIT_USER_EMAIL:-candidate@assessment.local}"
git config --global init.defaultBranch main
git config --global core.autocrlf input

# ============================================
# 2. Initialize workspace if needed
# ============================================
if [ ! -d "/workspace/.git" ]; then
    echo "📁 Initializing workspace repository..."
    cd /workspace
    git init
    
    # Create initial README if workspace is empty
    if [ ! -f "README.md" ]; then
        echo "# Assessment Workspace" > README.md
        echo "" >> README.md
        echo "Your assessment environment is ready!" >> README.md
        echo "" >> README.md
        echo "## Quick Start" >> README.md
        echo "1. Run \`npm install\` to install dependencies" >> README.md
        echo "2. Run \`npm run dev\` to start the development server" >> README.md
        echo "3. Run \`npm test\` to run tests" >> README.md
    fi
    
    git add -A 2>/dev/null || true
    git commit -m "Initial workspace setup" 2>/dev/null || true
fi

# ============================================
# 3. Start telemetry sidecar (background)
# ============================================
if [ -n "$TELEMETRY_URL" ] && [ -n "$SESSION_ID" ]; then
    echo "📊 Starting telemetry sidecar..."
    /usr/local/bin/telemetry-sidecar.sh &
    TELEMETRY_PID=$!
    echo "   Telemetry PID: $TELEMETRY_PID"
else
    echo "⚠️  Telemetry disabled (TELEMETRY_URL or SESSION_ID not set)"
fi

# ============================================
# 4. Configure Claude Code settings (inject env vars)
# ============================================
if [ -f "/home/coder/.claude/settings.local.json" ]; then
    echo "🔧 Configuring Claude Code with runtime environment..."
    
    # Replace environment variable placeholders in Claude settings
    sed -i "s|\${TELEMETRY_URL:-}|${TELEMETRY_URL:-}|g" /home/coder/.claude/settings.local.json
    sed -i "s|\${SESSION_ID:-}|${SESSION_ID:-}|g" /home/coder/.claude/settings.local.json
    sed -i "s|\${CANDIDATE_ID:-}|${CANDIDATE_ID:-}|g" /home/coder/.claude/settings.local.json
    
    echo "   ✓ Claude Code configured"
else
    echo "⚠️  Claude Code settings not found at /home/coder/.claude/settings.local.json"
fi

# ============================================
# 5. Start auto-commit daemon (background)
# ============================================
echo "⏰ Starting auto-commit daemon (every ${AUTO_COMMIT_INTERVAL:-120}s)..."
/usr/local/bin/auto-commit.sh &
AUTO_COMMIT_PID=$!
echo "   Auto-commit PID: $AUTO_COMMIT_PID"

# ============================================
# 6. Log startup info
# ============================================
echo "============================================"
echo "✅ Environment ready!"
echo "📝 Candidate ID: ${CANDIDATE_ID:-not-set}"
echo "🔗 Session ID: ${SESSION_ID:-not-set}"
echo "🌐 Telemetry URL: ${TELEMETRY_URL:-not-set}"
echo "⏰ Auto-commit interval: ${AUTO_COMMIT_INTERVAL:-120}s"
echo "============================================"

# ============================================
# 7. Start code-server
# ============================================
echo "🖥️  Starting code-server on 0.0.0.0:8080..."
exec code-server --bind-addr 0.0.0.0:8080 /workspace
