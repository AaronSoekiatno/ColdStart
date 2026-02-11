# Candidate Overview Redesign: Visual Pipeline Approach

## Problem Statement
Current candidate overview is text-heavy and overwhelming, making it difficult to quickly evaluate and move candidates through the hiring process efficiently. The model-to-model aggregation isn't effective because there's no clear visual hierarchy or pipeline progression.

## Design Principles
1. **Visual First**: Use icons, badges, progress bars, and color coding
2. **Progressive Disclosure**: Show critical info first, expand for details
3. **Pipeline Thinking**: Clear stages with actions at each step
4. **Scannable**: Hiring manager should grok a candidate in 5 seconds
5. **Actionable**: Clear next steps at every stage

---

## Proposed Visual Hierarchy

### Level 1: Default View (Condensed - 75% reduction)
```
┌─────────────────────────────────────────────────────────────┐
│ [Avatar] Candidate A                              [95] 🟢   │
│          Software Engineer • 4yrs                           │
│                                                              │
│ VERDICT                                                     │
│ Strong junior-to-mid backend hire                          │
│ Confidence: High (verified production impact)              │
│ Why: Proven production backend experience at Series A      │
│ fintech, strong Python fundamentals, and excellent         │
│ debugging discipline. Likely to contribute quickly in a    │
│ structured engineering org like Palantir.                   │
│                                                              │
│ FIT SNAPSHOT                                                │
│ Strong Fits                  Needs Validation              │
│ • Backend Python             • ML in production            │
│ • Production readiness       • Distributed systems         │
│ • High code quality bar      • Leadership scope            │
│                                                              │
│ WORK SIMULATION RESULT                                      │
│ • Completed in 45 minutes (medium difficulty)              │
│ • Code quality: Excellent                                   │
│ • Testing: Strong coverage with edge cases handled         │
│ • Style: Clean abstractions, documentation-first mindset   │
│                                                              │
│ VERIFIED PRODUCTION EXPERIENCE                              │
│ • Built and operated backend systems handling real money   │
│ • Improved system performance materially (latency ↓ 60%)   │
│ • Shipped production code used by large user bases         │
│                                                              │
│ AI TOOLING                                                  │
│ Heavy AI-assisted development using Copilot, Claude,       │
│ ChatGPT for boilerplate, debugging, and architecture.      │
│ Demonstrates strong prompt literacy and tool judgment.     │
│                                                              │
│ SUGGESTED INTERVIEW FOCUS                                   │
│ • ML project depth (self-reported, not verified)           │
│ • Distributed systems fundamentals                         │
│ • Leadership claims and scope                              │
│                                                              │
│ Pipeline: [●───○───○] Review → Interview → Decision        │
│                                                              │
│ [ View Full Evidence → ]  [ ➡️ Move to Interview ]        │
└─────────────────────────────────────────────────────────────┘
```

**Key Changes:**
- **Verdict Section**: 3 lines - assessment level, confidence, reasoning
- **Fit Snapshot**: 6 bullets max (3 strengths, 3 gaps) - scannable in 5 seconds
- **Work Simulation**: 4 bullets - quality over metrics flex
- **Verified Experience**: 3 bullets - outcomes, not resume
- **AI Tooling**: 3 lines - differentiated insight, not overwhelming
- **Interview Focus**: 3 bullets - clear areas to probe
- **No FAANG/salary flex**: Evidence lives behind expansion
- **75% content reduction**: From 500+ words to ~125 words

---

### Level 2: Full Evidence View (Expanded)
Clicking "View Full Evidence →" reveals detailed proof:

