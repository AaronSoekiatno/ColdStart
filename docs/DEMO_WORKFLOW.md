# ProofHire Company Onboarding Demo Workflow

This document outlines the complete demo workflow for showcasing ProofHire's company onboarding, DNA capture, and candidate matching capabilities.

## Overview

The demo demonstrates three core capabilities:
1. **Deep Company DNA Understanding** - Capturing company culture, pace, quality bar, and priorities
2. **Codebase-Driven Assessment Generation** - Using company code to generate relevant challenges
3. **Evidence-Based Candidate Matching** - Matching candidates based on proven skills and cultural fit

---

## Demo Flow

### Step 1: Company Landing Page
**URL:** `/` (root)

**What to Show:**
- Clean landing page showcasing ProofHire's value proposition
- "Get Started" or "Request Access" button

**Key Points:**
- "We analyze code, not resumes"
- "Find engineers who match your DNA"
- Fast, evidence-based matching

---

### Step 2: Company Basic Info Form
**URL:** `/company-form`

**What to Capture:**

**Phase 1: Company Basics**
- Company Name (e.g., "Acme Technologies")
- Website (e.g., "https://acme.tech")

**Phase 2: Hiring Role**
- Job Description (e.g., "Senior Full-Stack Engineer to build our core product. Need someone who can move fast, write clean code, and owns features end-to-end.")
- OR Upload Job Posting (PDF/DOCX)

**Phase 3: Final Details**
- Location (e.g., "SF / Remote")
- Team Size (e.g., "11-50")

**Demo Script:**
> "First, we collect basic company information. This takes less than 2 minutes. Notice how we're not asking for laundry lists of required skills - we'll understand what you need through a different approach."

**Result:** Redirects to Founder Interview

---

### Step 3: Founder Interview (DNA Capture)
**URL:** `/founder-interview`

**What to Capture:**

#### Question 1: Pace
**Question:** "How fast do you ship?"

**Options:**
- ⚡ **Fast** - "Ship daily, move quickly, iterate fast. Done is better than perfect."
- 📈 **Moderate** - "Balanced pace. Ship weekly, thoughtful but not slow."
- 🛡️ **Deliberate** - "Thorough planning, careful execution. Quality takes time."

**Demo Choice:** Select **Fast** or **Deliberate** based on the narrative you want

#### Question 2: Quality Bar
**Question:** "What's your quality bar?"

**Options:**
- 🛡️ **High Quality Bar** - "Rigorous code review, comprehensive testing, clean architecture."
- 🎯 **Balanced Approach** - "Good quality with pragmatic tradeoffs."
- ⚡ **Move Fast & Break Things** - "Speed over perfection. Ship quickly, fix in production."

**Demo Choice:** Select **High Quality Bar** for enterprises or **Balanced** for startups

#### Question 3: Priorities
**Question:** "What do you value most?"

**Options (select multiple):**
- 🎯 Ownership
- 📈 Impact
- 🏆 Quality
- 🚀 Autonomy
- 👥 Growth
- ⚡ Innovation

**Demo Choice:** Select 3-4 that tell a story (e.g., Ownership + Quality + Autonomy = "We want engineers who own complex problems")

#### Question 4: Culture Description
**Question:** "Describe your culture"

**Demo Example:**
```
"We're building infrastructure that powers the modern internet. We value engineers who
think deeply about system design, aren't afraid of complexity, and take extreme ownership
of their work. We move deliberately because our code needs to be bulletproof - it runs in
production at massive scale. We're looking for builders who care about craft and want to
solve hard, meaningful problems."
```

**Key Points:**
- Should be 50+ characters (enforced)
- Should reflect the answers from Q1-Q3
- Should feel authentic, not generic

#### Question 5: Codebase Ingestion
**Question:** "Share your codebase (optional)"

**Options:**
- 🔗 **Connect GitHub Repository** - "We'll analyze your codebase patterns, tech stack, and complexity"
  - Input: GitHub URL (e.g., `https://github.com/your-company/your-repo`)
- 📤 **Upload Code Sample** - (Coming soon badge)
- 🎯 **Skip for Now** - "Use our standard assessment"

**Demo Choice:**
- For impressive demo: **Connect GitHub** and enter a real repo URL
- For quick demo: **Skip for Now**

**Demo Script:**
> "This is where ProofHire becomes unique. We can analyze your actual codebase to generate
> assessments that mirror your real work. If you're hiring a backend engineer, we'll
> generate a challenge that uses your architecture patterns, your complexity level, your
> coding conventions. Candidates aren't doing generic LeetCode - they're showing they can
> do *your* work."

**Result:** Shows success message, redirects to Company Dashboard

---

### Step 4: Company Dashboard
**URL:** `/company-dashboard`

The dashboard has **3 tabs** to showcase different aspects:

#### Tab 1: Company Profile
**What to Show:**
- Company logo, name, website
- Location and team size
- **Operating Model Card** displaying:
  - Pace indicator (with icon)
  - Quality bar (color-coded)
  - Key priorities (as badges)
  - Culture description (in quotes)

**Demo Script:**
> "Here's your company DNA captured in a structured format. This isn't just stored text -
> it's a computational model that we use to match candidates. Every candidate is scored
> against these specific dimensions."

#### Tab 2: Assessment
**What to Show:**

**Two Sub-tabs:**

1. **Overview Tab:**
   - Assessment status (Custom vs Standard)
   - If GitHub connected: Shows repo URL and "Custom Assessment Generated" badge
   - Duration: 20 minutes
   - Evaluation criteria breakdown (40% Backend, 40% Frontend, 20% Real-time)
   - Challenge description (customized if codebase provided)
   - Artifacts collected (diffs, tests, coverage, etc.)

