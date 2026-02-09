# Three-Level Expansion System

## Overview

The candidate review system now has **three distinct levels** of information density, allowing users to progressively expand from a quick scan to deep evidence review.

---

## The Three Levels

### Level 1: Compact Card (Default View)
**Purpose:** Quick scan to identify candidates worth reviewing
**Time to scan:** ~3-5 seconds per candidate
**Action:** Click anywhere on card to expand

```
┌────────────────────────────────────────────┐
│ [Avatar] Candidate A               [95] 🟢 │
│          Software Engineer • 4yrs          │
│                                            │
│ Strong junior-to-mid backend hire         │
│ Confidence: High (verified production)    │
│                                            │
│ 5 Strong • 3 To Explore                 → │
└────────────────────────────────────────────┘
```

**What's shown:**
- Avatar + Name + Match Score
- Years of experience
- Hire level (one line)
- Confidence level
- Quick fit counts (X Strong, Y To Explore)
- Hover/click affordance

**What's hidden:**
- Detailed reasoning
- Full fit breakdown
- All evidence
- Work history details
- Assessment details

---

### Level 2: Verdict Card (First Expansion)
**Purpose:** Detailed review to make interview decision
**Time to review:** ~30-60 seconds per candidate
**Action:** Click "View Full Evidence" to expand further

```
┌────────────────────────────────────────────────────────┐
│                                          [Collapse ▼]  │
│ [Avatar] Candidate A                          [95] 🟢  │
│          Software Engineer • 4yrs                      │
├────────────────────────────────────────────────────────┤
│ VERDICT                                                │
│ Strong junior-to-mid backend hire                     │
│ Confidence: High (verified production impact)         │
│ Why: Proven production backend experience at Series A │
│ fintech, strong Python fundamentals, and excellent    │
│ debugging discipline. Likely to contribute quickly... │
│                                                        │
│ FIT SNAPSHOT                                           │
│ Strong Fits              Needs Validation             │
│ • Backend Python         • ML in production           │
│ • Production readiness   • Distributed systems        │
│ • High code quality      • Leadership scope           │
│                                                        │
│ WORK SIMULATION RESULT                                 │
│ • Completed in 45 minutes (medium difficulty)         │
│ • Code quality: Excellent                             │
│ • Testing: Strong coverage with edge cases            │
│ • Style: Clean abstractions, docs-first               │
│                                                        │
│ VERIFIED PRODUCTION EXPERIENCE                         │
│ • Built and operated backend systems handling real $  │
│ • Improved system performance materially (↓ 60%)      │
│ • Shipped production code to large user bases         │
│                                                        │
│ AI TOOLING                                             │
│ Heavy AI-assisted development using Copilot, Claude,  │
│ ChatGPT for boilerplate, debugging, and architecture. │
│                                                        │
│ SUGGESTED INTERVIEW FOCUS                              │
│ • ML project depth (self-reported)                    │
│ • Distributed systems fundamentals                    │
│ • Leadership claims and scope                         │
│                                                        │
│ [View Full Evidence →]  [Move to Interview →]        │
└────────────────────────────────────────────────────────┘
```

**What's shown:**
- Full verdict (level, confidence, reasoning)
- Fit snapshot (3 strengths, 3 gaps)
- Work simulation summary (4 bullets)
- Verified experience summary (3 outcomes)
- AI tooling summary (3 lines)
- Interview focus areas (3 topics)
- Action buttons

**What's hidden:**
- Company names and dates
- Full GitHub statistics
- Detailed assessment breakdown
- Complete AI usage details
- Full interview question bank
- Proven claims with sources

---

### Level 3: Full Evidence Modal (Second Expansion)
**Purpose:** Deep dive for interview prep or final verification
**Time to review:** ~2-5 minutes per candidate
**Action:** Click "Back to Summary" to collapse

