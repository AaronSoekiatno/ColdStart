# Quick Start: Company Onboarding Demo

## What Was Built

A complete company onboarding workflow that captures "company DNA" and demonstrates ProofHire's unique value proposition:

✅ **5-Step Founder Interview** - Captures pace, quality bar, priorities, culture, and codebase
✅ **Codebase Integration** - Option to connect GitHub repo for custom assessments
✅ **Company Dashboard with 3 Tabs** - Profile, Assessment Preview, Matched Candidates
✅ **Assessment Preview** - Shows what candidates will experience
✅ **Database Schema** - Stores operating model as structured JSONB

---

## Demo in 5 Minutes

### 1. Start the App
```bash
cd /Users/aidannguyen/Downloads/Hermes
npm run dev
```

### 2. Navigate to Company Form
- Go to `http://localhost:3000/company-form`
- Fill in company details (3 phases, takes ~1 minute)

### 3. Complete Founder Interview
- You'll be auto-redirected to `/founder-interview`
- Answer 5 questions about your company DNA:
  - **Q1:** Pace (Fast/Moderate/Deliberate)
  - **Q2:** Quality Bar (High/Balanced/Move Fast)
  - **Q3:** Priorities (select 2-4)
  - **Q4:** Culture description (50+ chars)
  - **Q5:** GitHub repo (optional)

### 4. View Company Dashboard
- Auto-redirected to `/company-dashboard`
- **Profile Tab:** See your DNA displayed
- **Assessment Tab:** Preview what candidates will do
- **Candidates Tab:** Browse 8 matched candidates with proven/unproven claims

---

## Key Demo Talking Points

### What Makes This Unique

**Traditional Hiring:**
```
Job Description → Resume Screening → Interview → Hire → "Not a culture fit"
     ⬇️                ⬇️                ⬇️           ⬇️
  Keywords         Guesswork        Inconsistent   Expensive
```

**ProofHire:**
```
Company DNA → Codebase Analysis → Custom Assessment → Evidence Brief
     ⬇️              ⬇️                    ⬇️                ⬇️
  Structured    Relevant Tests      Real Work        Proven Skills
```

### The "Aha" Moments

1. **Model-to-Model Matching**
   > "We're not matching keywords - we're comparing company culture vector to candidate behavior vector"

2. **Codebase-Driven Assessments**
   > "The challenge isn't generic - it uses YOUR patterns, YOUR complexity, YOUR conventions"

3. **Proven vs Unproven**
   > "We never guess. If we can't prove it, we explicitly mark it as an interview question"

4. **Fail-Closed System**
   > "Every decision traces to evidence. No discriminatory inference. EEOC compliant by design."

---

## Files Created/Modified

```
📁 /supabase/migrations/
  └── 004_add_operating_model.sql          [NEW] Database schema

📁 /app/
  ├── founder-interview/page.tsx           [NEW] 5-step DNA capture
  └── company-form/page.tsx                [MODIFIED] Redirect to interview
  └── company-dashboard/page.tsx           [MODIFIED] Added tabs

📁 /components/company/
  └── AssessmentPreview.tsx                [NEW] Assessment preview component

📁 /lib/
  └── mockCompanyData.ts                   [MODIFIED] Added github fields

📁 /docs/
  ├── DEMO_WORKFLOW.md                     [NEW] Detailed demo guide
  └── QUICK_START_DEMO.md                  [NEW] This file
```

---

## Database Migration

Run this once to update your schema:

```bash
# If using Supabase CLI
supabase migration up

# Or apply manually in Supabase SQL Editor:
# Copy contents of supabase/migrations/004_add_operating_model.sql
```

---

## Mock Data Reference

The dashboard uses `mockCompany` from `/lib/mockCompanyData.ts`:

```typescript
{
  name: "Palantir Technologies",
  operating_model: {
    pace: "deliberate",
    quality_bar: "high",
    priorities: ["ownership", "impact", "quality", "autonomy"],
    culture_description: "Build software that solves...",
    github_repo_url: "https://github.com/palantir/osquery",
    codebase_provided: true
  }
}
```

8 mock candidates with match scores (78-92%), proven claims, GitHub analysis, and fit areas.

---

## Next Steps (Beyond Demo)

To make this production-ready:

1. **GitHub Integration**
   - Implement actual repo cloning and analysis
   - Use tree-sitter or AST parsing for code patterns
   - Extract complexity metrics and conventions

2. **Assessment Generation**
   - Use LLM to generate company-specific challenges
   - Dynamically scaffold code based on patterns
   - Calibrate difficulty to company codebase

3. **Real Matching Algorithm**
   - Replace mock data with actual database queries
   - Implement similarity scoring (cosine similarity in embedding space)
   - Add outcome feedback loop

4. **Company Model Fine-tuning**
   - Track which candidates succeed/fail
   - Update company model based on hiring outcomes
   - Improve matching over time

---

## Questions or Issues?

**Q: Dashboard shows "No company profile found"**
A: Make sure you completed BOTH company-form AND founder-interview. The system looks for a startup where `founder_emails` matches your logged-in email.

**Q: Assessment tab not rendering**
A: Check browser console for errors. Ensure `github_repo_url` and `codebase_provided` fields exist in the company data.

**Q: Want to reset and try again?**
A: Delete the startup entry from your database, or log in with a different email.

---

**Ready to demo?** Start at `/company-form` and follow the flow! 🚀
