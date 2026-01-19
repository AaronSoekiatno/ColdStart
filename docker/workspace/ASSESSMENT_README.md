# Notification Assessment - File Guide

## 📁 Current File Structure

```
docker/workspace/
├── ASSESSMENT_V1.md                    # Original (with hints)
├── ASSESSMENT_V2_UNIFIED.md            # New unified assessment (no phases)
├── INSTRUCTIONS.md                     # Currently points to V1
│
├── V2_OVERVIEW_SIMPLIFIED.md           # Philosophy & approach
├── V1_VS_V2_COMPARISON.md              # Side-by-side differences
├── V1_TO_V2_MIGRATION.md               # Deployment guide
│
├── lib/
│   ├── notifications.service.ts        # V1: Full implementation
│   └── notifications.service.v2.ts     # V2: Skeleton only
│
├── hooks/
│   ├── use-notifications.ts            # V1: Full implementation
│   └── use-notifications.v2.ts         # V2: Skeleton only
│
└── tests/assessment/
    ├── notifications-api.test.ts               # Backend (40 pts)
    ├── notifications-components.test.tsx       # Frontend (40 pts)
    ├── notifications-integration.test.tsx      # Integration (20 pts)
    ├── build.test.ts                           # Build validation
    ├── sabotage.test.ts                        # Security check
    └── type-safety.test.ts                     # TypeScript check
```

---

## 🎯 What Changed in V2 (Simplified)

### ❌ Removed Phase Structure
**Before**:
- Phase 1: Implementation (10 min - 40 pts)
- Phase 2: Product Decision (5 min - 30 pts)
- Phase 3: Debug Race Condition (5 min - 30 pts)

**After**:
- **Single unified challenge** (20 min - 100 pts)
- No artificial phase transitions
- Continuous coding experience

### ✅ Kept What Matters
- Backend implementation (40 pts)
- Frontend implementation (40 pts)
- Real-time integration (20 pts)
- AI tools encouraged
- Automated testing

### 📝 Infrastructure Phases (Unchanged)
The **interview flow phases** remain:
- KICK_OFF: Minerva intro call
- BUILD: Candidate codes (timer starts)
- REFLECTION: Minerva post-mortem call

These are **separate from the assessment structure** and control the interview orchestration.

---

## 🔍 Which Version Should You Use?

### Use V1 if you want:
- ❌ Traditional coding assessment
- ❌ Extensive hand-holding with hints
- ❌ No time pressure
- ❌ No differentiation between skill levels

**Good for**: Absolute beginners, interns, teaching scenarios

---

### Use V2 if you want:
- ✅ Modern "AI-amplified" assessment
- ✅ Tests ability to use AI tools effectively
- ✅ Clear differentiation (junior 65, mid 88, senior 100)
- ✅ Single continuous 20-minute challenge
- ✅ Fully automated scoring

**Good for**: Mid-senior positions, production engineers, fast-moving startups

---

## 📊 Quick Comparison

| Feature | V1 | V2 Unified |
|---------|-----|------------|
| **Time** | 20 min | 20 min |
| **Points** | 100 | 100 |
| **Structure** | Single task + hints | Single challenge, no hints |
| **Phases** | None | None (unified) |
| **AI tools** | Not mentioned | Encouraged |
| **Tests** | Implementation | Implementation + Verification |
| **AI score** | 95/100 | 45/100 |
| **Differentiation** | Low | High |

---

## 🚀 How to Deploy V2

### Quick Start
```bash
cd docker/workspace

# Make V2 the active assessment
cp ASSESSMENT_V2_UNIFIED.md INSTRUCTIONS.md

# Replace implementation files
cp lib/notifications.service.v2.ts lib/notifications.service.ts
cp hooks/use-notifications.v2.ts hooks/use-notifications.ts

# Verify tests exist
ls tests/assessment/
# Should see: notifications-api.test.ts, notifications-components.test.tsx,
#             notifications-integration.test.tsx
```

