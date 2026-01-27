# Build a Real-Time Notification System 🔔

**Time Limit:** 20 Minutes  
**Total Score:** 100 Points (Backend: 40 | Frontend: 40 | Integration: 20)

---

## 🎯 Your Mission

You're working on **InstaClone**, a social media application. Your task is to build a **real-time notification system** that updates instantly across all browser tabs.

### What You'll Build

The notification bell in the header currently shows a static badge with "3" notifications. Make it functional by implementing:

- ✅ **Notification Bell** - Icon with dynamic unread count badge
- ✅ **Notification Dropdown** - Shows list of all notifications when clicked
- ✅ **Real-time Updates** - Instantly updates when new notifications arrive (no refresh needed)
- ✅ **Mark as Read** - Click a notification to mark it as read and remove from unread count
- ✅ **Multi-tab Sync** - Changes sync across all open browser tabs in real-time

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase Realtime

---

## 🧪 What We're Testing

This assessment measures **how effectively you use AI tools** to ship production-quality features:

1. **Speed** - Can you implement features quickly with AI assistance?
2. **Verification** - Can you catch mistakes in AI-generated code?
3. **Quality** - Does your code handle edge cases and security concerns?

> **AI tools are ENCOURAGED!** Use Claude Code, GitHub Copilot, ChatGPT, or any tool that helps you move faster. We're testing your ability to verify and ship AI-generated code, not memorize syntax.

---

## 🚀 Getting Started

### Step 1: Understand the Application (2 min)

Open the application in your browser. You'll see:
- **InstaClone** - A modern social media interface with stories and a post feed.
- **Notification Bell** - Located in the top-right header (currently static with badge "3").
- **Your Goal** - Transform this static bell into a fully functional, real-time notification engine.

**Note:** Your database already contains 5 sample notifications (3 unread, 2 read) from users like `sarah_dev`, `john_code`, and `emma_ui`. You'll fetch and display these.

### Step 2: Implement the TODOs (15 min)

You'll find TODO comments in **7 files**. Complete them in this order:

#### **Backend (40 points)**

1. **`lib/notifications.service.ts`** - Database query functions
   - Fetch all notifications for a user
   - Fetch unread count (aggregation query)
   - Mark notification as read
   
2. **`app/api/notifications/route.ts`** - GET endpoint
   - Return all notifications as JSON
   - Handle errors gracefully
   
3. **`app/api/notifications/unread-count/route.ts`** - GET endpoint
   - Return count of unread notifications
   - Tests your aggregation query skills
   
4. **`app/api/notifications/[id]/mark-read/route.ts`** - POST endpoint
   - Mark a specific notification as `read`
   - Return the updated notification object


#### **Frontend (40 points)**

5. **`hooks/use-notifications.ts`** - State management + real-time
   - Fetch notifications on mount
   - Subscribe to real-time updates
   - Handle mark as read mutations
   - Clean up subscriptions on unmount
   
6. **`components/notifications/notification-bell.tsx`** - Bell icon + badge
   - Display unread count badge
   - Toggle dropdown on click
   
7. **`components/notifications/notification-dropdown.tsx`** - Dropdown UI
   - Display list of notifications
   - Handle click to mark as read
   - Show empty state when no notifications


#### **Real-time Integration (20 points)**

Real-time subscriptions are already scaffolded in `use-notifications.ts`. You just need to:
- Set up the Supabase Realtime channel subscription
- Handle `INSERT` events (new notifications)
- Handle `UPDATE` events (marked as read)
- Clean up the subscription on unmount

### Step 3: Test Your Implementation (3 min)

Run the automated test suite:

Tests check:
- ✅ Backend API returns correct data
- ✅ Frontend displays notifications
- ✅ Mark as read functionality works
- ✅ Real-time updates are received
- ✅ No security vulnerabilities
- ✅ No memory leaks

**The tests will guide you.** They'll tell you exactly what's working and what needs fixing.

---

## 📊 Success Criteria

### Minimum Passing (60/100)
- ✓ Backend API returns notifications
- ✓ Frontend displays notification list
- ✓ Mark as read functionality works

### Good Implementation (80/100)
- ✓ All backend tests pass
- ✓ Most frontend tests pass
- ✓ Real-time updates work

### Excellent Implementation (90-100/100)
- ✓ All tests pass
- ✓ No security issues (correct API keys, RLS policies)
- ✓ No memory leaks (proper cleanup)
- ✓ Clean, readable code

---

## 💡 Important Notes

### About AI Tools
- ✅ **Allowed:** Claude Code, GitHub Copilot, ChatGPT, Cursor, etc.
- ✅ **Encouraged:** Use them to move faster—we're testing your efficiency and judgment.
- ⚠️ **Critical:** You MUST verify AI output for security and logical correctness.

### About the Database
- ✅ **Already configured** - Supabase client is pre-authenticated
- ✅ **Schema ready** - `notifications` table already exists
- ✅ **Realtime enabled** - Just set up your subscription
- ❌ **No setup needed** - Don't create projects or run migrations

<details>
<summary>🔍 <strong>Want to know how it works?</strong> (optional reading)</summary>

#### Data Isolation: Schema-Per-Candidate

