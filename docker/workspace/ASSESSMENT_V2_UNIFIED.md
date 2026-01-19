# Real-Time Notification System Assessment

**Time Limit**: 20 minutes
**Total Points**: 100
**AI Tools**: Allowed and encouraged (Claude Code, Copilot, ChatGPT, etc.)

---

## 🎯 What We're Testing

This assessment measures **how effectively you use AI tools** to ship production-quality features:

1. **Speed**: Can you implement features quickly with AI assistance?
2. **Verification**: Can you catch mistakes in AI-generated code?
3. **Quality**: Does your code actually work and handle edge cases?

---

## 📋 Your Task

Build a **real-time notification bell feature** that:

- Shows a bell icon with unread count badge
- Displays notifications in a dropdown when clicked
- Updates in real-time as new notifications arrive (no page refresh)
- Allows users to mark notifications as read
- Works across multiple browser tabs

**Architecture**:
- Backend: Next.js 15 API routes + Supabase
- Frontend: React components + hooks
- Real-time: Supabase Realtime (WebSocket)
- Data isolation: Schema-per-candidate

---

## 🗂️ Files to Implement

You'll modify **6 files** with TODO comments:

### Backend (3 files)
```
/lib/notifications.service.ts          - Database queries
/app/api/notifications/route.ts        - GET endpoint
/app/api/notifications/[id]/mark-read/route.ts - POST endpoint
```

### Frontend (3 files)
```
/hooks/use-notifications.ts            - State management + real-time
/components/notifications/notification-bell.tsx - Bell icon + badge
/components/notifications/notification-dropdown.tsx - Dropdown list
```

**Database schema already exists**: `notifications` table in your schema

---

## 📊 Scoring Rubric (100 Points)

### Backend Functionality (40 points)

| Criteria | Points | What We Test |
|----------|--------|--------------|
| GET /api/notifications works | 15 | Returns notifications from candidate's schema |
| Notifications sorted correctly | 5 | Ordered by created_at DESC |
| Unread count calculated | 10 | Correctly filters `read = false` |
| POST mark-as-read works | 10 | Updates database correctly |

**How we test**: Automated via `npm test tests/assessment/notifications-api.test.ts`

---

### Frontend Functionality (40 points)

| Criteria | Points | What We Test |
|----------|--------|--------------|
| Bell icon renders | 5 | Component mounts without errors |
| Badge shows unread count | 10 | Displays correct number from hook |
| Badge hides when count = 0 | 5 | Conditional rendering works |
| Dropdown renders notifications | 10 | Maps array to list items |
| Read/unread styling differs | 5 | CSS classes applied conditionally |
| Mark as read button works | 5 | Click handler calls API |

**How we test**: Automated via `npm test tests/assessment/notifications-components.test.tsx`

---

### Real-Time Integration (20 points)

| Criteria | Points | What We Test |
|----------|--------|--------------|
| New notifications appear instantly | 10 | Supabase Realtime INSERT event |
| Badge count updates reactively | 5 | State recalculates on change |
| Mark as read syncs everywhere | 5 | Optimistic update + backend confirm |

**How we test**: Automated via `npm test tests/assessment/notifications-integration.test.tsx`

---

## 🚀 Getting Started

### 1. Understand the Structure (2 min)

**Type definitions** (fully provided):
```typescript
// /lib/types/notification.ts
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}
```

