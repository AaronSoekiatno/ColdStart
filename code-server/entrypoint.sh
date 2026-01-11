#!/bin/bash

# =============================================================================
# Claude CLI Configuration for Coldstart IDE
# =============================================================================
# This script configures Claude CLI to use the platform-provided ANTHROPIC_API_KEY
# so users don't need to authenticate with their own Anthropic account.
# =============================================================================

# Clear any cached OAuth credentials to prevent auth conflicts
# This ensures only the ANTHROPIC_API_KEY env var is used
rm -rf /home/coder/.claude 2>/dev/null || true

# Create Claude CLI config directory
mkdir -p /home/coder/.claude

# Create settings.json to configure Claude CLI
# The env section ensures ANTHROPIC_API_KEY is explicitly used
cat > /home/coder/.claude/settings.json << 'EOF'
{
  "env": {
    "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
  },
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)"
    ]
  }
}
EOF

# Substitute the actual API key value into settings.json
if [ -n "$ANTHROPIC_API_KEY" ]; then
    sed -i "s|\${ANTHROPIC_API_KEY}|$ANTHROPIC_API_KEY|g" /home/coder/.claude/settings.json
fi

# Start code-server
exec code-server --bind-addr 0.0.0.0:8080 --auth none /workspace