```
┌──────────────────────────────────────────────────────────┐
│ [← Back to Summary]            [Move to Interview →]    │
├──────────────────────────────────────────────────────────┤
│ [Avatar] Candidate A                            [95] 🟢  │
│          Software Engineer • 4yrs                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ENGINEERING SIGNAL (Verified)                       ▼   │
│ Primary language: Python (65% of commits)               │
│ Consistent production-level contributions (18+ months)  │
│ Quality Score: 87/100 (top 15% of candidates)          │
│                                                          │
│ Language Breakdown:                                     │
│ Python 65% ████████ JS 25% ████ Go 10% ██             │
│ Activity: Jan 2023-present (18 months)                  │
│ Projects: 6 meaningful projects, 124 commits            │
│                                                          │
│ DETAILED WORK HISTORY                               ▼   │
│ Backend Engineer @ Series A Fintech    2yrs ✓          │
│ • Built payment reconciliation system ($10M+ monthly)   │
│ • Reduced API latency by 60% through caching           │
│ • Implemented fraud detection (95% accuracy)            │
│                                                          │
│ Software Engineering Intern @ FAANG     3mo ✓           │
│ • Shipped feature to 100M+ users                        │
│ • Collaborated with 8-person cross-functional team      │
│                                                          │
│ FULL ASSESSMENT BREAKDOWN                           ▼   │
│ Time: 45min | Difficulty: medium | Quality: 95/100     │
│ Test Coverage: 87% | Edge Cases: 5 handled             │
│                                                          │
│ Approach Notes:                                         │
│ Used systematic approach with clear separation of       │
│ concerns. Implemented comprehensive error handling...   │
│                                                          │
│ DETAILED AI USAGE                                   ▼   │
│ Tools: GitHub Copilot, Claude, ChatGPT                  │
│ Frequency: Heavy | Prompt Engineering: Advanced         │
│                                                          │
│ Use Cases:                                              │
│ • Code generation for boilerplate                       │
│ • Debugging complex issues                              │
│ • Architecture design brainstorming                     │
│ • Test case generation                                  │
│                                                          │
│ PROVEN CLAIMS (Evidence-Backed)                     ▼   │
│ ✓ 4+ years Python experience                            │
│   Source: GitHub (18mo) + Resume (4yrs total)          │
│ ✓ Deep problem-solving mindset                          │
│   Source: Assessment (95% score, edge cases)            │
│ [...more claims with sources...]                        │
│                                                          │
│ INTERVIEW QUESTIONS (Auto-Generated)                ▼   │
│ ML Experience (Self-Reported, Unverified):              │
│ • "Can you walk me through a recent ML project?"        │
│ • "What ML frameworks have you used in production?"     │
│                                                          │
│ Team Leadership (Resume Claim, No Evidence):            │
│ • "Tell me about your leadership experience..."         │
│ [...more detailed questions...]                         │
│                                                          │
│ [← Back to Summary]            [Move to Interview →]    │
└──────────────────────────────────────────────────────────┘
```

**What's shown:**
- Complete GitHub analysis (languages, activity, quality)
- Full work history (company names, dates, all metrics)
- Detailed assessment breakdown (all scores, notes)
- Complete AI usage details (tools, frequency, use cases)
- Proven claims with evidence sources
- Full interview question bank (multiple questions per topic)
- All FAANG/salary details

**Everything is visible** - this is where the flex lives!

---

## User Flow

### Default State (Page Load)
```
┌─ Compact Card 1 ─┐
│ Candidate A      │ ← Click to expand
│ 95 • 4yrs        │
└──────────────────┘

┌─ Compact Card 2 ─┐
│ Candidate B      │
│ 89 • 5yrs        │
└──────────────────┘

┌─ Compact Card 3 ─┐
│ Candidate C      │
│ 82 • 3yrs        │
└──────────────────┘
```

**Users see:** All candidates as compact cards
**Density:** Maximum (3-5 seconds per card)
**Goal:** Quick triage - identify top candidates

---

### First Expansion (Click Compact Card)
```
┌─ Compact Card 1 ─┐
│ Candidate A      │
└──────────────────┘

╔═══════════════════╗
║ VERDICT CARD 2    ║ ← Expanded! Shows full verdict
║ Candidate B       ║
║                   ║
║ [Full sections]   ║
║                   ║
║ [View Full] [→]   ║
╚═══════════════════╝

┌─ Compact Card 3 ─┐
│ Candidate C      │
└──────────────────┘
```

**Users see:** One verdict card expanded, others stay compact
**Density:** Medium (~30-60 seconds to review)
**Goal:** Detailed review for interview decision

---

### Second Expansion (Click "View Full Evidence")
```
┌──────────────────────────────────────┐
│ FULL EVIDENCE MODAL                  │
│                                      │
│ [All detailed sections]              │
│ [Collapsible sections]               │
│ [Complete evidence]                  │
│                                      │
│ [← Back]           [Move to Int. →] │
└──────────────────────────────────────┘
```

**Users see:** Modal overlay with complete evidence
**Density:** Low (2-5 minutes for deep dive)
**Goal:** Interview prep or final verification

---

## Component Architecture

### Files Created/Updated

```
components/company/candidates/
├── CandidateCompactCard.tsx    (NEW - Level 1)
├── CandidateVerdictCard.tsx    (UPDATED - Level 2)
├── CandidateFullEvidence.tsx   (UPDATED - Level 3)
├── FitSnapshot.tsx             (Helper component)
└── index.ts                    (Export barrel)

app/company-dashboard/page.tsx  (UPDATED - State management)
```

### State Management

```typescript
// Dashboard state
const [expandedVerdictId, setExpandedVerdictId] = useState<string | null>(null);
const [expandedFullEvidenceId, setExpandedFullEvidenceId] = useState<string | null>(null);

// Rendering logic
{filteredCandidates.map((candidate) => {
  // Level 2: Show verdict card if this candidate is expanded
  if (expandedVerdictId === candidate.id) {
    return <CandidateVerdictCard
      onCollapse={() => setExpandedVerdictId(null)}
      onExpandFull={(id) => setExpandedFullEvidenceId(id)}
    />;
  }

  // Level 1: Default - show compact card
  return <CandidateCompactCard
    onExpand={(id) => setExpandedVerdictId(id)}
  />;
})}

// Level 3: Modal shown on top when full evidence expanded
{expandedFullEvidenceId && (
  <CandidateFullEvidence
    onClose={() => setExpandedFullEvidenceId(null)}
  />
)}
```