2. **Candidate View Tab:**
   - Preview of what candidates see
   - Assessment briefing card
   - Time limit, scoring, challenge type
   - "Start Assessment" button (preview only)

**Demo Script:**
> "Companies can see exactly what assessment candidates will take. If we connected your
> GitHub repo, you'll see that the challenge is tailored to your stack. Candidates don't
> know this is customized - they just see a relevant, realistic coding challenge. But on
> the backend, we're testing for the patterns *you* use, at the complexity level *you*
> need."

#### Tab 3: Candidates
**What to Show:**
- List of 8 mock matched candidates
- Match scores (78-92%)
- Two view modes: Table and Cards

**For Each Candidate, Show:**

**Proven Claims (with evidence):**
- "Active Python contributor (18+ months)" - GitHub analysis
- "Strong debugger (15+ bug fixes)" - GitHub commits
- "Production-ready code quality" - Assessment score 95%

**Unproven Claims (become interview questions):**
- "Machine Learning experience" → "Can you walk me through a recent ML project?"
- "Led a team of 3 engineers" → "Tell me about your leadership experience"

**GitHub Analysis:**
- Top languages with percentages
- Quality score
- Active months
- Meaningful projects

**Match Analysis:**
- **Fit Areas:** "4+ years Python matches your stack", "High code quality aligns with your values"
- **Gaps:** "No ML production experience verified", "Leadership claims need exploration"

**Demo Script:**
> "Notice we distinguish between *proven* and *unproven* claims. Proven claims are backed
> by deterministic evidence - we've seen the GitHub commits, we've graded the assessment,
> we've verified the resume against LinkedIn. Unproven claims become structured interview
> questions. This is the 'fail-closed' approach - we never guess, we only state what we
> can prove."

**Key Insight to Highlight:**
> "The match score isn't just 'do they have Python experience' - it's 'do they have
> Python experience *at your quality bar*, do they ship *at your pace*, do they value
> *your priorities*.' Model-to-model matching."

---

## Key Demo Talking Points

### 1. Model-to-Model Matching (The Vision)
- "We're building toward a future where companies and candidates are both represented as computational models"
- "Today: keyword matching on resumes. Tomorrow: embedding similarity in a learned space."
- "Every hire teaches the system - we learn what actually predicts success at your company"

### 2. Evidence Over Claims
- "Traditional hiring: 'I have 5 years of Python' → Hire → 6 months later: 'not a culture fit'"
- "ProofHire: We test for pace, quality bar, problem-solving style, communication - the things that actually matter"
- "If a candidate says they're a strong debugger, we show you the commits where they debugged. If they say they led a team, that becomes an interview question."

### 3. Codebase-Driven Assessments
- "Generic coding challenges test puzzle-solving, not real work"
- "We analyze your codebase and generate challenges that mirror your actual architecture"
- "Candidates who score well are candidates who can actually do *your* work, not just LeetCode"

### 4. Fail-Closed System (Legal Defensibility)
- "Every hiring decision can be audited - we never make discriminatory inferences"
- "Everything traces back to evidence: this commit, that test result, this code quality metric"
- "Built for EEOC compliance from day one"

---

## Demo Variations

### For Technical Audience (Engineers, CTOs)
- Deep dive into the assessment generation
- Show code quality metrics, test coverage graphs
- Emphasize model-to-model matching and embedding space
- Talk about the artifact collection pipeline

### For HR/Recruiting Audience
- Focus on time saved (no more resume screening)
- Emphasize fairness and bias reduction
- Show the structured interview questions generated
- Highlight candidate experience (modern, developer-friendly)

### For Founders/Executives
- Focus on quality of hire and cultural fit
- Show how DNA capture prevents mis-hires
- Emphasize scalability (instant matching once model exists)
- ROI: fewer mis-hires = massive cost savings

---

## Technical Implementation Notes

### Files Modified/Created:
1. `/supabase/migrations/004_add_operating_model.sql` - Database schema
2. `/app/founder-interview/page.tsx` - 5-step DNA capture flow
3. `/app/company-form/page.tsx` - Updated to redirect to founder interview
4. `/app/company-dashboard/page.tsx` - Added tabs (Profile, Assessment, Candidates)
5. `/components/company/AssessmentPreview.tsx` - Assessment preview component
6. `/lib/mockCompanyData.ts` - Updated with github_repo_url and codebase_provided fields

### Database Schema:
```sql
ALTER TABLE startups
ADD COLUMN operating_model JSONB DEFAULT '{
  "pace": null,
  "quality_bar": null,
  "priorities": [],
  "culture_description": null,
  "github_repo_url": null,
  "codebase_provided": false
}'::jsonb;
```

### Future Enhancements (Beyond Demo):
- Actual GitHub API integration for codebase analysis
- Real candidate matching algorithm (currently uses mock data)
- Dynamic assessment generation from codebase patterns
- Outcome feedback loop (track which candidates succeeded)
- Company model fine-tuning over time

---

## Troubleshooting

**Issue:** Founder interview not saving data
- Check Supabase migration ran successfully
- Verify `operating_model` column exists on `startups` table

**Issue:** Assessment tab not showing
- Ensure `github_repo_url` and `codebase_provided` fields exist in mock data
- Check console for TypeScript errors

**Issue:** Dashboard shows "No company profile found"
- Company must complete both company-form AND founder-interview
- Check that `founder_emails` field matches logged-in user

---

## Demo Success Metrics

A successful demo should convey:
1. ✅ Company DNA is captured in a structured, computational format
2. ✅ Assessments can be customized based on company codebase
3. ✅ Candidate matching is evidence-based, not keyword-based
4. ✅ The system is fair, explainable, and legally defensible
5. ✅ This approach is fundamentally different from all existing hiring tools

---

*Last Updated: February 2026*
*Document Version: 1.0*