```
┌─────────────────────────────────────────────────────────────┐
│ [← Back to Summary]  Candidate A - Full Evidence           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ENGINEERING SIGNAL (Verified)                          ▼   │
│ Primary language: Python (65% of commits)                  │
│ Consistent production-level contributions for 18+ months   │
│ Refactoring- and debugging-heavy commit patterns          │
│ Quality Score: 87/100 (top 15% of candidates)             │
│                                                              │
│ ├─ Language Breakdown:                                     │
│ │  Python 65% ████████ JS 25% ████ Go 10% ██             │
│ ├─ Activity: Jan 2023-present (18 months)                 │
│ ├─ Projects: 6 meaningful projects, 124 commits            │
│ └─ Patterns: 15+ bug fixes, iterative development         │
│                                                              │
│ DETAILED WORK HISTORY                                  ▼   │
│ Backend Engineer @ Series A Fintech         2yrs ✓        │
│ • Built payment reconciliation system processing $10M+    │
│   monthly transactions                                     │
│ • Reduced API latency by 60% through strategic caching    │
│ • Implemented fraud detection pipeline catching 95% of    │
│   fraudulent transactions                                  │
│                                                              │
│ Software Engineering Intern @ FAANG          3mo ✓         │
│ • Shipped feature to 100M+ users                           │
│ • Collaborated with cross-functional team of 8 engineers   │
│                                                              │
│ FULL ASSESSMENT BREAKDOWN                              ▼   │
│ Time to Complete: 45 minutes (medium difficulty)          │
│ Code Quality Score: 95/100                                 │
│ Test Coverage: 87%                                         │
│ Edge Cases Handled: 5                                      │
│                                                              │
│ Approach Notes:                                            │
│ Used a systematic approach with clear separation of       │
│ concerns. Implemented comprehensive error handling and    │
│ wrote unit tests before shipping. Demonstrated strong     │
│ understanding of time complexity and space optimization.   │
│                                                              │
│ DETAILED AI USAGE                                      ▼   │
│ Tools: GitHub Copilot, Claude, ChatGPT                    │
│ Frequency: Heavy                                           │
│ Prompt Engineering: Advanced                               │
│                                                              │
│ Use Cases:                                                 │
│ • Code generation for boilerplate and repetitive patterns │
│ • Debugging complex issues with detailed context          │
│ • Architecture design brainstorming and tradeoff analysis │
│ • Test case generation and edge case identification       │
│                                                              │
│ PROVEN CLAIMS (Evidence-Backed)                        ▼   │
│ ✓ 4+ years Python experience                              │
│   Source: GitHub (18mo activity) + Resume (4yrs total)    │
│                                                              │
│ ✓ Deep problem-solving mindset                            │
│   Source: Assessment (95% score, edge case handling)      │
│                                                              │
│ ✓ High code quality standards                             │
│   Source: GitHub (87/100) + Assessment (95/100)           │
│                                                              │
│ ✓ Production backend systems                              │
│   Source: Verified work experience (payment systems)      │
│                                                              │
│ ✓ Full-stack capable                                       │
│   Source: GitHub (React + Python projects)                │
│                                                              │
│ INTERVIEW QUESTIONS (Auto-Generated)                   ▼   │
│ ML Experience (Self-Reported, Unverified):                │
│ • "Can you walk me through a recent ML project and your   │
│   specific role in it?"                                    │
│ • "What ML frameworks have you used in production?"       │
│                                                              │
│ Team Leadership (Resume Claim, No Evidence):              │
│ • "Tell me about your leadership experience. What were    │
│   the key challenges?"                                     │
│ • "How did you handle conflict within your 3-person team?"│
│                                                              │
│ Distributed Systems (Limited GitHub Evidence):            │
│ • "Describe your experience with distributed systems"     │
│ • "How have you handled consistency/availability         │
│   tradeoffs?"                                              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ [← Back to Summary]  [ ➡️ Move to Interview ]            │
└─────────────────────────────────────────────────────────────┘
```

**Key Changes:**
- **All evidence expanded**: Full context for every claim
- **Source attribution**: Where each piece of evidence came from
- **Detailed breakdowns**: GitHub activity, work history, assessment
- **Interview prep**: Full question bank for unverified areas
- **Collapsible sections**: Can still collapse what you don't need
- **Back to summary**: Easy navigation to condensed view

---

## Pipeline Kanban View (Recommended Default)

