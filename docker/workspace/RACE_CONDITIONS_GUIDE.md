# Race Condition Traps - V2 Assessment

## Overview

The V2 assessment includes **7 intentional race condition traps** designed to test if candidates understand async patterns, real-time event handling, and React lifecycle management.

**Philosophy**: These aren't "gotcha" questions - they're realistic bugs that happen in production when using AI-generated code without understanding the implications.

---

## 🪤 TRAP 1: setState on Unmounted Component (fetchNotifications)

### Location
`hooks/use-notifications.ts` - Line 38-51

### The Trap
```typescript
const fetchNotifications = useCallback(async () => {
  setLoading(true);

  const response = await fetch('/api/notifications');
  const data = await response.json();

  // TODO: Update state with fetched data
  // setNotifications(data.notifications);
  // setUnreadCount(data.unreadCount);
  // setLoading(false); // 🪤 Component might be unmounted!
}, []);
```

### The Problem
If the component unmounts while the fetch is in progress:
1. User navigates away from page
2. Fetch completes
3. `setNotifications()` called on unmounted component
4. React warning: "Can't perform a React state update on an unmounted component"

### The Solution
Use a mounted ref:
```typescript
const mountedRef = useRef(true);

useEffect(() => {
  return () => { mountedRef.current = false; };
}, []);

const fetchNotifications = useCallback(async () => {
  setLoading(true);
  const response = await fetch('/api/notifications');
  const data = await response.json();

  if (mountedRef.current) {
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }

  if (mountedRef.current) {
    setLoading(false);
  }
}, []);
```

**Or** use `AbortController`:
```typescript
const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
  const response = await fetch('/api/notifications', { signal });
  // Will throw if aborted
}, []);

useEffect(() => {
  const controller = new AbortController();
  fetchNotifications(controller.signal);
  return () => controller.abort();
}, []);
```

---

## 🪤 TRAP 2: Unnecessary Refresh Causes Race Condition (markAsRead)

### Location
`hooks/use-notifications.ts` - Line 61-85

### The Trap
```typescript
const markAsRead = useCallback(async (id: string) => {
  // Step 1: Optimistic update
  setNotifications(prev =>
    prev.map(n => (n.id === id ? { ...n, read: true } : n))
  );

  // Step 2: Call API
  await fetch(`/api/notifications/${id}/mark-read`, { method: 'POST' });

  // Step 3: TODO: Refresh to confirm?
  // const response = await fetch('/api/notifications');
  // const data = await response.json();
  // setNotifications(data.notifications); // 🪤 Race condition!
}, []);
```

### The Problem
If candidate implements the "refresh to confirm" step:

**Timeline:**
```
T0: User clicks "mark as read"
T1: Optimistic update (setState #1) → read: true
T2: API call completes → database UPDATE
T3: Real-time UPDATE event fires (setState #2) → read: true
T4: Refresh fetch completes (setState #3) → overwrites everything
```

**Issues:**
- 3 setState calls for 1 user action
- Refresh might return stale data (before database commit)
- Real-time event might arrive after refresh, causing flicker
- Component might unmount between T2 and T4

### The Solution
**Don't refresh!** The real-time subscription will handle it:
```typescript
const markAsRead = useCallback(async (id: string) => {
  // Optimistic update
  setNotifications(prev =>
    prev.map(n => (n.id === id ? { ...n, read: true } : n))
  );

  // Call API (database will update, real-time event will confirm)
  try {
    await fetch(`/api/notifications/${id}/mark-read`, { method: 'POST' });
  } catch (error) {
    // Revert optimistic update on error
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: false } : n))
    );
  }
}, []);
```

---

## 🪤 TRAP 3: Duplicate Notifications

### Location
`hooks/use-notifications.ts` - Line 97-99

### The Trap
```typescript
.on('postgres_changes', { event: 'INSERT', ... }, (payload) => {
  // TODO: Add payload.new to notifications state
  setNotifications(prev => [payload.new, ...prev]); // 🪤 Duplicate?
})
```

### The Problem
**Scenario:**
1. Real-time INSERT event fires → notification added to state
2. User manually calls `fetchNotifications()` → same notification fetched
3. Real-time INSERT fires again (reconnection) → duplicate added

