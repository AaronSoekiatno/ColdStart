# Real-Time Notification System - AI-Amplified Assessment

**Time Limit**: 20 minutes
**Total Points**: 100
**AI Tools**: Allowed and encouraged (Claude Code, Copilot, ChatGPT, etc.)

---

## 🎯 What We're Testing

This assessment measures **how effectively you use AI tools** to ship production-quality features:

1. **Speed**: Can you direct AI to implement features quickly?
2. **Verification**: Can you catch mistakes in AI-generated code?
3. **Judgment**: Can you make decisions AI can't make?
4. **Debugging**: Can you fix subtle bugs AI introduces?

---

## 📋 Phase 1: Implementation (10 min - 40 points)

### Your Task

Build a real-time notification bell feature:

**Requirements** (intentionally ambiguous):
- Show a bell icon with unread count
- Display notifications when clicked
- New notifications appear instantly (no refresh)
- Users can mark notifications as read
- Handle multiple browser tabs gracefully

**Constraints**:
- Use the existing Supabase setup
- Don't add new npm packages
- Must work with schema-per-candidate isolation
- Bell must be visible on all pages

**Success Criteria**:
- ✅ Tests pass: `npm test tests/assessment/`
- ✅ No console errors when running `npm run dev`
- ✅ Notifications appear in real-time (no polling)

### Files to Implement

**Backend** (implement service + API routes):
```
/lib/notifications.service.ts
/app/api/notifications/route.ts
/app/api/notifications/[id]/mark-read/route.ts
```

**Frontend** (implement hook + components):
```
/hooks/use-notifications.ts
/components/notifications/notification-bell.tsx
/components/notifications/notification-dropdown.tsx
```

**Database**:
```
Migration already exists: /supabase/migrations/060_create_notifications_table.sql
Schema: notifications(id, type, title, message, read, created_at)
```

### Intentional Traps 🪤

**Your AI will likely make these mistakes** - can you catch them?

1. **Security Issue**: AI might use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for admin operations
2. **Memory Leak**: AI might forget to unsubscribe from Realtime channels
3. **Race Condition**: AI might update state after component unmounts
4. **N+1 Queries**: AI might fetch notifications on every state change
5. **Type Safety**: AI might use `any` types or incorrect type assertions

**Scoring**:
- Feature works: 20 pts
- All tests pass: 10 pts
- No security issues: 5 pts
- No memory leaks: 5 pts

---

## 🤔 Phase 2: Product Decision (5 min - 30 points)

### Scenario

You've just completed the feature when your PM Slacks you:

> **PM**: "Hey! I just realized we need to handle notification **priority**. High priority notifications (type: 'error' or 'warning') should show a red dot even after they're read, so users don't miss critical alerts. Can you add this?"

### Your Task

**Choose ONE approach** and implement it:

#### Option A: Frontend-Only Solution
- Add visual indicator (red dot) in the dropdown
- No backend changes needed
- Quick to implement (~3 min)
- ⚠️ But: Not persistent across devices

#### Option B: Backend Schema Change
- Add `priority` enum column to database
- Migrate existing data (`error`/`warning` = high)
- Update service layer + types
- ⚠️ But: Requires migration, more complex (~10 min)

#### Option C: Computed Property
- Calculate priority from `type` field at runtime
- No schema change needed
- Works across devices
- ⚠️ But: Couples UI logic to backend types

### What We're Testing

**AI will suggest Option B** (most "correct" solution). But you only have 5 minutes.

**Humans know**: Ship Option A now, refactor later.

**Scoring**:
- Chose pragmatic solution: 15 pts
- Implemented it correctly: 10 pts
- Explained trade-offs: 5 pts (in comments)

**Write your decision in comments**:
```typescript
/**
 * DECISION: Chose Option [A/B/C]
 *
 * WHY: [Explain reasoning in 1-2 sentences]
 *
 * TRADE-OFFS: [What did you sacrifice?]
 *
 * NEXT STEPS: [What would you do with more time?]
 */
```

---

## 🐛 Phase 3: Debug AI's Mistake (5 min - 30 points)

### Scenario

Your AI-generated code passes tests but QA reports:

> **Bug Report**: "Sometimes clicking 'mark as read' doesn't update the badge count. Happens randomly, maybe 1 in 10 clicks. Console shows: `Warning: Can't perform a React state update on an unmounted component.`"

### The Bug (Hidden in Your Code)

**AI likely generated something like**:
```typescript
const markAsRead = async (id: string) => {
  // Optimistic update
  setNotifications(prev =>
    prev.map(n => n.id === id ? { ...n, read: true } : n)
  );

  // API call
  await fetch(`/api/notifications/${id}/mark-read`, { method: 'POST' });

  // Refresh from server to confirm
  const response = await fetch('/api/notifications');
  const data = await response.json();
  setNotifications(data.notifications); // 🪤 BUG: Component might be unmounted!
};
```

### Your Task

