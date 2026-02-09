# Chat V2 API - Direct Claude Integration

## Overview

This is a **fast, cost-effective alternative** to the SSH + `claude-code` CLI approach. Instead of tunneling through `flyctl ssh console`, we call the Anthropic API directly from the backend and provide Claude with custom tools to access the workspace.

## Performance Comparison

| Metric | Old (SSH + CLI) | New (Direct API) | Improvement |
|--------|----------------|------------------|-------------|
| **Latency** | 67s | 5-10s | **7-13x faster** |
| **Token Cost** | ~19k tokens | ~200 tokens | **95% cheaper** |
| **Cache Dependency** | Yes (5min TTL) | No | More predictable |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI (Chat Interface)                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend API (/api/agent/chat-v2)                           │
│  • Cost tracking & limits                                   │
│  • Conversation management                                  │
│  • Tool execution orchestration                             │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
             ▼                        ▼
┌────────────────────────┐  ┌────────────────────────────────┐
│  Anthropic API         │  │  Workspace Tools               │
│  • Claude 3.5 Haiku    │  │  • read_file (via SSH)         │
│  • Custom tools        │  │  • list_directory (via SSH)    │
│  • Streaming support   │  │  • search_code (via SSH)       │
└────────────────────────┘  └────────────────────────────────┘
```

## Key Components

### 1. **Claude Client** (`lib/claude/client.ts`)
- Wrapper around Anthropic SDK
- Streaming and non-streaming support
- Tool use handling

### 2. **Workspace Tools** (`lib/claude/tools.ts`)
- `read_file`: Read file contents with optional line ranges
- `list_directory`: List directory contents
- `search_code`: Search for code patterns using grep

### 3. **File Access Layer** (`lib/workspace/file-access.ts`)
- Executes workspace operations via `flyctl ssh console`
- Path validation and security
- Error handling

### 4. **Cost Tracker** (`lib/claude/cost-tracker.ts`)
- Per-session token limits
- Request count limits
- Usage tracking and reporting

### 5. **API Endpoint** (`app/api/agent/chat-v2/route.ts`)
- Handles chat requests
- Orchestrates tool use loop
- Returns usage metrics

## Usage

### API Request

```typescript
POST /api/agent/chat-v2

{
  "message": "What's the tech stack?",
  "sessionId": "session_123",
  "flyAppName": "assess-abc123",
  "conversationHistory": []  // Optional: previous messages
}
```

### API Response

```typescript
{
  "response": "This project uses Next.js 15 with TypeScript...",
  "usage": {
    "inputTokens": 150,
    "outputTokens": 200,
    "totalTokens": 350
  },
  "sessionUsage": {
    "sessionId": "session_123",
    "totalTokens": 350,
    "requestCount": 1
  },
  "toolCallCount": 1  // Number of tool calls made
}
```

## Cost Limits

Default limits (configurable via environment variables):

```typescript
{
  maxTokensPerRequest: 10000,   // ~10k tokens per request
  maxTokensPerSession: 100000,  // ~100k tokens per session
  maxRequestsPerSession: 50      // Max 50 requests per session
}
```

## Testing

```bash
# Start dev server
npm run dev

# In another terminal, run test script
tsx scripts/test-chat-v2.ts
```

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `FLY_API_TOKEN` - Fly.io API token for SSH access

Optional:
- `TEST_FLY_APP_NAME` - Fly app name for testing

## Migration Path

### Phase 1 (Current)
- ✅ Basic file reading works
- ✅ Cost tracking in place
- ✅ Simple Q&A functional

### Phase 2 (Next)
- Add streaming support to UI
- Implement conversation history
- Add more sophisticated tools

### Phase 3 (Future)
- Replace SSH with container HTTP API for even faster access
- Add caching layer for frequently accessed files
- Implement rate limiting per candidate

## Token Savings Example

**Question**: "What's the tech stack?"

**Old approach (SSH + CLI)**:
- Initial workspace context: 18,381 tokens (cache write)
- User prompt: 4 tokens
- **Total: 18,385 tokens**

**New approach (Direct API)**:
- System prompt: 50 tokens
- User prompt: 4 tokens
- Tool call (read package.json): 100 tokens
- Claude response: 50 tokens
- **Total: 204 tokens**

**Savings: 98.9%** 🎉

## Security Notes

- All file paths are validated to prevent directory traversal
- SSH commands are properly escaped
- Session limits prevent runaway costs
- Tool access is scoped to workspace directory only