**Result:** Same notification appears twice in the list

### The Solution
Check for duplicates before adding:
```typescript
.on('postgres_changes', { event: 'INSERT', ... }, (payload) => {
  const newNotification = payload.new as Notification;

  setNotifications(prev => {
    // Check if already exists
    if (prev.some(n => n.id === newNotification.id)) {
      return prev; // Already have it, skip
    }
    return [newNotification, ...prev];
  });
})
```

---

## 🪤 TRAP 4: Multiple Subscriptions (useEffect Dependency)

### Location
`hooks/use-notifications.ts` - Line 101-103

### The Trap
```typescript
useEffect(() => {
  fetchNotifications();

  const channel = supabase.channel('notifications').subscribe();

  return () => {
    channel.unsubscribe();
  };
}, [fetchNotifications]); // 🪤 fetchNotifications changes → new subscription!
```

### The Problem
If `fetchNotifications` is not memoized or its dependencies change:
1. Effect re-runs
2. New subscription created
3. Old subscription cleaned up via return function
4. **But:** Brief moment where BOTH subscriptions exist
5. Events might fire twice during the overlap

**Worse:** If cleanup is missing, subscriptions accumulate:
```
Mount → Subscribe #1
fetchNotifications changes → Subscribe #2 (old #1 still active)
fetchNotifications changes → Subscribe #3 (old #1, #2 still active)
```

### The Solution

**Option A:** Use empty dependency array (if fetchNotifications is stable):
```typescript
const fetchNotifications = useCallback(async () => {
  // Implementation
}, []); // No dependencies

useEffect(() => {
  fetchNotifications();
  const channel = supabase.channel('notifications').subscribe();
  return () => channel.unsubscribe();
}, []); // Empty deps - only runs once
```

**Option B:** Use `useRef` to track subscription:
```typescript
useEffect(() => {
  fetchNotifications();

  // Cleanup any existing subscription first
  if (channelRef.current) {
    channelRef.current.unsubscribe();
  }

  channelRef.current = supabase.channel('notifications').subscribe();

  return () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }
  };
}, [fetchNotifications]);
```

---

## 🪤 TRAP 5: UPDATE Event for Missing Notification

### Location
`hooks/use-notifications.ts` - Line 105-107

### The Trap
```typescript
.on('postgres_changes', { event: 'UPDATE', ... }, (payload) => {
  // TODO: Update notification in state
  setNotifications(prev =>
    prev.map(n => n.id === payload.new.id ? payload.new : n) // 🪤 What if not found?
  );
})
```

### The Problem
**Scenario:**
1. User has notifications [A, B, C] in state
2. Notification D is updated in database (by another user/process)
3. Real-time UPDATE event fires for D
4. `map()` doesn't find D → returns unchanged state
5. **Silent failure** - no error, just ignored

**Also:** Notification might have been deleted locally but updated remotely.

### The Solution
Handle the case where notification doesn't exist:
```typescript
.on('postgres_changes', { event: 'UPDATE', ... }, (payload) => {
  const updated = payload.new as Notification;

  setNotifications(prev => {
    const index = prev.findIndex(n => n.id === updated.id);

    if (index === -1) {
      // Not in state - could add it or ignore
      return prev; // Or: return [updated, ...prev];
    }

    // Replace at index
    const newList = [...prev];
    newList[index] = updated;
    return newList;
  });
})
```

---

## 🪤 TRAP 6: Missing Cleanup (Memory Leak)

### Location
`hooks/use-notifications.ts` - Line 133-137

### The Trap
```typescript
return () => {
  // TODO: Cleanup subscriptions
  // 🪤 If you don't unsubscribe, the channel stays active!
};
```

### The Problem
If cleanup is not implemented:
```typescript
useEffect(() => {
  const channel = supabase.channel('notifications').subscribe();

  return () => {
    // Empty - no cleanup! 🪤
  };
}, []);
```

