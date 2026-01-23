---
description: Migrate from OpenVSCode Server to Monaco Editor
---

# 🔄 Migration Plan: OpenVSCode Server → Monaco Editor

## 📋 Overview

**Goal**: Replace the OpenVSCode Server Docker-based IDE with a lightweight Monaco Editor directly embedded in the Next.js application.

**Current Stack**:
- OpenVSCode Server (full VS Code in Docker container on Fly.io)
- Docker containerization with ~30-40s provisioning time
- Full VS Code features (terminal, file explorer, extensions, etc.)
- Iframe-based embedding in Next.js

**Target Stack**:
- Monaco Editor (browser-native code editor)
- No Docker containers needed for IDE
- Direct React integration
- Server-side file system API for code persistence
- Optional: Separate Docker container ONLY for Next.js dev server (if needed)

**Benefits**:
- ⚡ Instant load time (no container provisioning)
- 💰 Reduced infrastructure costs (no Fly.io compute per user)
- 🎨 Better UI integration and customization
- 🔧 Easier to maintain and extend
- 🚀 Better performance (native browser API vs iframe)

---

## 🏗️ Architecture Changes

### Before (Current)
```
┌─────────────────────────────────────┐
│   Next.js App (Vercel/Fly)          │
│  ┌─────────────────────────────┐    │
│  │   /app/ide/page.tsx         │    │
│  │   (iframe wrapper)          │    │
│  │         │                   │    │
│  │         ▼                   │    │
│  │   ┌──────────────────────┐  │    │
│  │   │ Fly.io Container     │  │    │
│  │   │ OpenVSCode Server    │  │    │
│  │   │ /workspace (files)   │  │    │
│  │   │ Next.js dev server   │  │    │
│  │   └──────────────────────┘  │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### After (Target)
```
┌─────────────────────────────────────┐
│   Next.js App (Vercel/Fly)          │
│  ┌─────────────────────────────┐    │
│  │   /app/ide/page.tsx         │    │
│  │  ┌────────────────────────┐ │    │
│  │  │ Monaco Editor          │ │    │
│  │  │ (React component)      │ │    │
│  │  └────────────────────────┘ │    │
│  │           ▲                 │    │
│  │           │ WebSocket/HTTP  │    │
│  │           ▼                 │    │
│  │  ┌────────────────────────┐ │    │
│  │  │ File System API        │ │    │
│  │  │ /api/files/*           │ │    │
│  │  └────────────────────────┘ │    │
│  └─────────────────────────────┘    │
│                                     │
│  Optional (if needed):              │
│  ┌─────────────────────────────┐    │
│  │  Docker Container (per user) │    │
│  │  - Next.js dev server only   │    │
│  │  - No IDE needed             │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## 📦 What Needs to Be Preserved

### Core Features (Must Have)
- [x] Code editing with syntax highlighting
- [x] Multi-file editing (tabs)
- [x] File explorer/tree view
- [x] Terminal access (embedded xterm.js)
- [x] Auto-save functionality
- [x] Live preview of Next.js app
- [x] Test runner integration
- [x] Git integration (status, commit, diff)
- [x] Timer/session tracking
- [x] Submit assessment workflow

### IDE Features (Nice to Have)
- [ ] IntelliSense/autocomplete (TypeScript language server)
- [ ] Error/warning squiggles
- [ ] Find/replace across files
- [ ] Minimap
- [ ] Multiple themes
- [ ] Keyboard shortcuts

### Assessment Features (Critical)
- [x] Session management
- [x] Code snapshot creation
- [x] Test execution and scoring
- [x] AI assistant integration (Claude Code)
- [x] Tab switch detection
- [x] Time limits and auto-submit
- [x] Post-mortem survey

---

## 🛠️ Implementation Steps

### Phase 1: Research & Setup (2-3 hours)

**1.1 Install Monaco Editor**
```bash
cd /Users/aidannguyen/Downloads/Hermes
npm install @monaco-editor/react monaco-editor
npm install --save-dev @types/monaco-editor
```

**1.2 Install Supporting Libraries**
```bash
# Terminal emulator
npm install xterm xterm-addon-fit xterm-addon-web-links
npm install --save-dev @types/xterm

# File tree component
npm install react-arborist

# WebSocket for terminal/file sync
npm install ws
npm install --save-dev @types/ws
```

**1.3 Research Monaco Features**
- [ ] Review Monaco Editor API documentation
- [ ] Study TypeScript/React integration examples
- [ ] Explore language server protocol (LSP) integration
- [ ] Research file system handling patterns

---

### Phase 2: Core Editor Component (4-5 hours)

**2.1 Create Monaco Editor Component**

File: `/components/editor/MonacoEditor.tsx`

Key features:
- Load Monaco with TypeScript/JavaScript/CSS support
- Configure editor options (theme, font size, line numbers)
- Handle file content loading/saving
- Implement auto-save (debounced, matches current 300ms delay)
- Support multiple editor instances (tabs)

**2.2 Create File Tree Component**

File: `/components/editor/FileTree.tsx`

Key features:
- Display workspace file structure
- Support file/folder creation, deletion, rename
- Highlight active file
- Right-click context menu
- Drag & drop file organization

**2.3 Create Tab Manager**

File: `/components/editor/TabManager.tsx`

Key features:
- Display open files as tabs
- Close tabs (with unsaved changes warning)
- Switch between tabs
- Show dirty indicator (•) for unsaved files
- Reorder tabs via drag & drop

---

### Phase 3: Terminal Integration (3-4 hours)

**3.1 Create Terminal Component**

File: `/components/editor/Terminal.tsx`

Key features:
- Embed xterm.js terminal
- WebSocket connection to backend PTY (pseudo-terminal)
- Support multiple terminal instances (tabs)
- Resize handling
- Copy/paste support

**3.2 Backend Terminal API**

File: `/app/api/terminal/route.ts` (WebSocket handler)

Key features:
- Spawn PTY process (bash/zsh)
- Stream input/output via WebSocket
- Handle terminal resize events
- Session management (associate with candidate)
- Security: sandboxed execution, timeout limits

**Note**: This requires running code execution environment. Options:
- **Option A**: Keep Fly.io containers for execution only (no IDE)
- **Option B**: Use WebContainers (StackBlitz) for browser-based Node.js
- **Option C**: Use cloud code execution service (e.g., CodeSandbox Sandpack)

---

### Phase 4: File System API (4-5 hours)

**4.1 File CRUD Operations**

Files to create:
- `/app/api/files/read/route.ts` - Read file contents
- `/app/api/files/write/route.ts` - Write file contents
- `/app/api/files/list/route.ts` - List directory contents
- `/app/api/files/create/route.ts` - Create file/folder
- `/app/api/files/delete/route.ts` - Delete file/folder
- `/app/api/files/rename/route.ts` - Rename/move file

**4.2 Storage Strategy**

Options to consider:

**Option A: Database Storage (Recommended)**
- Store file contents in Supabase
- Schema: `workspace_files` table
  - `id` (uuid)
  - `session_id` (uuid, FK to interview_sessions)
  - `path` (text, e.g., "app/page.tsx")
  - `content` (text)
  - `created_at`, `updated_at`
- Pros: Easy to snapshot, backup, and query
- Cons: Not ideal for binary files

**Option B: Object Storage (Supabase Storage)**
- Store files as blobs in Supabase Storage
- Pros: Better for large files, binary support
- Cons: More complex file tree reconstruction

**Option C: Ephemeral Container (Hybrid)**
- Keep minimal Docker container for file persistence
- Access files via exec commands
- Pros: Real file system, easy terminal integration
- Cons: Still requires container infrastructure

**Recommendation**: Start with **Option A** for simplicity, migrate to **Option C** if execution environment is needed.

**4.3 Implement Git Integration**

File: `/app/api/git/[action]/route.ts`

Support basic Git operations:
- `git status` - Show changed files
- `git diff` - Show file changes
- `git add` - Stage files
- `git commit` - Commit changes
- `git log` - View commit history

Use `simple-git` npm package or execute shell commands.

---

### Phase 5: IDE Layout & UI (3-4 hours)

**5.1 Create Main IDE Layout**

File: `/app/ide/page.tsx` (refactor existing)

Layout structure:
```
┌─────────────────────────────────────────────────┐
│  Header (Timer, Submit, Test Runner, AI Chat)  │
├──────────┬──────────────────────┬───────────────┤
│          │  Tab Bar             │               │
│          ├──────────────────────┤   Preview     │
│  File    │                      │   Panel       │
│  Tree    │   Monaco Editor      │   (iframe)    │
│          │                      │               │
│          │                      │               │
├──────────┴──────────────────────┤               │
│         Terminal                │               │
└─────────────────────────────────┴───────────────┘
```

**5.2 Implement Resizable Panels**

Use `react-resizable-panels` library for:
- Adjustable sidebar width
- Resizable terminal height
- Collapsible preview panel

**5.3 Styling & Theme**

- Match current dark theme aesthetic
- Ensure responsive design
- Add loading states for file operations
- Implement keyboard shortcuts (Cmd+S save, Cmd+P file search, etc.)

---

### Phase 6: Code Execution Environment (5-6 hours)

**Decision Point**: How to run the Next.js dev server and tests?

**Option A: Keep Fly.io Containers (Recommended for MVP)**

Pros:
- Minimal changes to existing infrastructure
- Real Node.js environment
- Terminal access works out of the box
- Easy to run tests

Cons:
- Still requires container provisioning
- Not eliminating all Docker complexity

Changes needed:
- Remove OpenVSCode Server from Dockerfile
- Keep only: Node.js, file system, dev server
- Significantly lighter container (~100MB vs ~800MB)
- Faster provisioning (~5-10s vs ~30-40s)

**Option B: WebContainers (StackBlitz)**

Use `@webcontainer/api` to run Node.js in the browser:

Pros:
- No backend infrastructure needed
- Instant startup
- Works entirely in browser

Cons:
- Limited npm package support
- No native binaries
- Experimental technology
- Potential stability issues

**Option C: Cloud Execution Service**

Use CodeSandbox Sandpack or similar:

Pros:
- Managed infrastructure
- Fast provisioning
- Good developer experience

Cons:
- Third-party dependency
- Potential latency
- Pricing concerns

**Recommendation**: Start with **Option A** (lightweight Fly.io container), evaluate **Option B** as future optimization.

**6.1 Refactor Dockerfile** (if using Option A)

File: `/docker/Dockerfile.monaco`

Key changes:
- Remove OpenVSCode Server
- Keep Node.js and workspace setup
- Expose only port 3000 (Next.js dev server)
- Add simple HTTP API for file operations
- Add WebSocket endpoint for terminal

**6.2 File Sync Strategy**

- On save in Monaco → POST to `/api/files/write` → Update container file system
- On terminal command completion → Refresh file tree (detect new files)
- Use file watchers to detect external changes

---

### Phase 7: Feature Parity Testing (3-4 hours)

**7.1 Test Core Workflows**

Checklist:
- [ ] Load assessment environment
- [ ] Create new files
- [ ] Edit existing files
- [ ] Auto-save works correctly
- [ ] Terminal commands execute
- [ ] Next.js dev server runs
- [ ] Preview panel shows app
- [ ] Test runner executes tests
- [ ] Git operations work
- [ ] Submit assessment flow works
- [ ] Snapshots are created correctly

**7.2 Test Edge Cases**

- [ ] Large files (>1MB)
- [ ] Binary files (images)
- [ ] Rapid file switching
- [ ] Concurrent edits (multiple tabs)
- [ ] Network disconnection/reconnection
- [ ] Browser refresh (state persistence)

**7.3 Performance Testing**

- [ ] Measure initial load time (<2s target)
- [ ] Measure file save latency (<100ms target)
- [ ] Measure terminal responsiveness
- [ ] Measure memory usage (stay under 200MB)

---

### Phase 8: Migration & Cleanup (2-3 hours)

**8.1 Database Schema Updates**

Update `interview_sessions` table:
- Add `editor_type` column ('openvscode' | 'monaco')
- Keep `container_url` for backward compatibility
- Add `workspace_snapshot_url` for file backups

Create new table: `workspace_files`
```sql
CREATE TABLE workspace_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES interview_sessions(session_id),
  file_path TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, file_path)
);
```

**8.2 Update Snapshot Logic**

File: `/app/api/snapshots/create/route.ts`

Update to:
- Fetch all files from `workspace_files` table
- Create git commit in temporary repo
- Upload snapshot to Supabase Storage
- Store snapshot metadata

**8.3 Update Test Runner**

File: `/components/assessment/TestRunner.tsx`

Update to:
- Sync files to execution environment before running tests
- Handle environment differences (container vs WebContainer)
- Parse test results (no changes needed)

**8.4 Deprecate Old Code**

Move to `/docker/archive/`:
- `Dockerfile.assessment` → `Dockerfile.assessment.openvscode`
- `scripts/entrypoint-openvscode.sh` → (keep for reference)
- `config/settings.json` → (keep for reference)

Update `.gitignore` to exclude archived files from deployments.

---

### Phase 9: Polish & UX Improvements (2-3 hours)

**9.1 Add Loading States**

- Skeleton loaders for file tree
- Loading spinner for file operations
- Progress bar for test execution
- Smooth transitions between states

**9.2 Error Handling**

- Graceful file read/write errors
- Terminal connection errors
- Network timeout handling
- User-friendly error messages

**9.3 Keyboard Shortcuts**

Implement common shortcuts:
- `Cmd+S` / `Ctrl+S` - Save file (already auto-saves, but provide feedback)
- `Cmd+P` / `Ctrl+P` - Quick file search
- `Cmd+B` / `Ctrl+B` - Toggle sidebar
- `Cmd+J` / `Ctrl+J` - Toggle terminal
- `Cmd+\`` / `Ctrl+\`` - New terminal
- `Cmd+Shift+P` / `Ctrl+Shift+P` - Command palette (future)

**9.4 User Onboarding**

- Add tooltip hints on first visit
- Show keyboard shortcuts
- Highlight key features (AI Chat, Test Runner, Preview)

---

### Phase 10: Rollout & Monitoring (1-2 hours)

**10.1 Feature Flag**

Add environment variable:
```
NEXT_PUBLIC_USE_MONACO_EDITOR=true
```

Allow gradual rollout:
- Test with internal users first
- Monitor error rates and performance
- Collect user feedback

**10.2 Analytics**

Track key metrics:
- Editor load time
- File operation latency
- Terminal connection success rate
- Error rates by operation type
- User engagement (time in IDE)

**10.3 Monitoring**

Set up alerts for:
- High error rates (>5%)
- Slow file operations (>500ms p95)
- Terminal connection failures
- Memory leaks (increasing heap size)

---

## 📊 Estimated Timeline

| Phase | Task | Time Estimate |
|-------|------|---------------|
| 1 | Research & Setup | 2-3 hours |
| 2 | Core Editor Component | 4-5 hours |
| 3 | Terminal Integration | 3-4 hours |
| 4 | File System API | 4-5 hours |
| 5 | IDE Layout & UI | 3-4 hours |
| 6 | Code Execution Environment | 5-6 hours |
| 7 | Feature Parity Testing | 3-4 hours |
| 8 | Migration & Cleanup | 2-3 hours |
| 9 | Polish & UX Improvements | 2-3 hours |
| 10 | Rollout & Monitoring | 1-2 hours |
| **Total** | | **29-39 hours** (~1 week full-time) |

---

## 🚨 Risks & Mitigation

### Risk 1: Terminal Access Complexity
**Risk**: WebSocket terminal implementation is complex and error-prone.
**Mitigation**: Start with read-only terminal output, add input later. Use battle-tested `node-pty` library.

### Risk 2: File Sync Issues
**Risk**: Race conditions between editor saves and file system could cause data loss.
**Mitigation**: Implement optimistic locking, conflict detection, and auto-backup.

### Risk 3: Code Execution Security
**Risk**: Running user code could expose security vulnerabilities.
**Mitigation**: Keep sandboxed Docker containers, implement strict timeouts, resource limits.

### Risk 4: Performance Degradation
**Risk**: Monaco in browser could be slower than native VS Code.
**Mitigation**: Lazy-load files, use virtual scrolling for large files, implement debouncing.

### Risk 5: Feature Gap
**Risk**: Users miss advanced VS Code features (extensions, IntelliSense, etc.).
**Mitigation**: Document feature differences, prioritize most-used features, gather user feedback.

---

## 🎯 Success Criteria

- ✅ IDE loads in <2 seconds (vs 30-40s currently)
- ✅ All core editing features work (save, multi-file, syntax highlighting)
- ✅ Terminal is functional for basic commands
- ✅ File operations (create, delete, rename) work reliably
- ✅ Test runner integrates seamlessly
- ✅ Preview panel updates live
- ✅ No data loss or corruption
- ✅ Positive user feedback (>80% satisfaction)
- ✅ Infrastructure cost reduction (>50%)

---

## 📚 Resources & References

### Monaco Editor
- [Monaco Editor Docs](https://microsoft.github.io/monaco-editor/)
- [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)
- [Monaco Language Server Protocol](https://github.com/TypeFox/monaco-languageclient)

### Terminal
- [xterm.js](https://xtermjs.org/)
- [node-pty](https://github.com/microsoft/node-pty)

### File System
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [simple-git](https://github.com/steveukx/git-js)

### Code Execution
- [WebContainers](https://webcontainers.io/)
- [CodeSandbox Sandpack](https://sandpack.codesandbox.io/)
- [StackBlitz WebContainer API](https://developer.stackblitz.com/docs/platform/webcontainers/api)

### UI Components
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
- [react-arborist](https://github.com/brimdata/react-arborist)

---

## 🤔 Open Questions

1. **Should we keep Git integration in Phase 1, or defer to Phase 2?**
   - Current: Git is used for snapshots but not exposed to users
   - Recommendation: Defer user-facing Git UI, keep backend snapshot logic

2. **Do we need syntax error checking (linting) in the editor?**
   - Requires TypeScript Language Server (complex)
   - Alternative: Run linter on test execution only
   - Recommendation: Start without, add if users request it

3. **How to handle large monorepo workspaces (>1000 files)?**
   - Full file tree could be slow to render
   - Recommendation: Lazy-load folders, implement search, limit initial depth

4. **Should we support multiple users editing the same session?**
   - Currently, sessions are single-user
   - Collaborative editing requires WebSocket sync (complex)
   - Recommendation: Out of scope for v1

5. **What about mobile support?**
   - Monaco works on mobile but UX is poor
   - Recommendation: Desktop-only for now, mobile view shows read-only preview

---

## 📝 Next Steps

1. **Review this plan** with the team
2. **Decide on code execution strategy** (Option A, B, or C in Phase 6)
3. **Create GitHub project board** with tasks
4. **Set up development environment** (Phase 1)
5. **Start with Phase 2** (Core Editor Component)
6. **Iterate based on user feedback**

---

**Last Updated**: 2026-01-23  
**Owner**: Hermes Team  
**Status**: Planning  
**Priority**: High