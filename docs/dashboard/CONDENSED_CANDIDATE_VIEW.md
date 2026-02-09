# Condensed Candidate View - Implementation Guide

## The 75% Reduction Formula

### Current Problem
- **500+ words** per candidate
- **5+ minutes** to evaluate
- Resume flex prioritized over hiring signal
- No clear decision path
- Overwhelming for model-to-model aggregation

### Solution
- **~125 words** per candidate (75% reduction)
- **30 seconds** to evaluate
- Signal-first, no flex
- Clear verdict → action path
- Scannable for AI and humans

---

## The Condensed Format (Default View)

```
┌────────────────────────────────────────────────────────────┐
│ [95] 🟢  Candidate A • Software Engineer • 4yrs            │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ VERDICT                                                    │
│ Strong junior-to-mid backend hire                         │
│ Confidence: High (verified production impact)             │
│ Why: Proven production backend experience at Series A     │
│ fintech, strong Python fundamentals, and excellent        │
│ debugging discipline. Likely to contribute quickly in     │
│ structured org.                                            │
│                                                             │
│ FIT SNAPSHOT                                               │
│ Strong Fits               Needs Validation                │
│ • Backend Python          • ML in production              │
│ • Production readiness    • Distributed systems           │
│ • High code quality bar   • Leadership scope              │
│                                                             │
│ WORK SIMULATION RESULT                                     │
│ • Completed in 45 minutes (medium difficulty)             │
│ • Code quality: Excellent                                  │
│ • Testing: Strong coverage with edge cases handled        │
│ • Style: Clean abstractions, documentation-first          │
│                                                             │
│ VERIFIED PRODUCTION EXPERIENCE                             │
│ • Built and operated backend systems handling real money  │
│ • Improved system performance materially (latency ↓ 60%)  │
│ • Shipped production code used by large user bases        │
│                                                             │
│ AI TOOLING                                                 │
│ Heavy AI-assisted development using Copilot, Claude,      │
│ ChatGPT for boilerplate, debugging, and architecture.     │
│ Demonstrates strong prompt literacy and tool judgment.    │
│                                                             │
│ SUGGESTED INTERVIEW FOCUS                                  │
│ • ML project depth (self-reported)                        │
│ • Distributed systems fundamentals                        │
│ • Leadership claims and scope                             │
│                                                             │
│ Pipeline: [●───○───○] Review → Interview → Decision       │
│                                                             │
│ [ View Full Evidence → ]  [ ➡️ Move to Interview ]       │
└────────────────────────────────────────────────────────────┘
```

**Total: ~125 words, 6 sections, 2 CTAs**

---

## Section Breakdown

### 1. VERDICT (3 lines) - Replaces "Why Hire"
```
VERDICT
Strong junior-to-mid backend hire
Confidence: High (verified production impact)
Why: [1-2 sentences of reasoning]
```
**Rules:**
- No FAANG flex
- No salary flex
- Just: hire level + confidence + why
- Focus on contribution potential, not credentials

### 2. FIT SNAPSHOT (6 bullets) - Replaces "Match Analysis"
```
FIT SNAPSHOT
Strong Fits               Needs Validation
• [3 proven strengths]    • [3 areas to probe]
```
**Rules:**
- Two columns, 3 bullets each
- No checkmarks, no drama
- Scannable in 5 seconds
- Proven on left, unproven on right

### 3. WORK SIMULATION RESULT (4 bullets) - Replaces "Assessment Highlights"
```
WORK SIMULATION RESULT
• Time + difficulty level
• Code quality (qualitative)
• Testing approach
• Style observations
```
**Rules:**
- Quality over metrics
- No score flex (95/100 → "Excellent")
- Focus on approach, not numbers

### 4. VERIFIED PRODUCTION EXPERIENCE (3 bullets) - Replaces "Work History"
```
VERIFIED PRODUCTION EXPERIENCE
• [Outcome 1: systems built]
• [Outcome 2: performance impact]
• [Outcome 3: scale/reach]
```
**Rules:**
- Outcomes, not resume bullets
- No company names/dates (in summary)
- Evidence lives behind "View Full Evidence"

