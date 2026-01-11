#!/bin/bash

# Clear any cached Claude CLI OAuth credentials
# This ensures users always use the provided ANTHROPIC_API_KEY
# instead of their personal Anthropic Console login
if command -v claude &> /dev/null; then
    # Remove cached credentials directory to ensure clean state
    rm -rf /home/coder/.claude 2>/dev/null || true
fi

# Start code-server
exec code-server --bind-addr 0.0.0.0:8080 --auth none /workspace