The pipeline view organizes candidates into columns by stage, making it easy to see where each candidate is in the process and move them forward.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Candidates Pipeline                    [Kanban] [List] [Focus]   🔍 Search   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  NEW (4)              REVIEWING (2)       INTERVIEW (3)      INTERVIEWED (1) │
│ ┌──────────────┐     ┌──────────────┐    ┌──────────────┐   ┌──────────────┐│
│ │[95] 🟢       │     │[87] 🟢       │    │[92] 🟢       │   │[78] 🔵       ││
│ │Candidate A   │     │Candidate D   │    │Candidate B   │   │Candidate G   ││
│ │4yrs          │     │3yrs          │    │6yrs          │   │2yrs          ││
│ │              │     │              │    │              │   │              ││
│ │Strong jr-mid │     │Mid-level ML  │    │Senior backend│   │Junior full-  ││
│ │backend hire  │     │hire          │    │hire          │   │stack hire    ││
│ │              │     │              │    │              │   │              ││
│ │High conf.    │     │Medium conf.  │    │High conf.    │   │Med. conf.    ││
│ │              │     │              │    │              │   │              ││
│ │[Review]      │     │[Evidence]    │    │Scheduled:    │   │[Decide]      ││
│ │              │     │              │    │Feb 12, 2pm   │   │              ││
│ └──────────────┘     └──────────────┘    └──────────────┘   └──────────────┘│
│                                                                               │
│ ┌──────────────┐     ┌──────────────┐    ┌──────────────┐                   │
│ │[89] 🟢       │     │[82] 🔵       │    │[88] 🟢       │                   │
│ │Candidate C   │     │Candidate E   │    │Candidate F   │                   │
│ │5yrs          │     │4yrs          │    │3yrs          │                   │
│ │              │     │              │    │              │                   │
│ │Mid full-stack│     │Junior backend│    │Mid frontend  │                   │
│ │hire          │     │hire          │    │hire          │                   │
│ │              │     │              │    │              │                   │
│ │High conf.    │     │High conf.    │    │Medium conf.  │                   │
│ │              │     │              │    │              │                   │
│ │[Review]      │     │[Evidence]    │    │Scheduled:    │                   │
│ │              │     │              │    │Feb 15, 10am  │                   │
│ └──────────────┘     └──────────────┘    └──────────────┘                   │
│                                                                               │
│ [+ 2 more...]                                                                │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

Drag cards between columns to change pipeline stage
Click card to expand to full evidence view
Click [Review]/[Evidence] buttons for quick actions
```

**Key Features:**
- **Column Headers**: Stage name + candidate count
- **Condensed Cards**: Match score, name, years, verdict level, confidence
- **Visual Hierarchy**: Easy to scan across all candidates
- **Drag-and-Drop**: Move candidates between stages
- **Quick Actions**: Stage-specific CTAs on each card
- **Overflow Handling**: "X more" link when columns are tall

**Stage-Specific Card Content:**
- **NEW**: Match score + verdict + [Review] button
- **REVIEWING**: Match score + verdict + [Evidence] button
- **INTERVIEW**: Match score + verdict + scheduled time
- **INTERVIEWED**: Match score + verdict + [Decide] button

## Pipeline Stages & States

### Stage 1: NEW (Auto-populated)
**Goal:** Quick triage - worth reviewing?
**View:** Super compact card
**Data Shown:**
- Match score
- One-line TLDR
- Top 3 proven claims
- Assessment score (if completed)

**Actions:**
- [Archive] - Not interested
- [Review] - Expand to review mode

---

### Stage 2: REVIEWING (Active evaluation)
**Goal:** Deep evaluation - schedule interview?
**View:** Full expanded mode (Level 2 above)
**Data Shown:** Everything

**Actions:**
- [Reject with reason]
- [Request more info]
- [Move to Interview]

---

### Stage 3: INTERVIEW SCHEDULED
**Goal:** Prep for interview
**View:** Interview prep mode
**Data Shown:**
- Suggested questions (generated from gaps)
- Assessment replay link
- GitHub profile highlights
- Experience deep-dive

**Actions:**
- [View Interview Prep Sheet]
- [Cancel Interview]
- [Complete Interview]

---

### Stage 4: INTERVIEWED
**Goal:** Make final decision
**View:** Decision mode
**Data Shown:**
- All previous data
- Interview notes section
- Interviewer scores

**Actions:**
- [Reject with feedback]
- [Request second interview]
- [Make Offer]

---

## Visual Component Breakdown

### 1. Verdict Section (Replaces "Why Hire")
```
Current: Long paragraph with FAANG/salary flex
500+ words, buried insights

Proposed:
┌──────────────────────────────────────────────────┐
│ VERDICT                                          │
│ Strong junior-to-mid backend hire               │
│ Confidence: High (verified production impact)   │
│ Why: Proven production backend experience at    │
│ Series A fintech, strong Python fundamentals,   │
│ and excellent debugging discipline. Likely to   │
│ contribute quickly in structured org.           │
└──────────────────────────────────────────────────┘