---

## Design Decisions

### Why Three Levels?

1. **Level 1 (Compact):** Optimized for scanning multiple candidates quickly
   - Hiring managers can see 8-10 candidates on one screen
   - Quick triage: "Is this candidate worth reviewing?"
   - Decision: 3-5 seconds per candidate

2. **Level 2 (Verdict):** Optimized for making interview decisions
   - All key information visible without scrolling
   - Signal-first (no flex, no resume bullets)
   - Decision: 30-60 seconds per candidate

3. **Level 3 (Full Evidence):** Optimized for deep verification
   - Complete evidence for interview prep
   - All details, metrics, and sources
   - Decision: 2-5 minutes for thorough review

### Progressive Disclosure Benefits

- **Reduces cognitive load:** Users only see what they need at each stage
- **Faster decisions:** Most candidates decided at Level 2
- **Preserves all information:** Nothing is lost, just organized better
- **Respects user time:** Optimized for model-to-model efficiency

### Color System (Light Mode)

- **Backgrounds:** White (`bg-white`)
- **Borders:** Gray-200 (`border-gray-200`)
- **Text Primary:** Gray-900 (`text-gray-900`)
- **Text Secondary:** Gray-600/700 (`text-gray-600`)
- **Accents:**
  - Blue: Primary actions (`bg-blue-600`)
  - Emerald: Strong fits, verified items (`text-emerald-500`)
  - Amber: Needs validation, unverified (`text-amber-500`)
- **Match Scores:**
  - Green: 85+ (`bg-emerald-500`)
  - Blue: 70-84 (`bg-blue-500`)
  - Amber: <70 (`bg-amber-500`)

---

## Usage Examples

### Quick Triage (Level 1 Only)
**Use case:** Reviewing 20 new candidates
**Time:** 1-2 minutes total
**Flow:** Scan compact cards → Click best 3-5 → Review at Level 2

### Standard Review (Levels 1 + 2)
**Use case:** Making interview decisions
**Time:** 5-10 minutes for 5 candidates
**Flow:** Scan compact → Expand verdict → Decide (interview/pass)

### Deep Dive (All 3 Levels)
**Use case:** Final candidate or interview prep
**Time:** 2-5 minutes per candidate
**Flow:** Scan → Review verdict → Expand full evidence → Prepare questions

---

## Key Interactions

### Expanding
- **Click compact card** → Expands to verdict card in-place
- **Click "View Full Evidence"** → Opens modal overlay

### Collapsing
- **Click collapse button (▼)** on verdict card → Collapses to compact
- **Click "Back to Summary"** in modal → Closes modal, returns to verdict

### One-at-a-time Expansion
- Only ONE verdict card can be expanded at a time
- Expanding a new card auto-collapses the previous one
- Keeps the UI clean and focused

---

## Future Enhancements

### Phase 2: Keyboard Navigation
- `j/k` to navigate between candidates
- `Enter` to expand/collapse
- `Space` to toggle full evidence
- `Esc` to close modals

### Phase 3: Comparison Mode
- Select 2-3 candidates
- View side-by-side in compact mode
- Quick comparison of key stats

### Phase 4: Bulk Actions
- Multi-select compact cards
- Bulk reject/archive
- Bulk move to interview

---

## Success Metrics

### Level 1 (Compact)
- ✅ Fits 8-10 cards on screen without scrolling
- ✅ 3-5 seconds to scan per card
- ✅ Clear affordance to expand

### Level 2 (Verdict)
- ✅ 75% content reduction from original (500 → 125 words)
- ✅ 30-60 seconds to review
- ✅ Sufficient info to make interview decision
- ✅ No FAANG/salary flex in summary

### Level 3 (Full Evidence)
- ✅ All information preserved
- ✅ Collapsible sections for navigation
- ✅ Clear path back to summary
- ✅ Optimized for interview prep

---

## Testing Checklist

- [x] Compact card renders correctly
- [x] Click expands to verdict card
- [x] Verdict card shows all sections
- [x] Collapse button works
- [x] Only one verdict expanded at a time
- [x] "View Full Evidence" opens modal
- [x] Modal shows all collapsible sections
- [x] "Back to Summary" closes modal
- [x] Colors match light mode design
- [x] Responsive on mobile (cards stack)
- [ ] Keyboard navigation works
- [ ] Animations are smooth
- [ ] Performance with 50+ candidates

---

## Live Demo

**URL:** `http://localhost:3000/company-dashboard`

**Steps to test:**
1. Navigate to dashboard
2. Click "Candidates" tab
3. See compact cards (Level 1)
4. Click any card → Expands to verdict (Level 2)
5. Click "View Full Evidence" → Opens modal (Level 3)
6. Click "Back to Summary" → Returns to verdict
7. Click collapse (▼) → Returns to compact

**Expected behavior:**
- Default view: All compact cards visible
- One expansion at a time
- Smooth transitions
- Clear navigation affordances