**Database schema** (already migrated):
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) CHECK (type IN ('info', 'success', 'warning', 'error')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 2. Implement Backend (7 min)

#### Service Layer: `/lib/notifications.service.ts`

**What you need to do**:
```typescript
export async function getUserNotifications(schemaName: string) {
  // TODO: Create Supabase client for this schema
  // TODO: Query notifications table, order by created_at DESC
  // TODO: Calculate unread count
  // TODO: Return { notifications, unreadCount }
}

export async function markNotificationAsRead(schemaName: string, notificationId: string) {
  // TODO: Create Supabase client for this schema
  // TODO: UPDATE notifications SET read = true WHERE id = notificationId
  // TODO: Return { success: boolean }
}
```

**Security trap** 🪤: Don't use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for schema queries - you need service role key or proper schema configuration.

#### API Routes

Both routes follow the same pattern:
1. **Auth boilerplate** (fully provided) - Verify user, get schema name
2. **TODO**: Call service function
3. **TODO**: Return JSON response

---

### 3. Implement Frontend (10 min)

#### Hook: `/hooks/use-notifications.ts`

**What you need to do**:
```typescript
const fetchNotifications = async () => {
  // TODO: Call GET /api/notifications
  // TODO: Update state with response
};

const markAsRead = async (id: string) => {
  // TODO: Optimistically update UI (set read: true)
  // TODO: Call POST /api/notifications/:id/mark-read
  // TODO: Handle errors (revert on failure)
};

useEffect(() => {
  fetchNotifications();

  // TODO: Subscribe to Supabase Realtime
  const channel = supabase.channel('notifications')
    .on('postgres_changes', { event: 'INSERT', ... }, (payload) => {
      // TODO: Add new notification to state
    })
    .on('postgres_changes', { event: 'UPDATE', ... }, (payload) => {
      // TODO: Update notification in state
    })
    .subscribe();

  return () => {
    // TODO: Unsubscribe (prevent memory leaks 🪤)
  };
}, []);
```

#### Bell Component: `/components/notifications/notification-bell.tsx`

**What you need to do**:
```typescript
{/* TODO: Show badge if unreadCount > 0 */}
{/* Badge should display the count, positioned top-right, red background */}
```

#### Dropdown Component: `/components/notifications/notification-dropdown.tsx`

**What you need to do**:
```typescript
{/* TODO: Map notifications to list items */}
{/* Each item: title, message, timestamp, mark-as-read button (if unread) */}
{/* Different styling for read vs unread (opacity, font-weight) */}
```

---

### 4. Test & Verify (3 min)

```bash
# Run tests
npm test

# Check browser
# - Bell icon appears in header
# - Badge shows unread count
# - Click bell → dropdown opens
# - Click "mark as read" → badge updates
```

**Manual test** (if time):
1. Open Supabase dashboard
2. Insert notification: `INSERT INTO notifications (type, title, message) VALUES ('info', 'Test', 'Hello')`
3. Verify badge appears instantly (no refresh needed)

---

## 🪤 Common Traps (What AI Gets Wrong)

### Trap 1: Wrong Supabase Key
**AI will suggest**:
```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // 🪤 Wrong!
);
```

**Problem**: Anon key doesn't have permissions for schema-specific queries

**Fix**: Use proper schema configuration or service role key

---

### Trap 2: Memory Leak
**AI will forget**:
```typescript
useEffect(() => {
  const channel = supabase.channel('notifications').subscribe();

  // 🪤 Missing cleanup!
}, []);
```

**Problem**: Channel stays subscribed after component unmounts

**Fix**: `return () => channel.unsubscribe();`

---

### Trap 3: Race Condition
**AI might do**:
```typescript
const markAsRead = async (id: string) => {
  setNotifications(prev => ...); // Optimistic update
  await fetch('/api/notifications/mark-read');

  const response = await fetch('/api/notifications');
  const data = await response.json();
  setNotifications(data.notifications); // 🪤 Component might be unmounted!
};
```

**Problem**: setState after async operation on unmounted component

**Fix**: Add mount tracking or remove redundant refresh (rely on real-time subscription)

---

## 💡 Pro Tips

### Use AI Effectively

**Good workflow** ✅:
```
1. Read the TODO comments
2. Ask AI: "Implement getUserNotifications with Supabase schema isolation"
3. Review generated code for security issues
4. Run tests to verify
5. Fix any failures
```

**Bad workflow** ❌:
```
1. Ask AI: "Complete all TODOs"
2. Copy-paste without reading
3. Submit without testing
Result: Security bugs, memory leaks, failed tests
```

### Time Management

- **0-7 min**: Backend (service + API routes)
- **7-17 min**: Frontend (hook + components)
- **17-20 min**: Test & fix issues

**Don't gold-plate**: Get it working first, then improve if time allows.

---

## 📞 Resources

### Documentation
- **Supabase Realtime**: https://supabase.com/docs/guides/realtime
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **React Hooks**: https://react.dev/reference/react

### Type Definitions
All types are in `/lib/types/notification.ts` - read this first!

### Test Files
Check test files to see expected behavior:
- `tests/assessment/notifications-api.test.ts`
- `tests/assessment/notifications-components.test.tsx`
- `tests/assessment/notifications-integration.test.tsx`

---

## ✅ Success Criteria

### Minimum Passing (60/100)
- ✅ Backend API returns notifications
- ✅ Frontend displays list
- ✅ Mark as read works
- ⚠️  Real-time might not work

### Good Implementation (80/100)
- ✅ All backend tests pass
- ✅ Most frontend tests pass
- ✅ Real-time updates work
- ⚠️  Minor bugs or missing edge cases

### Excellent Implementation (90-100/100)
- ✅ All tests pass
- ✅ Real-time works perfectly
- ✅ No security issues
- ✅ No memory leaks
- ✅ Clean, readable code

---

## 🎯 What Success Looks Like

**After 20 minutes, you should have**:

1. **A working notification bell** in the top-right corner
2. **A badge showing unread count** (e.g., "3")
3. **A dropdown that opens** when you click the bell
4. **Notifications listed** with titles, messages, timestamps
5. **Mark as read buttons** that work when clicked
6. **Real-time updates** - new notifications appear without refresh
7. **All tests passing** - `npm test` shows 100%

**If you have this, you'll score 90-100 points.** 🎉

---

## 🚨 Important Notes

### About AI Tools
- ✅ **Allowed**: Claude Code, GitHub Copilot, ChatGPT
- ✅ **Encouraged**: Use them to move faster
- ⚠️ **But**: You must verify the output is correct and secure

### About Tests
- **Run early and often**: `npm test`
- **Tests will fail initially** - that's expected!
- **Fix one failing test at a time** - don't try to fix everything at once

### About Time
- **20 minutes is tight** - don't overthink it
- **Ship something working** > perfect code
- **Tests tell you when you're done** - once they pass, you're good

---

## 🎓 Final Thought

This isn't testing if you can code without AI.

**It's testing if you can use AI to ship features 10x faster while maintaining quality.**

That's the skill that matters in 2026.

Good luck! 🚀