3 lines: Level + Confidence + Reasoning
No flex, just signal
```

### 2. Fit Snapshot (Replaces Match Analysis)
```
Current: Checkmarks, detailed descriptions, overwhelming

Proposed:
┌──────────────────────────────────────────────────┐
│ FIT SNAPSHOT                                     │
│ Strong Fits            Needs Validation          │
│ • Backend Python       • ML in production        │
│ • Production readiness • Distributed systems     │
│ • High code quality    • Leadership scope        │
└──────────────────────────────────────────────────┘

Two columns, 3 bullets each
Scannable in 5 seconds
No checkmarks, no drama
```

### 3. Work Simulation Result (Replaces Assessment Highlights)
```
Current: Metrics flex, time boasting

Proposed:
┌──────────────────────────────────────────────────┐
│ WORK SIMULATION RESULT                           │
│ • Completed in 45 minutes (medium difficulty)    │
│ • Code quality: Excellent                        │
│ • Testing: Strong coverage with edge cases       │
│ • Style: Clean abstractions, docs-first mindset  │
└──────────────────────────────────────────────────┘

4 bullets max
Quality over metrics
```

### 4. Verified Production Experience (Replaces Work History)
```
Current: Full resume with company names, dates, bullet points

Proposed:
┌──────────────────────────────────────────────────┐
│ VERIFIED PRODUCTION EXPERIENCE                   │
│ • Built and operated backend systems handling    │
│   real money flows                               │
│ • Improved system performance materially         │
│   (latency ↓ 60%)                                │
│ • Shipped production code used by large user     │
│   bases                                          │
└──────────────────────────────────────────────────┘

3 bullets: Outcomes, not resume
Evidence lives behind "View Full Evidence"
```

### 5. AI Tooling (Condensed)
```
Current: Detailed breakdown with tools, frequency, use cases in bullets

Proposed:
┌──────────────────────────────────────────────────┐
│ AI TOOLING                                       │
│ Heavy AI-assisted development using Copilot,     │
│ Claude, ChatGPT for boilerplate, debugging, and  │
│ architecture. Demonstrates strong prompt         │
│ literacy and tool judgment.                      │
└──────────────────────────────────────────────────┘

3 lines max
Differentiated insight, not overwhelming
```

### 6. Suggested Interview Focus (Replaces scattered prompts)
```
Current: Scattered "To Explore" with long interview questions

Proposed:
┌──────────────────────────────────────────────────┐
│ SUGGESTED INTERVIEW FOCUS                        │
│ • ML project depth (self-reported)               │
│ • Distributed systems fundamentals               │
│ • Leadership claims and scope                    │
└──────────────────────────────────────────────────┘

3 bullets max
Areas to probe, not full questions
Full questions live behind expansion
```

### 7. Pipeline Progress Indicator (New)
```
Current: None

Proposed:
Pipeline: [●───○───○] Review → Interview → Decision
          ↑ (current stage highlighted)

Visual progress through hiring stages
Clear next step
```

### 8. Match Score Badge
```
Current: Small circular progress (64px)

Proposed:
┌─────────┐
│   95    │  ← Large number (green background)
└─────────┘

Simplified, prominent
Color: Green (85+), Yellow (70-84), Red (<70)
```

---

## Implementation Plan

### Phase 1: Data Structure Updates
**File:** `lib/mockCompanyData.ts`

Add pipeline and condensed fields:
```typescript
interface CandidateBrief {
  // ... existing fields

  // Pipeline tracking
  pipeline_stage: 'new' | 'reviewing' | 'interview_scheduled' | 'interviewed' | 'rejected' | 'offered';
  pipeline_updated_at: string;

  // Condensed verdict (AI-generated from why_hire_summary)
  verdict: {
    level: string;           // "Strong junior-to-mid backend hire"
    confidence: string;      // "High (verified production impact)"
    reasoning: string;       // 1-2 sentence why
  };

  // Fit snapshot (condensed from match_analysis)
  fit_snapshot: {
    strong_fits: string[];        // Max 3 items
    needs_validation: string[];   // Max 3 items
  };

  // Condensed experience (generated from real_world_experience)
  verified_experience_summary: string[];  // Max 3 bullet points

