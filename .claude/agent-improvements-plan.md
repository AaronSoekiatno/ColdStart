# Agent Improvements Implementation Plan

## Overview
Enhance the coding agent to be closer to Claude Code's capabilities by implementing better tools, context management, error recovery, and test integration.

---

## 1. Better Tool Implementations

### 1.1 Add `edit_file` Tool
**Goal**: Allow surgical edits to specific line ranges instead of rewriting entire files.

**Implementation**:
- Add new tool definition in `lib/claude/tools.ts`
- Create `editWorkspaceFile()` function in `lib/workspace/file-access.ts`
- Use `sed` or similar to replace line ranges via SSH
- Return diff of changes made

**Files to modify**:
- `lib/claude/tools.ts` - Add `EDIT_FILE_TOOL` definition
- `lib/workspace/file-access.ts` - Add `editWorkspaceFile()` function
- `app/api/agent/chat-v2/route.ts` - Add tool execution case

**Benefits**:
- Faster edits (don't need to read/write entire files)
- Less error-prone (smaller change surface)
- Better diffs for user review

---

## 3. Better Context Management

### 3.1 Implement Prompt Caching
**Goal**: Cache frequently accessed files to reduce latency and cost.

**Implementation**:
- Use Anthropic's prompt caching feature
- Mark system prompt and common files as cacheable
- Cache file contents that are read multiple times in a session

**Files to modify**:
- `lib/claude/client.ts` - Add cache control headers
- `app/api/agent/chat-v2/route.ts` - Track which files have been read, mark for caching

**Cache Strategy**:
```typescript
// Mark system prompt as cacheable
{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }

// Mark frequently read files as cacheable
{ type: "text", text: fileContent, cache_control: { type: "ephemeral" } }
```

### 3.2 Smart Line Range Reading
**Goal**: Only read relevant portions of large files.

**Implementation**:
- Enhance `read_file` tool description to encourage line ranges
- Add file size checks - if file > 500 lines, suggest using line ranges
- Provide file outline/summary before full read

**Files to modify**:
- `lib/claude/tools.ts` - Update `READ_FILE_TOOL` description
- `lib/workspace/file-access.ts` - Add `getFileOutline()` helper

### 3.3 Conversation Summarization
**Goal**: Prevent conversation history from growing unbounded.

**Implementation**:
- After N turns (e.g., 10), summarize old messages
- Keep recent messages in full detail
- Store summaries in a compressed format

**Files to modify**:
- `app/api/agent/chat-v2/route.ts` - Add summarization logic
- Consider adding a `summarize_conversation` helper function

---

## 4. Improved System Prompt

### 4.1 Enhanced Coding Guidelines
**Goal**: Give agent better instructions for code changes.

**New prompt should include**:
- Prefer `edit_file` over `write_file` when possible
- Always read files before editing them
- Run tests after making changes
- Explain changes before making them (use thinking)
- Make incremental, testable changes
- Validate syntax before writing
- Use line ranges when reading large files

**Files to modify**:
- `lib/claude/tools.ts` - Rewrite `CODING_ASSISTANT_SYSTEM_PROMPT`

**Example additions**:
```
When making code changes:
1. Read the relevant files first to understand context
2. Use edit_file for small changes, write_file only for new files or complete rewrites
3. After editing code files, run relevant tests to verify your changes
4. If tests fail, analyze the error and fix iteratively
5. Explain your reasoning before making complex changes
```

---

## 5. Better Error Recovery

### 5.1 Automatic Retry Logic
**Goal**: Retry failed tool calls with exponential backoff.

**Implementation**:
- Wrap tool execution in try-catch with retry logic
- Max 3 retries per tool call
- Exponential backoff: 1s, 2s, 4s
- Log retry attempts

**Files to modify**:
- `app/api/agent/chat-v2/route.ts` - Add retry wrapper around tool execution

**Code structure**:
```typescript
async function executeToolWithRetry(toolName, input, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await executeTool(toolName, input);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

### 5.2 Syntax Validation Before Writing
**Goal**: Validate code syntax before writing files to prevent breaking changes.

**Implementation**:
- For `.ts`, `.tsx`, `.js`, `.jsx` files, run TypeScript compiler check
- For `.json` files, validate JSON syntax
- Return validation errors to agent before writing

**Files to modify**:
- `lib/workspace/file-access.ts` - Add `validateSyntax()` helper
- Call validation in `writeWorkspaceFile()` before executing write

**Validation approach**:
```typescript
// Write to temp file, run tsc --noEmit on it, check for errors
const tempPath = `/tmp/validate-${Date.now()}.ts`;
// If errors, return them to agent instead of writing
```

### 5.3 Automatic Rollback on Errors
**Goal**: If a change breaks tests, automatically revert it.

**Implementation**:
- After writing a file, optionally run tests
- If tests fail, offer to revert the change
- Keep a history of the last N file states

**Files to modify**:
- `app/api/agent/chat-v2/route.ts` - Add rollback logic
- Integrate with existing undo functionality

---

## 7. Better Test Integration

### 7.1 Structured Test Output Parser
**Goal**: Parse test output into structured format for easier analysis.

**Implementation**:
- Create test output parser for common frameworks (Vitest, Jest)
- Extract: test name, file, line, expected vs actual, stack trace
- Return structured JSON instead of raw text

**Files to create**:
- `lib/testing/test-parser.ts` - Parse test output

**Parser output format**:
```typescript
interface TestResult {
  status: 'passed' | 'failed' | 'error';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  failures: Array<{
    testName: string;
    file: string;
    line?: number;
    error: string;
    expected?: string;
    received?: string;
    stackTrace?: string;
  }>;
}
```

### 7.2 Auto-run Tests After File Changes
**Goal**: Automatically run relevant tests when files are modified.

**Implementation**:
- After `write_file` or `edit_file`, detect if it's a code file
- Find related test files (e.g., `Button.tsx` → `Button.test.tsx`)
- Auto-run those tests and return results
- Make this configurable (can be disabled)

**Files to modify**:
- `lib/workspace/file-access.ts` - Add post-write hook
- `lib/testing/test-runner.ts` - New file for test execution logic

**Logic**:
```typescript
async function writeWorkspaceFile(flyAppName, options) {
  // ... existing write logic ...
  
  // Auto-run tests if enabled
  if (shouldAutoTest(options.path)) {
    const testFile = findRelatedTestFile(options.path);
    if (testFile) {
      const results = await runTests(flyAppName, testFile);
      return { writeResult, testResults: results };
    }
  }
}
```

### 7.3 Add `run_tests` Tool
**Goal**: Dedicated tool for running tests with structured output.

**Implementation**:
- New tool that runs tests and returns parsed results
- Accepts file pattern or specific test file
- Returns structured `TestResult` object

**Files to modify**:
- `lib/claude/tools.ts` - Add `RUN_TESTS_TOOL`
- `lib/testing/test-runner.ts` - Implement test execution
- `app/api/agent/chat-v2/route.ts` - Add tool execution case

**Tool definition**:
```typescript
RUN_TESTS_TOOL: {
  name: 'run_tests',
  description: 'Run tests and get structured results. Use this after making code changes.',
  input_schema: {
    properties: {
      pattern: { 
        type: 'string', 
        description: 'Test file pattern (e.g., "Button.test.ts" or "**/*.test.ts")'
      }
    }
  }
}
```

### 7.4 Iterative Test Fixing
**Goal**: Agent can automatically retry fixes until tests pass.

**Implementation**:
- When tests fail, parse the errors
- Provide structured error info to agent
- Agent can iterate on fixes
- Stop after max iterations (e.g., 3) to prevent infinite loops

**Files to modify**:
- `app/api/agent/chat-v2/route.ts` - Add test-fix iteration logic

**Flow**:
```typescript
// After agent makes a change:
1. Run tests automatically
2. If failed, send structured errors back to agent
3. Agent analyzes errors and proposes fix
4. Repeat up to 3 times
5. If still failing, report to user
```

---

## Implementation Order

1. **Phase 1: Core Tools** (Highest Impact)
   - Add `edit_file` tool (#1.1)
   - Improve system prompt (#4.1)
   - Add retry logic (#5.1)

2. **Phase 2: Testing** (High Value)
   - Create test parser (#7.1)
   - Add `run_tests` tool (#7.3)
   - Auto-run tests after changes (#7.2)

3. **Phase 3: Context & Performance**
   - Implement prompt caching (#3.1)
   - Add syntax validation (#5.2)
   - Smart line range reading (#3.2)

4. **Phase 4: Advanced Features**
   - Conversation summarization (#3.3)
   - Automatic rollback (#5.3)
   - Iterative test fixing (#7.4)

---

## Success Metrics

- **Fewer full file rewrites**: Agent uses `edit_file` > 70% of the time
- **Faster responses**: Prompt caching reduces latency by 30-50%
- **Higher success rate**: Syntax validation prevents 90% of breaking changes
- **Better test coverage**: Auto-run tests catch regressions immediately
- **Reduced iterations**: Agent fixes issues in fewer turns due to structured test output

---

## Notes

- All SSH commands should continue to use the existing `flyctl ssh console` pattern
- Maintain backward compatibility with existing agent conversations
- Add feature flags for new capabilities (can be toggled on/off)
- Update UI to show new tool activities (edit_file, run_tests)
