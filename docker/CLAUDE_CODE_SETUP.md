# Claude Code Interactive Agent Setup

## Overview
The container now provides the **full production Claude Code interactive agent experience** while still capturing all prompts for auditing.

## Architecture

### 1. **Binary Wrapper** (Dockerfile)
- Backs up the real `claude` binary to `claude-real`
- Installs a lightweight wrapper that:
  - Routes to `/home/coder/.local/bin/claude-wrapper` if it exists
  - Otherwise falls back to `claude-real`

### 2. **Token Limit Wrapper** (entrypoint.sh)
- Created at runtime: `/home/coder/.local/bin/claude-wrapper`
- **Only enforces token limits** (max 5000 tokens)
- **Passes through all arguments** to `claude-real`
- Does NOT log prompts (that's the hook's job)
- Does NOT force headless mode

### 3. **Authentication Helper**
- Script: `/home/coder/.local/bin/get-claude-key`
- Provides `ANTHROPIC_API_KEY` from environment
- Configured in `/home/coder/.claude/config.json`
- Claude automatically uses this instead of asking for login

### 4. **Prompt Logging Hook** (log-prompt.sh)
- Installed at: `/home/coder/.claude/hooks/log-prompt.sh`
- Triggered by Claude Code's native hook system
- Captures prompts in **UserPromptSubmit** events
- Logs to Supabase `admin_audit.prompt_logs` table
- Also enforces token limits before submission

## User Experience

When a candidate runs `claude` in the terminal:

1. **Full Interactive Agent Mode**
   - Multi-turn conversations
   - Autonomous tool usage (bash, read, write files)
   - Context persistence across turns
   - All the production capabilities of Claude Code

2. **Transparent Logging**
   - Every prompt is logged via hooks
   - No performance impact on the agent
   - Candidate doesn't see any logging activity

3. **Seamless Authentication**
   - API key provided automatically via helper
   - No login prompts or OAuth flows
   - Just works™

## Execution Flow

```
User types: claude
     ↓
/usr/local/bin/claude (wrapper)
     ↓
/home/coder/.local/bin/claude-wrapper
     ├── Checks token limit (headless -p flag only)
     └── Passes through to claude-real
          ↓
/usr/local/bin/claude-real (actual Claude Code)
     ├── Reads API key via get-claude-key helper
     ├── Starts interactive agent session
     └── When user submits prompt:
          ├── Triggers UserPromptSubmit hook
          │    └── log-prompt.sh logs to Supabase
          └── Executes prompt with full agent capabilities
```

## Testing

To verify everything works:

```bash
# 1. Start the container
cd docker
./start-assessment.sh <candidate_id> <session_id>

# 2. Access the container
docker exec -it hermes-assessment-<candidate_id> bash

# 3. Run Claude Code
claude

# Expected: Interactive agent starts, no login prompts
# You can chat naturally and Claude can use tools
```

## Differences from Previous Implementation

| Feature | Before | After |
|---------|--------|-------|
| **Mode** | Forced headless (`-p` flag) | Full interactive agent |
| **Logging** | Wrapper logged before execution | Hooks log during runtime |
| **Tools** | Disabled in headless mode | Full tool autonomy |
| **Conversations** | Single-shot only | Multi-turn persistence |
| **User Experience** | CLI-style Q&A | Production agent |

## Environment Variables Required

- `ANTHROPIC_API_KEY`: The API key (passed from .env.local)
- `SUPABASE_URL`: For prompt logging
- `SUPABASE_SERVICE_KEY`: For authenticated logging
- `CANDIDATE_ID`: To tag prompt logs
- `CLAUDE_PROMPT_TOKEN_LIMIT`: (optional) Default 5000 tokens

## Logging Schema

Prompts are logged to `admin_audit.prompt_logs`:
```sql
{
  candidate_id: uuid,
  provider: "claude-cli",
  tool_name: "Claude Code CLI",
  session_id: text,
  cwd: text,
  permission_mode: text,
  prompt_text: text,
  prompt_text_preview: text (first 500 chars),
  created_at: timestamp
}
```