  // Condensed assessment (from assessment_details)
  work_simulation_summary: string[];  // Max 4 bullets

s
  // Interview focus (from unproven_claims)
  interview_focus: string[];  // Max 3 items
}
```

### Phase 2: Component Refactoring
**New Components:**
1. `CandidateVerdictCard.tsx` - Condensed default view (Level 1)
   - Verdict section
   - Fit snapshot
   - Work simulation result
   - Verified experience
   - AI tooling
   - Interview focus
   - Expand/Interview CTAs

2. `CandidateFullEvidence.tsx` - Expanded evidence view (Level 2)
   - Engineering signal (GitHub detailed)
   - Full work history
   - Full assessment breakdown
   - Detailed AI usage
   - Proven claims with sources
   - Interview question bank

3. `PipelineStageIndicator.tsx` - Visual stage progress
   - [●───○───○] style indicator
   - Stage labels
   - Clickable to move stages

4. `FitSnapshot.tsx` - Two-column fit display
   - Strong Fits (left, green)
   - Needs Validation (right, yellow)
   - Max 3 bullets each

5. `CandidatePipelineKanban.tsx` - Kanban board view
   - Columns for each stage
   - Drag-to-move candidates
   - Count badges on columns

**Refactor Existing:**
1. `CandidateTable.tsx` → Optional kanban mode toggle
2. `MatchScoreBreakdown.tsx` → Simplified badge (just number + color)
3. `CandidateBriefCard.tsx` → Deprecated (replaced by VerdictCard)

### Phase 3: Pipeline Views
**New Layouts:**
1. **Kanban View** (Recommended Default):
   - Columns: New | Reviewing | Interview Scheduled | Interviewed
   - Drag-and-drop between stages
   - Condensed cards (verdict cards)
   - Quick actions on card hover

2. **List View**:
   - Sorted by pipeline stage, then match score
   - Condensed verdict cards
   - Expandable to full evidence

3. **Focus View**:
   - One candidate at a time
   - Full evidence always shown
   - Keyboard navigation (j/k for next/prev)
   - Quick decision buttons

### Phase 4: AI Generation Pipeline
**Auto-generate condensed content from existing data:**

1. **Verdict Generation**:
   ```typescript
   // Input: why_hire_summary (long paragraph)
   // Output: { level, confidence, reasoning }
   // Use LLM to extract: hire level, confidence signal, 1-2 sentence why
   ```

2. **Fit Snapshot**:
   ```typescript
   // Input: match_analysis.fit_areas, match_analysis.gaps
   // Output: { strong_fits: string[3], needs_validation: string[3] }
   // Condense to top 3 items each
   ```

3. **Experience Summary**:
   ```typescript
   // Input: real_world_experience[]
   // Output: string[3] (outcome bullets, not resume)
   // Transform "Built X at Y" → "Built and operated systems handling Z"
   ```

4. **Work Simulation Summary**:
   ```typescript
   // Input: assessment_details
   // Output: string[4] (quality focus, not metrics flex)
   // Emphasize: time, quality level, testing approach, style
   ```

5. **Interview Focus**:
   ```typescript
   // Input: unproven_claims[]
   // Output: string[3] (areas, not full questions)
   // Extract topic + source: "ML project depth (self-reported)"
   ```

### Phase 5: Pipeline State Management
**New State:**
```typescript
// Add to page.tsx
const [pipelineView, setPipelineView] = useState<'kanban' | 'list' | 'focus'>('kanban');
const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);

// Add pipeline actions
const moveCandidateToStage = (candidateId: string, stage: PipelineStage) => {
  // Update candidate pipeline_stage
  // Update pipeline_updated_at
  // Trigger re-render
};

const expandToFullEvidence = (candidateId: string) => {
  setExpandedCandidate(candidateId);
  // Show full evidence modal/panel
};
```

---

## Example: Before vs After

### BEFORE (Current - ~500 words)
```
Why Hire
Former FAANG intern who went on to build payment systems handling
$10M+ monthly at a Series A fintech—Candidate A has the production
backend credibility to contribute immediately at Palantir. Their
95% assessment score and 18+ months of consistent Python contributions
prove they write code that actually ships...
[continues for 3 more paragraphs]