**Result:**
1. Component mounts → subscription #1 created
2. Component unmounts → subscription #1 stays active (memory leak)
3. Component remounts → subscription #2 created
4. Now events fire TWICE (both subscriptions listening)
5. Unmount again → subscriptions #1 and #2 still active
6. Memory leak grows with each mount/unmount cycle

### The Solution
Always unsubscribe:
```typescript
useEffect(() => {
  const channel = supabase
    .channel('notifications')
    .on(...)
    .subscribe();

  return () => {
    channel.unsubscribe(); // Critical!
  };
}, []);
```

---

## 🪤 TRAP 7: Excessive Re-renders (unreadCount Effect)

### Location
`hooks/use-notifications.ts` - Line 141-147

### The Trap
```typescript
useEffect(() => {
  setUnreadCount(notifications.filter(n => !n.read).length);
}, [notifications]); // 🪤 Runs on EVERY notification change
```

### The Problem
**Not technically a race condition**, but a performance issue:

**Scenario:**
1. 10 real-time INSERT events arrive in 100ms
2. Each triggers `setNotifications()` → 10 renders
3. Each render triggers this effect → another `setUnreadCount()` → 10 more renders
4. **Total:** 20 renders in 100ms

**Issues:**
- Excessive re-renders
- If notifications array is mutated (anti-pattern), effect won't run at all
- Calculation runs even when unread count hasn't changed

### The Solution

**Option A:** Calculate in the setter (no separate effect):
```typescript
const markAsRead = useCallback((id: string) => {
  setNotifications(prev => {
    const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);

    // Calculate unread count immediately
    setUnreadCount(updated.filter(n => !n.read).length);

    return updated;
  });
}, []);
```

**Option B:** Use `useMemo` instead of `useEffect`:
```typescript
const unreadCount = useMemo(() => {
  return notifications.filter(n => !n.read).length;
}, [notifications]);

// No need for separate state
```

**Option C:** Debounce the effect:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, 100); // Wait 100ms for rapid changes to settle

  return () => clearTimeout(timer);
}, [notifications]);
```

---

## 🎯 Scoring Impact

### Junior Developer (60-70 points)
- Catches 1-2 traps (usually the obvious ones: cleanup, duplicates)
- Implements basic functionality but with race conditions
- Tests pass but logs show warnings

### Mid-Level Developer (75-88 points)
- Catches 3-5 traps
- Implements proper cleanup and optimistic updates
- Might miss subtle issues (unmount check, multiple subscriptions)

### Senior Developer (90-100 points)
- Catches 5-7 traps
- Implements robust solution with proper error handling
- Understands the interaction between optimistic updates and real-time events
- May suggest alternative architectures (useMemo instead of useEffect, etc.)

---

## 📚 Learning Outcomes

By encountering these traps, candidates learn:

1. **Async lifecycle management** - setState on unmounted components
2. **Real-time event handling** - Interaction between optimistic updates and WebSocket events
3. **Memory leak prevention** - Proper cleanup in useEffect
4. **Duplicate detection** - Handling redundant events
5. **Performance optimization** - Avoiding excessive re-renders
6. **Error handling** - Reverting optimistic updates on failure
7. **React best practices** - useMemo vs useEffect, dependency arrays

---

## 🚀 For Instructors

### How to Use This Document

**During Review:**
1. Open candidate's implementation
2. Check each trap location
3. Score based on how many they caught/fixed

**During Feedback:**
1. Point to specific trap numbers
2. Explain the race condition timeline
3. Show the correct solution
4. Relate to production scenarios

### Common AI Mistakes

AI will typically:
- ✅ Implement basic functionality correctly
- ❌ Add unnecessary "refresh to confirm" (TRAP 2)
- ❌ Forget mounted checks (TRAP 1)
- ❌ Not handle duplicates (TRAP 3)
- ✅ Remember to unsubscribe (TRAP 6) - usually gets this right

**Result:** AI alone scores ~45-55 points.

**Good candidates + AI:** Catch AI mistakes → 85-100 points.

---

## Summary

These 7 traps test **real production skills** that matter in 2026:
- Can you use AI to move fast?
- Can you catch AI's mistakes?
- Do you understand async patterns and real-time systems?

**That's the assessment.** 🎯
