# Assessment Tests Guide

## 📊 Test Structure Overview

```
tests/assessment/
├── Phase 1 Tests (Automated - 40 pts total)
│   ├── notifications-api.test.ts           # Backend: 40 pts
│   ├── notifications-components.test.tsx   # Frontend: 40 pts
│   └── notifications-integration.test.tsx  # Integration: 20 pts
│
├── Phase 2 Test (Manual Grading - 30 pts)
│   └── phase2-product-decision.test.ts
│
└── Phase 3 Test (Manual Grading - 30 pts)
    └── phase3-debug-race-condition.test.ts
```

**Total**: 100 points across 3 phases

---

## 🔄 V1 vs V2 Testing

### Same Tests, Different Starting Points

**The tests are identical for both versions.** What differs is the implementation state:

| Test File | V1 Behavior | V2 Behavior |
|-----------|-------------|-------------|
| `notifications-api.test.ts` | ✅ Pass immediately | ❌ Fail → ✅ Pass after implementation |
| `notifications-components.test.tsx` | ✅ Pass immediately | ❌ Fail → ✅ Pass after implementation |
| `notifications-integration.test.tsx` | ✅ Pass immediately | ❌ Fail → ✅ Pass after implementation |
| `phase2-product-decision.test.ts` | N/A (V2 only) | Manual grading |
| `phase3-debug-race-condition.test.ts` | N/A (V2 only) | Manual grading |

---

## 📋 Phase 1: Automated Tests (V1 & V2)

### V1 Experience (Original)
```bash
# Before candidate starts
npm test tests/assessment/notifications-api.test.ts
# ✅ PASS - Implementation already exists (with hints)

# Candidate reads hints in code
# Candidate understands the pattern
# Tests still pass
```

**V1 Philosophy**: "Can you understand and modify existing code?"

---

### V2 Experience (New)
```bash
# Before candidate starts
npm test tests/assessment/notifications-api.test.ts
# ❌ FAIL - Error: Not implemented

# Candidate implements getUserNotifications()
# Candidate implements markNotificationAsRead()

npm test tests/assessment/notifications-api.test.ts
# ✅ PASS - Implementation correct
```

**V2 Philosophy**: "Can you implement from requirements without hints?"

---

## 🎯 Running Tests

### Run All Phase 1 Tests
```bash
npm test tests/assessment/notifications-api.test.ts
npm test tests/assessment/notifications-components.test.tsx
npm test tests/assessment/notifications-integration.test.tsx
```

Or all at once:
```bash
npm test tests/assessment/ -- --exclude phase2 --exclude phase3
```

### Run Phase 2 & 3 (V2 Only)
These are manual grading - the test files contain rubrics:
```bash
# Read the rubrics, don't run automated tests
cat tests/assessment/phase2-product-decision.test.ts
cat tests/assessment/phase3-debug-race-condition.test.ts
```

---

## 🔍 What Each Test Verifies

### Backend Test (`notifications-api.test.ts`)
**Tests**: Service layer functions
- ✅ `getUserNotifications()` returns data
- ✅ Notifications sorted by created_at DESC
- ✅ Unread count calculated correctly
- ✅ `markNotificationAsRead()` updates database

**How it works**:
- Mocks Supabase client
- Calls service functions
- Verifies return values

**Both V1 & V2**: Same test, different initial state

---

### Frontend Test (`notifications-components.test.tsx`)
**Tests**: React components
- ✅ Bell icon renders
- ✅ Badge shows unread count
- ✅ Badge hides when count = 0
- ✅ Dropdown renders notification list
- ✅ Read/unread styling differs
- ✅ Mark as read button works

**How it works**:
- Mocks useNotifications hook
- Renders components
- Verifies UI behavior

**Both V1 & V2**: Same test, different initial state

---

### Integration Test (`notifications-integration.test.tsx`)
**Tests**: Real-time updates
- ✅ New notification appears (Realtime INSERT)
- ✅ Badge updates reactively
- ✅ Mark as read syncs UI + backend

**How it works**:
- Mocks Supabase Realtime channel
- Simulates INSERT/UPDATE events
- Verifies state updates

**Both V1 & V2**: Same test, different initial state

---

## 📝 Manual Grading (V2 Only)

### Phase 2: Product Decision (30 pts)
**Not automated** - Review code and comments

**Check for**:
1. Visual priority indicator (15 pts)
2. Pragmatic implementation scope (10 pts)
3. Trade-off analysis in comments (5 pts)

**Grading rubric** in `phase2-product-decision.test.ts`

---

### Phase 3: Debug Race Condition (30 pts)
**Not automated** - Review code and comments

**Check for**:
1. Bug identification (10 pts)
2. Correct fix (15 pts)
3. Safeguards added (5 pts)
4. BONUS: Elegant solution (5 pts)

**Grading rubric** in `phase3-debug-race-condition.test.ts`

---

## 🎓 Scoring Summary

### V1 Assessment (100 pts - all automated)
```
Phase 1: Automated Tests
├── Backend: 40 pts
├── Frontend: 40 pts
└── Integration: 20 pts
────────────────────
Total: 100 pts
```

**Expected scores**:
- With hints: 80-100 (most pass)
- AI can score: 95+

---

### V2 Assessment (100 pts - mixed)
```
Phase 1: Automated Tests (40 pts)
├── Backend: 15 pts
├── Frontend: 20 pts
└── Integration: 5 pts

Phase 2: Manual Grading (30 pts)
└── Product decision

Phase 3: Manual Grading (30 pts)
└── Debug race condition
────────────────────
Total: 100 pts
```

**Expected scores**:
- Junior + AI: 60-70
- Mid + AI: 75-88
- Senior + AI: 90-100
- AI alone: 45

---

## 🚀 Quick Reference

### For V1 Candidates
```bash
# Tests should pass immediately
npm test tests/assessment/

# Read the hints in the code
# Understand the patterns
# Modify if needed
```

### For V2 Candidates
```bash
# Tests will fail initially - that's expected!
npm test tests/assessment/notifications-api.test.ts
# ❌ FAIL - implement the functions

# After implementing
npm test tests/assessment/notifications-api.test.ts
# ✅ PASS - implementation works

# Phase 2 & 3 are manually graded
# Document your decisions in comments
```

---

## ✅ Test Compatibility Verified

**The same test files work for both V1 and V2.**

What differs:
- V1: Implementation provided (tests pass immediately)
- V2: Implementation missing (tests fail, then pass)

No need for separate test files!

---

## 🔧 Troubleshooting

### "Tests pass but I didn't implement anything" (V1)
✅ **Expected** - V1 has full implementation, just with TODO comments

### "Tests fail immediately" (V2)
✅ **Expected** - V2 has no implementation, you must write it

### "Phase 2/3 tests don't run"
✅ **Expected** - They're manual grading rubrics, not automated tests

### "I want to run only Phase 1 tests"
```bash
npm test tests/assessment/ -- --exclude phase
```

---

**Bottom line**: The tests are version-agnostic. They verify functionality regardless of whether you started with hints (V1) or from scratch (V2).