Real-World Experience
Backend Engineer • Series A Fintech Startup • 2 years • Verified
→ Built payment reconciliation system processing $10M+ monthly
→ Reduced API latency by 60% through strategic caching
→ Implemented fraud detection pipeline...
[continues with full work history]

Proven by Evidence
Active Python contributor (18+ months)
124 commits across 6 projects, consistent activity since Jan 2023
[continues with 8+ more items]

GitHub Analysis
Python 65% • JavaScript 25% • Go 10%
Quality: 87/100 • Active: 18mo • Projects: 4
[continues with detailed breakdown]

[...more sections...]
```
**Problems:**
- 500+ words overwhelming
- FAANG/salary flex prioritized over signal
- Everything always visible
- No decision hierarchy
- Takes 5+ minutes to read

### AFTER (Proposed - ~125 words, 75% reduction)
```
[95] 🟢  Candidate A • Software Engineer • 4yrs

VERDICT
Strong junior-to-mid backend hire
Confidence: High (verified production impact)
Why: Proven production backend experience at Series A fintech,
strong Python fundamentals, and excellent debugging discipline.

FIT SNAPSHOT
Strong Fits              Needs Validation
• Backend Python         • ML in production
• Production readiness   • Distributed systems
• High code quality      • Leadership scope

WORK SIMULATION RESULT
• Completed in 45 minutes (medium difficulty)
• Code quality: Excellent
• Testing: Strong coverage with edge cases
• Style: Clean abstractions, docs-first

VERIFIED PRODUCTION EXPERIENCE
• Built and operated backend systems handling real money
• Improved system performance materially (latency ↓ 60%)
• Shipped production code used by large user bases

AI TOOLING
Heavy AI-assisted development using Copilot, Claude, ChatGPT
for boilerplate, debugging, and architecture. Demonstrates
strong prompt literacy and tool judgment.

SUGGESTED INTERVIEW FOCUS
• ML project depth (self-reported)
• Distributed systems fundamentals
• Leadership claims and scope

Pipeline: [●───○───○] Review → Interview → Decision

[ View Full Evidence → ]  [ ➡️ Move to Interview ]
```
**Improvements:**
- ~125 words (75% reduction)
- Scannable in 30 seconds
- Signal-first (no flex)
- Clear decision path
- Progressive disclosure (full evidence behind click)
- Decision: "High confidence backend, validate ML → Interview"

---

## Success Metrics
1. **Time to Decision**: Target <2min per candidate (down from ~10min)
2. **Confidence**: Hiring managers feel they have enough info
3. **Action Rate**: % of candidates moving to next stage increases
4. **Review Completion**: % of candidates fully reviewed increases

---

## Component Architecture

### File Structure
```
components/company/
├── candidates/
│   ├── CandidateVerdictCard.tsx          (NEW - condensed default view)
│   ├── CandidateFullEvidence.tsx         (NEW - expanded evidence)
│   ├── CandidatePipelineKanban.tsx       (NEW - kanban board)
│   ├── PipelineStageColumn.tsx           (NEW - kanban column)
│   ├── PipelineStageIndicator.tsx        (NEW - progress indicator)
│   ├── FitSnapshot.tsx                   (NEW - two-column fit display)
│   ├── WorkSimulationBadge.tsx           (NEW - assessment summary)
│   ├── VerifiedExperienceBadge.tsx       (NEW - experience summary)
│   └── InterviewFocusBadge.tsx           (NEW - interview areas)
├── CandidateTable.tsx                    (REFACTOR - add kanban mode)
├── CandidateFilterBar.tsx                (KEEP - add pipeline stage filter)
└── MatchScoreBreakdown.tsx               (SIMPLIFY - just badge)

lib/
├── mockCompanyData.ts                    (UPDATE - add condensed fields)
├── candidateTransformers.ts              (NEW - AI content generation)
└── pipelineActions.ts                    (NEW - stage management)
```

### Component Props

#### CandidateVerdictCard
```typescript
interface CandidateVerdictCardProps {
  candidate: CandidateBrief;
  onExpand: (id: string) => void;
  onMoveToInterview: (id: string) => void;
  onReject: (id: string) => void;
  compact?: boolean;  // For kanban view
}
```

#### CandidateFullEvidence
```typescript
interface CandidateFullEvidenceProps {
  candidate: CandidateBrief;
  onClose: () => void;
  onMoveToInterview: (id: string) => void;
}
```

#### CandidatePipelineKanban
```typescript
interface CandidatePipelineKanbanProps {
  candidates: CandidateBrief[];
  onStageChange: (candidateId: string, newStage: PipelineStage) => void;
  onExpandCandidate: (id: string) => void;
  filters: CompanyCandidateFilters;
}
```

### Data Transformation Pipeline

```typescript
// lib/candidateTransformers.ts