Each candidate receives a dedicated database schema (`sandbox_{id}`) to ensure zero data leaked between sessions:

- **Your Schema:** All your queries run in your isolated `sandbox_{id}` schema
- **Public Schema:** Shared read-only reference data (accessible to everyone)
- **Search Path:** Your connection is automatically "jailed" to your schema via `search_path`

#### Pre-Seeded Data

Your schema comes with **5 sample notifications** already populated (3 unread, 2 read):

```sql
-- Notification table structure
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT CHECK (type IN ('like', 'comment', 'follow', 'mention')),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Example notifications (pre-seeded)
-- 'sarah_dev liked your post "Building Real-Time Features"' (unread)
-- 'john_code commented: "Great work! How did you handle..."' (unread)
-- 'emma_ui started following you' (unread)
-- 'alex_full liked your post' (read)
-- 'lisa_pm commented on your post' (read)
```

#### Database Queries

When you query the `notifications` table, you're automatically querying `sandbox_{your_id}.notifications`:

```typescript
// This query is automatically scoped to YOUR schema
const { data } = await supabase.from('notifications').select('*');
// Runs: SELECT * FROM sandbox_{your_id}.notifications
```

#### Realtime Configuration

Supabase Realtime is already enabled on the `notifications` table. Just subscribe:

```typescript
const channel = supabase
  .channel('notifications')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public',  // Mapped to your sandbox schema via search_path
    table: 'notifications' 
  }, handleChange)
  .subscribe();
```

#### Security

- **Row Level Security (RLS):** Already configured - you can only see YOUR notifications
- **API Keys:** Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-side safe)
- **Service Role:** Never use `SUPABASE_SERVICE_ROLE_KEY` (tests will catch this!)

</details>

### About Tests
- **Run early and often** - `npm test`
- **Tests will fail initially** - That's expected!
- **Fix one test at a time** - Don't try to fix everything at once
- **Tests are your guide** - They tell you exactly what's missing

### About Time
- **20 minutes is tight** - Prioritize core functionality over pixel-perfection.
- **Ship working code** - Clean up and refactor only after the tests pass.
- **Tests are the truth** - Once `npm test` turns green, you are officially finished.

---

## 🎯 Implementation Checklist

Use this to track your progress:

### Backend
- [ ] Implement `getNotifications()` in `lib/notifications.service.ts`
- [ ] Implement `getUnreadCount()` in `lib/notifications.service.ts`
- [ ] Implement `markAsRead()` in `lib/notifications.service.ts`
- [ ] Complete GET endpoint in `app/api/notifications/route.ts`
- [ ] Complete GET endpoint in `app/api/notifications/unread-count/route.ts`
- [ ] Complete POST endpoint in `app/api/notifications/[id]/mark-read/route.ts`


### Frontend
- [ ] Fetch notifications in `hooks/use-notifications.ts`
- [ ] Set up real-time subscription in `hooks/use-notifications.ts`
- [ ] Handle mark as read in `hooks/use-notifications.ts`
- [ ] Display bell + badge in `components/notifications/notification-bell.tsx`
- [ ] Display dropdown list in `components/notifications/notification-dropdown.tsx`

### Testing
- [ ] Run `npm test`
- [ ] Fix any failing tests
- [ ] Verify real-time updates work across tabs

---

## ⚠️ Common Pitfalls

Watch out for these common mistakes:

### Security Traps 🛡️
- **Wrong API Keys** - Use `NEXT_PUBLIC_SUPABASE_ANON_KEY`, NOT `SUPABASE_SERVICE_ROLE_KEY`
- **Missing RLS** - Database should have Row Level Security enabled (already done)
- **Exposing Secrets** - Never log or return sensitive data

### Memory Leaks 🧹
- **Forgotten Cleanup** - Always unsubscribe from Realtime channels in useEffect cleanup
- **Dangling Subscriptions** - Use `channel.unsubscribe()` when component unmounts

### Edge Cases 🧪
- **Empty States** - Handle when there are no notifications
- **Loading States** - Show loading indicators while fetching
- **Error States** - Handle network errors gracefully

---

## 🏁 Ready to Start?

1. **Read the TODOs** - Open each file and read the TODO comments
2. **Start with Backend** - Service layer first, then API routes
3. **Move to Frontend** - Hook first, then components
4. **Test Frequently** - Run `npm test` after completing each section
5. **Iterate** - Fix failures one at a time

**The clock is ticking. Good luck! 🚀**

---

## 📚 Quick Reference

### Useful Commands
```bash
# Run tests
npm test

# Start dev server (already running)
npm run dev

# Type check
npm run type-check
```

### File Locations
```
lib/notifications.service.ts                          # Database queries
app/api/notifications/route.ts                        # GET all notifications
app/api/notifications/unread-count/route.ts          # GET unread count
app/api/notifications/[id]/mark-read/route.ts        # POST mark as read
hooks/use-notifications.ts                            # React hook
components/notifications/notification-bell.tsx        # Bell UI
components/notifications/notification-dropdown.tsx    # Dropdown UI
```


### Key Technologies
- **Next.js 15** - Optimized App Router environment
- **Supabase** - PostgreSQL + Realtime Engine
- **TypeScript** - Strict type-safety enabled
- **Vitest** - High-speed testing framework