### Verify
```bash
# Tests should fail (V2 has no implementation)
npm test tests/assessment/

# Expected: Most tests fail until candidate implements
```

---

## 🧪 Test Files - All Automated

```
tests/assessment/
├── notifications-api.test.ts          ✅ Backend (40 pts)
├── notifications-components.test.tsx  ✅ Frontend (40 pts)
├── notifications-integration.test.tsx ✅ Integration (20 pts)
├── build.test.ts                      ✅ Build validation
├── sabotage.test.ts                   ✅ Security check
└── type-safety.test.ts                ✅ TypeScript check
```

**All scoring is automated** - no manual grading needed.

**See**: `tests/assessment/TEST_GUIDE.md` for details

---

## 🎯 Candidate Experience

### V1 Experience
```
1. Read INSTRUCTIONS.md
2. See extensive hints in code
3. Fill in the blanks
4. Run tests → all pass
5. Submit
```
**Time**: ~15 minutes
**Difficulty**: Easy
**Score**: Everyone gets 90-100

---

### V2 Experience (Unified)
```
1. Read INSTRUCTIONS.md
2. Open files, see TODO comments (no hints)
3. Use AI to implement backend
4. Verify AI output (catch security traps)
5. Implement frontend
6. Get real-time working
7. Run tests → fix failures
8. Submit
```
**Time**: 20 minutes (tight)
**Difficulty**: Challenging
**Score**: 45 (AI alone) to 100 (senior + AI)

---

## 📖 Documentation Map

**Start here**:
1. Read `V2_OVERVIEW_SIMPLIFIED.md` - Understand the philosophy
2. Read `ASSESSMENT_V2_UNIFIED.md` - See candidate instructions
3. Read `V1_TO_V2_MIGRATION.md` - Deploy V2

**For candidates**:
- `INSTRUCTIONS.md` - Main instructions (currently V1)
- `ASSESSMENT_V2_UNIFIED.md` - New unified challenge

**For developers**:
- `tests/assessment/TEST_GUIDE.md` - Test structure
- `V1_VS_V2_COMPARISON.md` - Detailed differences

---

## 💡 Key Insight

### The Problem with Phases
Breaking a 20-minute challenge into Phase 1/2/3 felt **artificial**:
- Candidates code continuously anyway
- Phase transitions add complexity
- Manual grading required for Phase 2/3
- Harder to explain

### The Unified Solution
Single continuous challenge:
- Candidate codes for 20 minutes straight
- One clear goal: "Make tests pass"
- 100% automated scoring
- Simpler to understand and deploy

**Infrastructure phases** (KICK_OFF, BUILD, REFLECTION with Minerva) remain unchanged - those control the interview flow, not the assessment structure.

---

## 🚀 Recommendation

**Deploy V2 Unified** if you want:
- Clear junior/mid/senior differentiation
- Automated scoring (no manual review)
- Tests modern skills (using AI effectively)
- Simple, continuous coding experience

**Keep V1** if you need:
- Heavy guidance for beginners
- No time pressure
- Hand-holding through implementation

---

## ✅ Current Status

**Active Assessment**: V1 (original with hints)
**Available**: V2 Unified (AI-amplified, ready to deploy)
**Infrastructure**: Unchanged (Minerva calls, timers work as before)

**To switch**: Follow `V1_TO_V2_MIGRATION.md`

---

## 📞 Summary

### What We Removed
- ❌ Phase 1/2/3 assessment structure
- ❌ Manual grading components
- ❌ Mid-challenge requirement changes
- ❌ Debugging exercises

### What We Kept
- ✅ Backend + Frontend + Real-time (100 pts)
- ✅ 20-minute time limit
- ✅ AI tools encouraged
- ✅ Automated testing
- ✅ Security traps for verification
- ✅ Infrastructure phases (Minerva, timers)

### Result
**Simpler, clearer, easier to deploy** - while still testing the skills that matter (using AI to ship fast + safe).

---

**Bottom line**: V2 Unified gives you all the benefits of the AI-amplified approach without the complexity of multi-phase structure.