export const generateVerdict = (whyHireSummary: string): Verdict => {
  // Use LLM or regex to extract:
  // - Hire level (junior, mid, senior, strong, weak)
  // - Confidence (high, medium, low) + source
  // - Reasoning (1-2 sentences)
};

export const generateFitSnapshot = (matchAnalysis: MatchAnalysis): FitSnapshot => {
  // Take top 3 fit_areas → strong_fits
  // Take top 3 gaps → needs_validation
  // Condense to short phrases
};

export const generateExperienceSummary = (
  experiences: RealWorldExperience[]
): string[] => {
  // Transform work history into 3 outcome bullets
  // Focus on: systems built, performance impact, scale
};

export const generateWorkSimulationSummary = (
  details: AssessmentDetails
): string[] => {
  // Create 4 bullets:
  // - Time + difficulty
  // - Code quality (qualitative)
  // - Testing approach
  // - Style observations
};

export const generateInterviewFocus = (
  unprovenClaims: UnprovenClaim[]
): string[] => {
  // Take top 3 unproven claims
  // Format: "{Topic} ({source})"
  // Example: "ML project depth (self-reported)"
};

export const transformCandidateToVerdictCard = (
  candidate: CandidateBrief
): CandidateBrief => {
  return {
    ...candidate,
    verdict: generateVerdict(candidate.why_hire_summary),
    fit_snapshot: generateFitSnapshot(candidate.match_analysis),
    verified_experience_summary: generateExperienceSummary(
      candidate.real_world_experience
    ),
    work_simulation_summary: generateWorkSimulationSummary(
      candidate.assessment_details
    ),
    interview_focus: generateInterviewFocus(candidate.unproven_claims),
  };
};
```

## Implementation Checklist

### Week 1: Data & Transformers
- [ ] Add new fields to `CandidateBrief` interface
- [ ] Create `candidateTransformers.ts` with generation functions
- [ ] Transform mock data to include condensed fields
- [ ] Test transformations with all mock candidates

### Week 2: Core Components
- [ ] Build `CandidateVerdictCard.tsx` (condensed view)
- [ ] Build `FitSnapshot.tsx` (two-column display)
- [ ] Build `PipelineStageIndicator.tsx` (progress bar)
- [ ] Test components in isolation (Storybook if available)

### Week 3: Evidence & Expansion
- [ ] Build `CandidateFullEvidence.tsx` (expanded view)
- [ ] Add modal/panel system for expansion
- [ ] Wire up "View Full Evidence" → "Back to Summary" flow
- [ ] Test expansion/collapse interactions

### Week 4: Pipeline & Kanban
- [ ] Build `CandidatePipelineKanban.tsx` (board view)
- [ ] Build `PipelineStageColumn.tsx` (column component)
- [ ] Add drag-and-drop functionality (react-beautiful-dnd or @dnd-kit)
- [ ] Wire up stage change actions
- [ ] Add pipeline stage filter to filter bar

### Week 5: Integration & Polish
- [ ] Integrate new components into `page.tsx`
- [ ] Add view mode toggle (kanban/list/focus)
- [ ] Update routing/state management
- [ ] Add animations and transitions
- [ ] Mobile responsiveness

### Week 6: AI & Testing
- [ ] Set up AI generation pipeline (if using real LLM)
- [ ] Batch-transform all existing candidate data
- [ ] User testing with hiring managers
- [ ] Gather feedback and iterate
- [ ] Performance optimization (virtualization for large lists)

## Next Steps
1. ✅ Design review (this doc)
2. ⬜ Get stakeholder approval on condensed format
3. ⬜ Implement data structure changes
4. ⬜ Build verdict card component
5. ⬜ Build full evidence component
6. ⬜ Build pipeline kanban view
7. ⬜ Generate AI summaries for existing data
8. ⬜ User testing with hiring managers
9. ⬜ Iterate based on feedback