1. **Identify the bug** (write in comments what's wrong)
2. **Fix it properly** (not just removing the line)
3. **Add safeguards** (prevent it from happening again)

**Hints for what good solutions look like**:
- Use `useRef` to track mount status
- Use cleanup functions in `useEffect`
- Use AbortController for fetch cancellation

**Scoring**:
- Identified the bug: 10 pts
- Fixed it correctly: 15 pts
- Added proper safeguards: 5 pts

---

## 🎯 Scoring Rubric

### Phase 1: Implementation (40 pts)
| Criteria | Points | How to Check |
|----------|--------|--------------|
| Feature functional | 20 | Manual testing in browser |
| Tests pass | 10 | `npm test tests/assessment/` |
| No security issues | 5 | Check for proper key usage |
| No memory leaks | 5 | Check cleanup in useEffect |

### Phase 2: Product Decision (30 pts)
| Criteria | Points | What We Look For |
|----------|--------|------------------|
| Pragmatic choice | 15 | Did they timebox correctly? |
| Correct implementation | 10 | Does the chosen solution work? |
| Trade-off analysis | 5 | Do they understand what they sacrificed? |

### Phase 3: Debugging (30 pts)
| Criteria | Points | What We Look For |
|----------|--------|------------------|
| Bug identification | 10 | Explained in comments |
| Correct fix | 15 | Actually solves the problem |
| Prevention measures | 5 | Added safeguards |

---

## 📊 How This Tests "Human + AI" Skills

### What AI Alone Would Score: ~60/100

**AI would get**:
- ✅ Phase 1 implementation (mostly correct): 30/40
- ❌ Phase 2 decision (wrong approach): 5/30
- ❌ Phase 3 debugging (wouldn't recognize the pattern): 10/30

**Why AI fails**:
1. **No time context** - AI doesn't know you have 5 minutes
2. **No business context** - AI doesn't know this is a startup MVP
3. **No runtime intuition** - AI doesn't predict async edge cases
4. **No engineering taste** - AI defaults to "most correct" not "most practical"

### What Human + AI Should Score: ~85-95/100

**Good human + AI workflow**:
1. **Use AI for boilerplate** - Let Claude Code write the basic implementation
2. **Review for traps** - Manually check for security, memory leaks
3. **Make judgment call** - Override AI's Phase 2 suggestion
4. **Debug with understanding** - Use AI to suggest fixes, but verify the root cause

---

## 🚀 Getting Started

### Setup (Don't count against time)
```bash
npm install
npm run dev
```

### Start Timer (20 minutes)
```bash
# Phase 1: Implement feature (10 min)
# Phase 2: Handle requirement change (5 min)
# Phase 3: Debug the race condition (5 min)
```

### Verification
```bash
# Run tests
npm test tests/assessment/

# Check for errors
npm run dev
# Open http://localhost:3000
# Check browser console for errors
```

---

## 💡 Pro Tips

### For Phase 1
- **Do**: Use AI to generate skeleton code quickly
- **Do**: Manually review for security issues
- **Don't**: Trust AI's first output - verify tests pass

### For Phase 2
- **Do**: Read the constraints (time, resources)
- **Do**: Think "what can I ship RIGHT NOW?"
- **Don't**: Let AI over-engineer the solution

### For Phase 3
- **Do**: Understand WHY the bug happens
- **Do**: Fix the root cause, not symptoms
- **Don't**: Just remove the problematic line

---

## 🎓 What Success Looks Like

### 🏆 Excellent (90-100 pts)
- Used AI to move fast but verified output
- Made pragmatic product decision
- Debugged async issue with understanding
- Added comments explaining trade-offs

### ✅ Good (75-89 pts)
- Got feature working with AI help
- Reasonable decision on Phase 2
- Fixed the bug (maybe not perfectly)
- Tests mostly pass

### ⚠️ Needs Improvement (60-74 pts)
- Feature works but has issues
- Wrong approach on Phase 2
- Didn't find/fix the bug
- Some tests fail

### ❌ Not Ready (< 60 pts)
- Couldn't complete basic implementation
- No judgment on product decisions
- Didn't attempt debugging
- Most tests fail

---

## 🤖 Using AI Tools Effectively

### Good AI Usage ✅
```
You: "Implement getUserNotifications that queries Supabase with
schema isolation. Schema name is passed as parameter. Return
notifications ordered by created_at DESC and include unread count."

AI: [Generates code]

You: "Check this for security issues - am I using the right Supabase key?"

AI: [Reviews and catches ANON_KEY in admin operation]

You: "Fix that using service role key for admin operations"
```

### Bad AI Usage ❌
```
You: "Complete all TODOs"

AI: [Generates everything]

You: [Copies without reading]

Result: Security bug, memory leak, tests fail
```

---

## 📞 Getting Help

**During the assessment**:
- ✅ You CAN use AI tools (Claude Code, Copilot, ChatGPT)
- ✅ You CAN reference documentation (Next.js, Supabase, React)
- ✅ You CAN use Google/Stack Overflow
- ❌ You CANNOT ask humans for help
- ❌ You CANNOT extend the time limit

**The goal**: See how you work in real conditions (with AI, docs, search)

---

## 🎯 Final Note

**This assessment doesn't test if you can code without AI.**

**It tests if you can ship production features FASTER with AI while maintaining quality.**

That's the skill that matters in 2026.

Good luck! 🚀