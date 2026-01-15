# Claude Agent Chat Interface Integration

## Overview

You **don't** need to use Claude in the terminal! This guide shows how to integrate the Claude wrapper into a beautiful chat interface.

## Architecture Comparison

### Current (Terminal-based)
```
Candidate Terminal → claude-code wrapper → Claude API
```

### New (Chat Interface)
```
Browser Chat UI → API Endpoint → Docker/Fly exec → claude-code wrapper → Claude API
```

## ✅ Advantages of Chat Interface

| Feature | Terminal | Chat Interface |
|---------|----------|----------------|
| **User Experience** | Basic CLI | Modern, beautiful UI ✨ |
| **Message History** | Lost on terminal clear | Persistent in UI |
| **Multi-turn** | Manual re-typing | Automatic context |
| **Mobile-friendly** | ❌ No | ✅ Yes |
| **Streaming** | Character-by-character | Smooth, real-time |
| **Cost tracking** | Hidden | Visible per message |

## Implementation Options

### Option 1: HTTP + Streaming (Recommended)

**Files Created:**
- `app/api/agent/chat/route.ts` - API endpoint
- `components/agent/AgentChat.tsx` - Chat UI component

**How it works:**
1. User types message in chat UI
2. Frontend sends POST to `/api/agent/chat`
3. Backend executes `claude-code` in container via Fly.io API
4. Response streams back to frontend in real-time
5. UI updates as tokens arrive

**Pros:**
- ✅ Simple to implement
- ✅ Works with existing wrapper (no changes needed!)
- ✅ Streaming responses
- ✅ All rate limits and logging still work

**Cons:**
- HTTP overhead per message
- No bidirectional communication

### Option 2: WebSocket (More Complex)

For truly real-time bidirectional communication, you could:
1. Create a WebSocket server in the container
2. Frontend connects via WebSocket
3. Messages flow both ways without HTTP overhead

**When to use:**
- Need to support file uploads/downloads
- Want collaborative editing
- Multiple users in same session

### Option 3: Hybrid (Best of Both)

- Use HTTP for chat messages (simple, works great)
- Use WebSocket for file system events (optional)
- Keep terminal access for power users (both!)

## Usage Example

```tsx
// In your assessment page
import AgentChat from '@/components/agent/AgentChat';

export default function AssessmentPage({ sessionId }: { sessionId: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 h-screen">
      {/* Left: Code Editor */}
      <div className="border-r">
        <CodeEditor sessionId={sessionId} />
      </div>
      
      {/* Right: AI Agent Chat */}
      <div>
        <AgentChat 
          sessionId={sessionId} 
          containerReady={true} 
        />
      </div>
    </div>
  );
}
```

## API Integration

The API endpoint executes commands in the container:

```typescript
// POST /api/agent/chat
{
  "sessionId": "abc-123",
  "message": "Fix the authentication bug in auth.ts"
}

// Streams back:
data: Looking at auth.ts...
data: Found the issue in line 42
data: The token validation is missing...
```

## Container Execution

The wrapper still runs in the container, so:
- ✅ All file access works (Read/Write/Edit)
- ✅ Bash commands work
- ✅ Rate limits enforced
- ✅ Prompts logged to Supabase
- ✅ Scoped file access (no node_modules)
- ✅ Model selection (Haiku/Sonnet)

## Security Considerations

1. **Validate sessionId** - Ensure user owns the session
2. **Rate limiting** - API-level rate limiting on top of wrapper limits
3. **Input sanitization** - Escape quotes/special chars before exec
4. **Authentication** - Check user JWT before allowing access

## Cost Implications

**No change!** The wrapper is still used, so:
- Same rate limits (50 calls/session)
- Same token limits (5k input)
- Same model (Haiku by default)
- Same logging to Supabase

The only difference is the **interface** the user sees.

## Migration Path

You can support **both** simultaneously:

1. Keep terminal access for power users
2. Add chat interface for beginners
3. Track which interface is used more
4. Eventually deprecate one if needed

## Next Steps

1. **Test the API endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/agent/chat \
     -H "Content-Type: application/json" \
     -d '{"sessionId":"test","message":"Hello"}'
   ```

2. **Add to your assessment page:**
   ```tsx
   import AgentChat from '@/components/agent/AgentChat';
   // Add to your layout
   ```

3. **Monitor usage:**
   - Check prompt_logs table in Supabase
   - Track which interface candidates prefer
   - Monitor cost differences (if any)

## Customization

The chat UI is fully customizable:
- Change colors in `AgentChat.tsx`
- Add file upload support
- Show file diffs inline
- Display cost per message
- Add "undo" functionality

## Example Flows

### Debugging Flow
```
User: "Why is my login failing?"
Agent: [reads auth.ts, database.ts]
Agent: "The issue is in line 42..."
User: "Fix it"
Agent: [edits auth.ts]
Agent: "Fixed! Try logging in now."
```

### Code Generation Flow
```
User: "Create a user profile component"
Agent: [creates components/UserProfile.tsx]
Agent: "Created! Would you like me to add styling?"
User: "Yes, make it look modern"
Agent: [edits UserProfile.tsx with Tailwind]
```

---

## Summary

**Yes, you can integrate Claude into a chat interface easily!**

- ✅ No changes to the wrapper needed
- ✅ Same security and rate limits
- ✅ Same cost profile
- ✅ Better UX for candidates
- ✅ Can run both terminal + chat simultaneously
