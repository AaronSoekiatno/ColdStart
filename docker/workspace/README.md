# Build a Real-Time Notification Bell 🔔

**Time Limit:** 20 Minutes | **Score:** 100 Points

## Your Mission

Build a **real-time notification system** that:
- Shows a bell icon with an unread count badge
- Displays notifications in a dropdown when clicked
- Updates instantly when new notifications arrive (no page refresh needed)
- Allows users to mark notifications as read
- Works across multiple browser tabs

**Tech Stack:** Next.js 15, React, Supabase Realtime, TypeScript

---

## What We're Testing

This assessment measures **how effectively you use AI tools** to ship production-quality features:

1. **Speed** - Can you implement features quickly with AI assistance?
2. **Verification** - Can you catch mistakes in AI-generated code?
3. **Quality** - Does your code actually work and handle edge cases?

**AI tools are encouraged!** Use Claude Code, Copilot, ChatGPT, or whatever helps you move faster.

---

## Getting Started

### 1. Read the Instructions (2 min)
Open `ASSESSMENT_V2_UNIFIED.md` for complete requirements and implementation guide.

### 2. Implement the TODOs (15 min)
You'll find TODO comments in **6 files**:

**Backend (40 points):**
- `lib/notifications.service.ts` - Database queries
- `app/api/notifications/route.ts` - GET endpoint
- `app/api/notifications/[id]/mark-read/route.ts` - POST endpoint

**Frontend (40 points):**
- `hooks/use-notifications.ts` - State management + real-time
- `components/notifications/notification-bell.tsx` - Bell icon + badge
- `components/notifications/notification-dropdown.tsx` - Dropdown list

**Real-time Integration (20 points):**
- WebSocket subscriptions already scaffolded - you just implement the handlers

### 3. Test Your Code (3 min)
```bash
npm test
```

Tests will show you exactly what's working and what needs fixing.

---

## Success Criteria

**Minimum Passing (60/100):**
- Backend API returns notifications ✓
- Frontend displays the list ✓
- Mark as read works ✓

**Good Implementation (80/100):**
- All backend tests pass ✓
- Most frontend tests pass ✓
- Real-time updates work ✓

**Excellent Implementation (90-100/100):**
- All tests pass ✓
- No security issues ✓
- No memory leaks ✓
- Clean, readable code ✓

---

## Important Notes

### About AI Tools
- ✅ **Allowed:** Claude Code, GitHub Copilot, ChatGPT
- ✅ **Encouraged:** Use them to move faster
- ⚠️ **But:** You must verify the output is correct and secure

### About Tests
- **Run early and often:** `npm test`
- **Tests will fail initially** - that's expected!
- **Fix one test at a time** - don't try to fix everything at once

### About Time
- **20 minutes is tight** - don't overthink it
- **Ship something working** > perfect code
- **Tests tell you when you're done** - once they pass, you're good

---

## Quick Tips

**Use AI effectively:**
1. Read the TODO comments first
2. Ask AI to implement specific functions
3. Review generated code for security issues
4. Run tests to verify
5. Fix any failures

**Common pitfalls:**
- Using wrong Supabase keys (security trap 🪤)
- Forgetting to unsubscribe from real-time channels (memory leak 🪤)
- Not handling edge cases (unmounted components, race conditions)

---

## Ready?

Start by opening `ASSESSMENT_V2_UNIFIED.md` for the full requirements.

Then dive into the TODO comments and start shipping!

Good luck! 🚀