### 5. AI TOOLING (3 lines) - Condensed from detailed breakdown
```
AI TOOLING
[Usage pattern] using [tools] for [use cases].
Demonstrates [skill level] and [judgment quality].
```
**Rules:**
- Keep this section (it's differentiated)
- Simplify from bullet list to paragraph
- Focus on literacy and judgment

### 6. SUGGESTED INTERVIEW FOCUS (3 bullets) - Replaces scattered prompts
```
SUGGESTED INTERVIEW FOCUS
• [Topic 1 (source)]
• [Topic 2 (source)]
• [Topic 3 (source)]
```
**Rules:**
- Areas to probe, not full questions
- Include source in parens: "(self-reported)"
- Full question bank behind "View Full Evidence"

---

## The "View Full Evidence" Expansion

When user clicks "View Full Evidence →", show:

### Full Evidence Sections (Collapsible)
1. **Engineering Signal (Verified)** ▼
   - Detailed GitHub breakdown
   - Language percentages with bars
   - Quality score + percentile
   - Commit patterns analysis

2. **Detailed Work History** ▼
   - Full company names, dates
   - All achievements with metrics
   - $10M, FAANG, etc. live here

3. **Full Assessment Breakdown** ▼
   - All metrics (95/100, 87% coverage)
   - Detailed approach notes
   - Edge cases handled
   - Time complexity analysis

4. **Detailed AI Usage** ▼
   - All tools listed
   - Usage frequency breakdown
   - Full use case list
   - Prompt engineering examples

5. **Proven Claims (Evidence-Backed)** ▼
   - Each claim + source
   - Confidence level
   - Supporting evidence details

6. **Interview Questions (Auto-Generated)** ▼
   - Full question bank (not just topics)
   - 2-3 questions per unproven area
   - Context for each question

**Navigation:**
- [ ← Back to Summary ] button at top
- All sections start collapsed
- Progressive disclosure

---

## Pipeline Kanban View

```
NEW (4)              REVIEWING (2)       INTERVIEW (3)      INTERVIEWED (1)
┌──────────────┐    ┌──────────────┐    ┌──────────────┐   ┌──────────────┐
│[95] 🟢       │    │[87] 🟢       │    │[92] 🟢       │   │[78] 🔵       │
│Candidate A   │    │Candidate D   │    │Candidate B   │   │Candidate G   │
│4yrs          │    │3yrs          │    │6yrs          │   │2yrs          │
│              │    │              │    │              │   │              │
│Strong jr-mid │    │Mid-level ML  │    │Senior backend│   │Junior full-  │
│backend hire  │    │hire          │    │hire          │   │stack         │
│              │    │              │    │              │   │              │
│High conf.    │    │Medium conf.  │    │High conf.    │   │Med. conf.    │
│              │    │              │    │              │   │              │
│[Review]      │    │[Evidence]    │    │Scheduled:    │   │[Decide]      │
│              │    │              │    │Feb 12, 2pm   │   │              │
└──────────────┘    └──────────────┘    └──────────────┘   └──────────────┘

Drag cards between columns to move through pipeline
Click card to expand to full evidence
```

**Benefits:**
- Visual pipeline progression
- Clear next actions per stage
- Easy to see where candidates are stuck
- Drag-to-move for quick triage

---

## Content Transformation Rules

### Verdict Generation (from Why Hire)
**Input:** Long paragraph with flex
```
Former FAANG intern who went on to build payment systems handling
$10M+ monthly at a Series A fintech—Candidate A has the production
backend credibility to contribute immediately at Palantir...
```

**Output:** 3 lines
```
Strong junior-to-mid backend hire
Confidence: High (verified production impact)
Why: Proven production backend experience at Series A fintech,
strong Python fundamentals, and excellent debugging discipline.
```

**Transformation:**
1. Extract hire level from context clues
2. Determine confidence from verification level
3. Condense reasoning to 1-2 sentences
4. Remove all flex (FAANG, $10M, Palantir)

### Experience Summarization (from Work History)
**Input:** Full resume bullets
```
Backend Engineer • Series A Fintech Startup • 2 years • Verified
→ Built payment reconciliation system processing $10M+ monthly
→ Reduced API latency by 60% through strategic caching
→ Implemented fraud detection pipeline catching 95% of fraudulent transactions

Software Engineering Intern • FAANG Company • 3 months • Verified
→ Shipped feature to 100M+ users
→ Collaborated with cross-functional team of 8 engineers
```

**Output:** 3 outcome bullets
```
• Built and operated backend systems handling real money flows
• Improved system performance materially (latency ↓ 60%)
• Shipped production code used by large user bases
```

**Transformation:**
1. Remove company names and dates
2. Generalize specific metrics ("$10M+" → "real money")
3. Focus on outcomes and impact
4. Keep quantified improvements when material
5. Full details behind "View Full Evidence"

### Fit Snapshot (from Match Analysis)
**Input:** Detailed fit areas and gaps
```
Strengths (5)
✓ 4+ years Python experience (matches Palantir stack)
✓ Deep problem-solving mindset shown in assessment
✓ High code quality standards align with Palantir values
✓ Production backend systems experience
✓ Full-stack capability (React + Python)

Gaps (3)
! No ML production experience verified
! Limited distributed systems exposure
! Leadership claims need exploration in interview
```

**Output:** 6 bullets
```
Strong Fits               Needs Validation
• Backend Python          • ML in production
• Production readiness    • Distributed systems
• High code quality bar   • Leadership scope
```

**Transformation:**
1. Take top 3 strengths → Strong Fits
2. Take top 3 gaps → Needs Validation
3. Remove checkmarks and company references
4. Condense to 2-4 words per bullet
5. No explanations (those go in full evidence)

---

## Implementation Priority

### Phase 1: Verdict Card Component (Week 1-2)
- Build the condensed default view
- 6 sections + 2 CTAs
- No expansion yet, just static condensed view
- Test with hiring managers for feedback

### Phase 2: Full Evidence Expansion (Week 3)
- Build the expansion panel
- Wire up "View Full Evidence" → "Back to Summary"
- Collapsible sections
- Test navigation flow

### Phase 3: Pipeline Kanban (Week 4)
- Build kanban board layout
- Add drag-and-drop
- Wire up stage changes
- Test pipeline flow

### Phase 4: AI Generation (Week 5-6)
- Build transformation functions
- Batch-process existing data
- Test quality of generated summaries
- Iterate on prompts/rules

---

## Success Metrics

### Time to Decision
- **Current:** ~5+ minutes per candidate
- **Target:** ~30 seconds per candidate
- **Improvement:** 90% reduction

### Content Volume
- **Current:** ~500 words per candidate
- **Target:** ~125 words per candidate
- **Improvement:** 75% reduction

### Decision Confidence
- **Measure:** Survey hiring managers
- **Target:** "I have enough information to make a decision"
- **Success:** >80% agreement

### Action Rate
- **Measure:** % of candidates moving to next stage
- **Target:** Increase by 2x
- **Hypothesis:** Clearer signal → more confident decisions

---

## Visual Principles

### Typography
- **Headers:** Bold, uppercase, 12px
- **Body:** Regular, sentence case, 14px
- **Metrics:** Medium weight, 16px

### Color Coding
- **Match Score:** Green (85+), Blue (70-84), Red (<70)
- **Strong Fits:** Green text or green dot
- **Needs Validation:** Yellow text or yellow dot
- **Verified:** Green checkmark
- **Unverified:** Yellow question mark

### Spacing
- **Section spacing:** 16px between sections
- **Bullet spacing:** 8px between bullets
- **Card padding:** 20px all around

### Interactions
- **Expand button:** Animated arrow (→ on hover)
- **Drag cards:** Subtle shadow on drag
- **Stage transitions:** Smooth 200ms ease

---

## FAQ for Developers

**Q: Where does the FAANG/salary flex go?**
A: Into the "Detailed Work History" section behind "View Full Evidence"

**Q: Do we delete the old data?**
A: No! Old data is preserved and shown in the expansion. We just add condensed fields.

**Q: How do we generate the condensed content?**
A: Use transformation functions (can be LLM-powered or rule-based) to extract key points.

**Q: What if a candidate doesn't have all 6 sections?**
A: Show what's available. Missing sections are hidden (e.g., no assessment → no work simulation section).

**Q: Can hiring managers customize what shows in condensed view?**
A: v1: No. v2: Maybe allow toggling sections, but keep default condensed.

**Q: How does this work on mobile?**
A: Stack sections vertically, full width cards. Kanban becomes horizontal scroll.

---

## Next Steps

1. Review this doc with team
2. Get approval on condensed format
3. Start with Phase 1: Verdict Card
4. Iterate based on hiring manager feedback
5. Roll out pipeline view
6. Add AI generation last (can start with manual transformations)
