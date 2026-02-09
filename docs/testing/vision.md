# Agencity: Product Document

**Version:** 1.0
**Date:** February 2026
**Status:** Pre-Development Feasibility Review
**Authors:** [Team]

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Core Concepts](#4-core-concepts)
5. [Technical Architecture](#5-technical-architecture)
6. [System Components](#6-system-components)
7. [Data Architecture](#7-data-architecture)
8. [RL Training Pipeline](#8-rl-training-pipeline)
9. [External Dependencies](#9-external-dependencies)
10. [Feasibility Analysis](#10-feasibility-analysis)
11. [Risk Assessment](#11-risk-assessment)
12. [Development Phases](#12-development-phases)
13. [Success Metrics](#13-success-metrics)
14. [Open Questions](#14-open-questions)

---

## 1. Executive Summary

### What is Agencity?

Agencity is a **proactive AI hiring agent** that:
- Lives where founders work (Slack, Teams, WhatsApp)
- Continuously monitors the talent market and company codebase
- Finds candidates who match specific company gaps
- Evaluates them with provable evidence (not vibes)
- Surfaces pre-evaluated candidates before founders ask
- Uses RL-trained reasoning to construct proof chains, not keyword matches

### One-Liner

> "An always-on hiring agent that finds, evaluates, and surfaces candidates with proof—before you ask."

### Core Innovation

1. **Company Model** — An executable evaluator calibrated to each company's specific hiring bar
2. **RL-Trained Reasoning** — Actor-critic training that teaches the model to reason through evidence, not pattern match
3. **Proof Briefs** — Every claim is PROVED (with evidence links) or UNPROVED (with interview questions)
4. **Proactive Operation** — Agent monitors and alerts, doesn't wait for queries

### Target User

Seed to Series B startup founders/CTOs who:
- Spend 30-40% of their time on hiring
- Don't have a dedicated recruiting team
- Need every hire to be high-impact
- Value evidence over intuition

---

## 2. Problem Statement

### 2.1 The Hiring Problem for Startups

| Problem | Impact |
|---------|--------|
| **Time sink** | Founders spend 30-40% of time on hiring activities |
| **Sourcing inefficiency** | Hours scrolling LinkedIn, missing great candidates |
| **Evaluation inconsistency** | "Culture fit" = vibes, different interviewers give different verdicts |
| **Speed mismatch** | Great candidates gone in 10 days; typical startup takes 30+ |
| **No learning** | Same bad hire patterns repeated; no institutional memory |
| **Generic tools** | ATS = filing cabinet; assessments = one-size-fits-all |

### 2.2 Why Current Solutions Fail

**Applicant Tracking Systems (Lever, Greenhouse, Ashby)**
- Passive filing cabinets
- No sourcing capability
- No evaluation intelligence
- No company-specific calibration

**Recruiters ($25-40K per hire)**
- Expensive for early-stage startups
- Still vibes-based evaluation
- No learning across hires
- Not always available when needed

**AI Resume Screeners**
- Black-box scoring
- Pattern matching, not reasoning
- No evidence links
- Bias amplification concerns

**Assessment Platforms (HackerRank, CodeSignal)**
- Generic tests, not calibrated to company
- Output a score, not proof
- No gap analysis
- No interview guidance

### 2.3 The Core Insight

The best hiring decisions are made by people who:
1. **Know the company's specific bar** (not generic "best practices")
2. **Reason through evidence** (not pattern match on keywords)
3. **Acknowledge what they don't know** (UNPROVED → interview questions)
4. **Move fast when timing matters** (proactive, not reactive)

**Agencity encodes this into an AI agent.**

---

## 3. Solution Overview

### 3.1 The Agencity Agent

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENCITY AGENT                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ OBSERVE  │───►│  REASON  │───►│  PROVE   │───►│   ACT    │      │
│  │          │    │          │    │          │    │          │      │
│  │ Codebase │    │ RL-train │    │ Evidence │    │ Alert in │      │
│  │ Market   │    │ reasoning│    │ chains   │    │ Slack    │      │
│  │ Team     │    │          │    │          │    │          │      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
│       ▲                                               │             │
│       │                                               │             │
│       └───────────────────────────────────────────────┘             │
│                         CONTINUOUS LOOP                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 What It Does

1. **OBSERVE** (Continuous)
   - Monitor company GitHub for gaps (test coverage, tech debt, knowledge silos)
   - Track talent market signals (LinkedIn, GitHub, layoff feeds, "open to work")
   - Detect timing opportunities (candidate just posted, company just laid off)

2. **REASON** (RL-Trained)
   - Construct reasoning chains from evidence to claims
   - Apply Company Model as evaluation context
   - Distinguish "no evidence" from "negative evidence"

3. **PROVE** (Deterministic)
   - Every claim linked to artifacts (diffs, repos, profiles)
   - PROVED claims have evidence links
   - UNPROVED claims become interview questions
   - Fail-closed: no proof = no claim

4. **ACT** (Proactive)
   - Push alerts to Slack/Teams when timing matters
   - Surface pre-evaluated Proof Briefs
   - Generate interview guides from unproved claims
   - No dashboard to check—agent comes to you

### 3.3 Key Outputs

**Proof Brief** — The primary deliverable
```
┌─────────────────────────────────────────────────────────────────┐
│ PROOF BRIEF: Sarah Chen                                         │
│ Role: Backend Engineer | Proof Rate: 78%                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ✅ PROVED CLAIMS (Evidence Linked)                              │
│ ├─ Payments experience → 4 yrs Stripe, 200+ commits            │
│ ├─ Testing discipline → 85% coverage in her repos              │
│ ├─ Code review habits → 150+ reviews/year on GitHub            │
│ └─ Fast shipping → 2.3 PRs/week average                        │
│                                                                 │
│ ❓ UNPROVED CLAIMS (Interview Questions Generated)              │
│ ├─ Leadership potential → "Tell me about mentoring..."         │
│ └─ Startup adaptability → "How do you handle ambiguity?"       │
│                                                                 │
│ 🎯 GAP ANALYSIS                                                 │
│ ├─ ✅ Fills: Test coverage gap (your /payments at 31%)         │
│ ├─ ✅ Fills: Payments expertise gap                            │
│ └─ ❌ Doesn't fill: Kubernetes gap                             │
│                                                                 │
│ 📋 INTERVIEW PLAN: 30 min focused on leadership + startup fit  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Company Model** — Calibrated evaluation context
```yaml
company_model:
  stage: seed
  pace: high              # Ship speed expectations
  quality_bar: medium     # Testing/review rigor
  autonomy: high          # Self-direction expected
  risk_intolerance:
    - security
    - data_loss
  stack:
    - python
    - postgres
    - kubernetes
  codebase_gaps:
    - path: /payments
      issue: test_coverage
      current: 31%
      criticality: high
    - path: /billing
      issue: knowledge_silo
      sole_owner: "@sarah"
      bus_factor: 1
```

---

## 4. Core Concepts

### 4.1 Company Model

**Definition:** An executable evaluator calibrated to a specific company's hiring bar.

**Components:**
1. **Benchmark Policy** — What tasks to run, difficulty, timebox, allowed tools
2. **Evidence Policy** — What counts as proof, what's inadmissible
3. **Decision Support** — Gap analysis + interview plan generation

**Calibration Sources:**
- Founder interview (15 min) → pace, quality bar, autonomy expectations
- Codebase analysis (GitHub) → actual stack, gaps, patterns
- Exemplar PRs (optional) → what "good" looks like here
- Preference labels (optional) → pairwise comparisons for fine-tuning

**What It's NOT:**
- "Culture fit" detector
- Personality inference
- Black-box resume ranker
- Generic best practices

### 4.2 Proof-Directed Evaluation

**Principle:** Every claim must be either PROVED (with evidence) or explicitly marked UNPROVED (with follow-up actions).

**The Proof Chain:**
```
Evidence (artifact) → Claim (hypothesis) → Proof (verified) or Unproved (needs interview)
```

**Evidence Types:**
| Source | Evidence Extracted |
|--------|-------------------|
| GitHub repos | Commit patterns, test coverage, code review activity, language distribution |
| LinkedIn | Tenure, titles, company history, skills endorsed, recommendations |
| Resume | Education, experience claims, projects, certifications |
| Portfolio | Project complexity, documentation quality, code samples |
| Interview transcript | Communication signals, technical depth, problem-solving approach |

**Fail-Closed Design:**
- No evidence → UNPROVED (not hidden, not guessed)
- UNPROVED claims → Interview questions generated
- Every PROVED claim → Links to specific artifacts
- Full audit trail → Reproducible, defensible

### 4.3 RL-Trained Reasoning

**Problem with Pattern Matching:**
```
Traditional AI: "Resume has Python" → +10 points
               "5 years experience" → meets threshold
               No reasoning, no proof, no explanation
```

**Actor-Critic Reasoning:**
```
Actor: "This diff shows systematic debugging approach"
       "Test was added for the edge case"
       "Tests pass after fix"
       "→ Debugging skill PROVED"

Critic: "Reasoning chain valid"
        "Evidence supports each step"
        "But: no writeup artifact"
        "→ Communication claim UNPROVED"

Training: Model improves at constructing valid proof chains
```

**What RL Optimizes:**
- Construct reasoning chains (evidence → claim → proof)
- Distinguish "no evidence" from "negative evidence"
- Apply Company Model as context correctly
- Generate useful interview questions for unproved claims

**What RL Does NOT Do:**
- Decide who to hire (humans decide)
- Produce black-box scores
- Learn from biased historical data
- Invent signals without evidence

### 4.4 Proactive Operation

**Reactive (Traditional):**
```
Founder: "Find me backend engineers"
System: [searches] "Here are 500 results"
Founder: [spends 2 hours reviewing]
```

**Proactive (Agencity):**
```
Agencity @ 9:14 AM:
"I found someone who fills your top gap (payments + testing).
Sarah Chen — posted 'exploring opportunities' 6 hours ago.
Proof rate: 78%. Window: ~10 days.
[View Brief] [Reach Out] [Pass]"
```

**Proactive Triggers:**
- Candidate signals (posted "open to work", activity pattern change)
- Market events (layoffs at target companies)
- Company changes (codebase gap detected, team member departure risk)
- Timing windows (great candidate won't be available long)

---

## 5. Technical Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AGENCITY SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      AGENT LAYER (OpenClaw)                          │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │   │
│  │  │   Slack   │  │   Teams   │  │  WhatsApp │  │  Discord  │        │   │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘        │   │
│  │        └──────────────┼──────────────┼──────────────┘               │   │
│  │                       ▼                                              │   │
│  │              ┌─────────────────┐                                    │   │
│  │              │  Agent Gateway  │                                    │   │
│  │              │  (Routing +     │                                    │   │
│  │              │   Sessions)     │                                    │   │
│  │              └────────┬────────┘                                    │   │
│  └───────────────────────┼─────────────────────────────────────────────┘   │
│                          │                                                  │
│  ┌───────────────────────┼─────────────────────────────────────────────┐   │
│  │                       ▼         REASONING LAYER                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                    REASONING ENGINE                          │    │   │
│  │  │                   (RL Actor-Critic)                          │    │   │
│  │  │  ┌──────────┐    ┌──────────┐    ┌──────────┐               │    │   │
│  │  │  │  Actor   │───►│  Critic  │───►│  Output  │               │    │   │
│  │  │  │ (Propose)│    │(Evaluate)│    │ (Proof)  │               │    │   │
│  │  │  └──────────┘    └──────────┘    └──────────┘               │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                          │                                           │   │
│  │  ┌───────────────────────┼───────────────────────────────────────┐  │   │
│  │  │                       ▼         PROOF ENGINE                   │  │   │
│  │  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │  │   │
│  │  │  │ Evidence │──►│  Claims  │──►│  Rules   │──►│  Brief   │   │  │   │
│  │  │  │Extractors│   │Generator │   │ Engine   │   │ Builder  │   │  │   │
│  │  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘   │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                   │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐         │   │
│  │  │ Company  │   │Candidate │   │ Evidence │   │  Proof   │         │   │
│  │  │  Models  │   │  Pool    │   │  Store   │   │  Briefs  │         │   │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      INGESTION LAYER                                 │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐         │   │
│  │  │ LinkedIn │   │  GitHub  │   │  Layoff  │   │ Company  │         │   │
│  │  │   API    │   │   API    │   │  Feeds   │   │ Codebase │         │   │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Component Interaction Flow

```
1. INGESTION (Continuous)
   ├── GitHub API → Candidate repos, contribution patterns
   ├── LinkedIn API → Profiles, "open to work" signals
   ├── Layoff feeds → Timing opportunities
   └── Company GitHub → Codebase gaps, team patterns

2. CANDIDATE DETECTION (Event-Driven)
   ├── New signal detected (e.g., "open to work" post)
   ├── Match against Company Models
   └── If match score > threshold → trigger evaluation

3. EVALUATION (On-Demand)
   ├── Evidence Extractors → Gather all available evidence
   ├── Reasoning Engine → Construct proof chains
   ├── Proof Engine → Verify claims, mark PROVED/UNPROVED
   └── Brief Builder → Generate Proof Brief

4. DELIVERY (Proactive)
   ├── Determine urgency (timing window)
   ├── Select channel (Slack DM for urgent, digest for batch)
   └── Push alert with Proof Brief + actions
```

---

## 6. System Components

### 6.1 Agent Layer (OpenClaw Backbone)

**What:** Multi-channel AI agent infrastructure

**OpenClaw Provides:**
- Channel plugins (Slack, Teams, WhatsApp, Discord)
- Agent routing (per-company, per-channel)
- Session management (conversation state)
- Tool registration (custom recruiting tools)
- Gateway (WebSocket control plane)

**We Build On Top:**
- Recruiting-specific tools (evaluate, brief, search)
- Company Model context injection
- Proactive alert triggers
- Interview scheduling integration

**Key OpenClaw Components Used:**
```typescript
// Plugin registration
api.registerTool(evaluateCandidateTool);
api.registerTool(generateBriefTool);
api.registerTool(searchCandidatesTool);

// Context injection via hooks
api.registerHook("before_agent_start", async (event, context) => {
  const com = await loadCompanyModel(context.companyId);
  return { prependContext: buildRecruitingContext(com) };
});

// Background service for proactive monitoring
api.registerService({
  id: "candidate-monitor",
  start: async () => { /* poll for new candidates */ },
});
```

### 6.2 Reasoning Engine (RL Actor-Critic)

**What:** RL-trained model that reasons through evidence to construct proofs

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      REASONING ENGINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INPUT: Evidence bundle (GitHub, LinkedIn, Resume, etc.)        │
│         Company Model (context for evaluation)                  │
│         Claim templates (what we're trying to prove)            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      ACTOR                               │   │
│  │  - Proposes reasoning chain                              │   │
│  │  - "Evidence X supports claim Y because Z"               │   │
│  │  - Generates step-by-step proof attempt                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      CRITIC                              │   │
│  │  - Evaluates reasoning validity                          │   │
│  │  - Checks evidence-claim link strength                   │   │
│  │  - Identifies gaps in reasoning                          │   │
│  │  - Scores proof quality                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  OUTPUT: Proof result per claim                                 │
│          - PROVED: evidence_refs, reasoning_chain               │
│          - UNPROVED: reason, interview_questions                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Training Data Sources:**
- Curated evaluation examples (human-labeled reasoning chains)
- Synthetic data (generated claim-evidence pairs)
- Preference data (which reasoning is better)

**Training Approach:**
- Actor: Policy network (generates reasoning)
- Critic: Value network (evaluates reasoning quality)
- Reward: Reasoning validity + proof correctness + explanation quality

### 6.3 Proof Engine (Deterministic)

**What:** Rule-based system that verifies claims against evidence

**Inherited from ProofHire:**
```python
class ProofEngine:
    def evaluate_claim(
        self,
        claim: Claim,
        evidence: CandidateEvidence,
        reasoning: ReasoningChain,  # From RL engine
        com: CompanyModel,
    ) -> ProofResult:

        # Find applicable rules for this claim type
        rules = self.rules.get(claim.claim_type, [])

        for rule in rules:
            result = rule.evaluate(claim, evidence, reasoning, com)
            if result.status == "PROVED":
                return result

        # No rule proved the claim
        return ProofResult(
            status="UNPROVED",
            claim=claim,
            reason="Insufficient evidence",
            interview_questions=self.generate_questions(claim),
        )
```

**Example Rules:**
```python
class TechnicalDepthRule(BaseRule):
    """Proves technical depth from GitHub evidence."""

    def evaluate(self, claim, evidence, reasoning, com):
        github = evidence.github

        # Check commit volume in relevant languages
        relevant_commits = sum(
            github.commits_by_language.get(lang, 0)
            for lang in com.stack
        )

        if relevant_commits >= 100:
            return self._proved(
                evidence_refs=[f"github:{github.username}/commits"],
                reasoning=f"Active contributor ({relevant_commits} commits) in {com.stack}"
            )

        return self._unproved(
            interview_questions=[
                f"Walk me through your experience with {com.stack[0]}",
                "Show me a technically complex problem you solved recently"
            ]
        )
```

### 6.4 Evidence Extractors

**What:** Modules that parse external sources into structured evidence

**LinkedIn Extractor:**
```python
@dataclass
class LinkedInEvidence:
    profile_url: str
    current_role: str
    current_company: str
    tenure_months: int
    previous_companies: list[str]
    total_experience_years: float
    skills_endorsed: list[str]
    recommendations_count: int
    connection_count: int
    activity_recency: str  # "active", "moderate", "inactive"
    open_to_work: bool
```

**GitHub Extractor:**
```python
@dataclass
class GitHubEvidence:
    username: str
    total_commits_last_year: int
    languages: dict[str, int]  # language → commit count
    repos_owned: int
    repos_contributed: int
    pr_merge_rate: float
    code_review_count: int
    test_file_ratio: float  # test files / total files
    documentation_ratio: float
    avg_pr_size: int
    commit_frequency: str  # "daily", "weekly", "sporadic"
```

**Resume Extractor:**
```python
@dataclass
class ResumeEvidence:
    education: list[Education]
    experience: list[Experience]
    skills_claimed: list[str]
    certifications: list[Certification]
    projects: list[Project]
    total_years: float
```

### 6.5 Company Codebase Analyzer

**What:** Analyzes company GitHub to understand gaps and patterns

```python
@dataclass
class CodebaseProfile:
    # Stack reality (from code, not claims)
    languages: dict[str, float]  # language → % of codebase
    frameworks: list[str]
    infrastructure: list[str]  # k8s, docker, terraform

    # Quality signals
    test_coverage: dict[str, float]  # path → coverage %
    documentation_ratio: float
    type_safety: float

    # Gap analysis
    coverage_gaps: list[CoverageGap]
    tech_debt_hotspots: list[TechDebt]
    knowledge_silos: list[KnowledgeSilo]
    missing_expertise: list[ExpertiseGap]

    # Team patterns
    code_owners: dict[str, list[str]]  # path → contributors
    review_patterns: dict[str, float]
```

### 6.6 Brief Builder

**What:** Assembles Proof Brief from evaluation results

```python
class BriefBuilder:
    def build(
        self,
        candidate: Candidate,
        proof_results: list[ProofResult],
        com: CompanyModel,
    ) -> ProofBrief:

        proved = [r for r in proof_results if r.status == "PROVED"]
        unproved = [r for r in proof_results if r.status == "UNPROVED"]

        return ProofBrief(
            candidate_id=candidate.id,
            candidate_name=candidate.name,
            role=candidate.applied_role,

            proof_rate=len(proved) / len(proof_results),

            proved_claims=[
                ProvedClaim(
                    claim=r.claim,
                    evidence_refs=r.evidence_refs,
                    reasoning=r.reasoning,
                )
                for r in proved
            ],

            unproved_claims=[
                UnprovedClaim(
                    claim=r.claim,
                    reason=r.reason,
                    interview_questions=r.interview_questions,
                )
                for r in unproved
            ],

            gap_analysis=self.analyze_gaps(proof_results, com),
            risk_flags=self.detect_risks(candidate, proof_results),

            interview_plan=InterviewPlan(
                duration_min=15 + len(unproved) * 5,
                focus_areas=[u.claim.claim_type for u in unproved],
                questions=self.prioritize_questions(unproved),
            ),
        )
```

---

## 7. Data Architecture

### 7.1 Core Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA MODEL                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  COMPANY DOMAIN                                                 │
│  ├── Company                                                    │
│  │   ├── id, name, domain                                       │
│  │   ├── slack_workspace_id                                     │
│  │   └── github_org                                             │
│  │                                                              │
│  ├── CompanyModel                                               │
│  │   ├── company_id (FK)                                        │
│  │   ├── stage, pace, quality_bar, autonomy                     │
│  │   ├── risk_intolerance[]                                     │
│  │   ├── stack[]                                                │
│  │   └── calibrated_at                                          │
│  │                                                              │
│  ├── CodebaseProfile                                            │
│  │   ├── company_id (FK)                                        │
│  │   ├── languages{}, frameworks[]                              │
│  │   ├── coverage_gaps[], tech_debt[], silos[]                  │
│  │   └── analyzed_at                                            │
│  │                                                              │
│  └── Role                                                       │
│      ├── company_id (FK)                                        │
│      ├── title, level, department                               │
│      ├── required_claims[]                                      │
│      └── benchmark_config                                       │
│                                                                 │
│  CANDIDATE DOMAIN                                               │
│  ├── Candidate                                                  │
│  │   ├── id, email, name                                        │
│  │   ├── linkedin_url, github_username                          │
│  │   └── source (inbound, sourced, referred)                    │
│  │                                                              │
│  ├── CandidateEvidence                                          │
│  │   ├── candidate_id (FK)                                      │
│  │   ├── linkedin_evidence (JSON)                               │
│  │   ├── github_evidence (JSON)                                 │
│  │   ├── resume_evidence (JSON)                                 │
│  │   └── extracted_at                                           │
│  │                                                              │
│  └── CandidateSignal                                            │
│      ├── candidate_id (FK)                                      │
│      ├── signal_type (open_to_work, activity_change, layoff)    │
│      ├── detected_at                                            │
│      └── expires_at                                             │
│                                                                 │
│  EVALUATION DOMAIN                                              │
│  ├── Evaluation                                                 │
│  │   ├── id, candidate_id, company_id, role_id                  │
│  │   ├── status (pending, complete)                             │
│  │   └── triggered_by (proactive, manual)                       │
│  │                                                              │
│  ├── Claim                                                      │
│  │   ├── evaluation_id (FK)                                     │
│  │   ├── claim_type, status (proved, unproved)                  │
│  │   ├── evidence_refs[]                                        │
│  │   ├── reasoning_chain                                        │
│  │   └── interview_questions[]                                  │
│  │                                                              │
│  └── ProofBrief                                                 │
│      ├── evaluation_id (FK)                                     │
│      ├── proof_rate                                             │
│      ├── proved_claims[], unproved_claims[]                     │
│      ├── gap_analysis, risk_flags                               │
│      ├── interview_plan                                         │
│      └── generated_at                                           │
│                                                                 │
│  INTERACTION DOMAIN                                             │
│  ├── Alert                                                      │
│  │   ├── id, company_id, candidate_id                           │
│  │   ├── channel, message_id                                    │
│  │   ├── urgency (high, medium, low)                            │
│  │   └── sent_at                                                │
│  │                                                              │
│  └── Action                                                     │
│      ├── alert_id (FK)                                          │
│      ├── action_type (view_brief, reach_out, pass, schedule)    │
│      ├── taken_by                                               │
│      └── taken_at                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Storage Strategy

| Data Type | Storage | Reason |
|-----------|---------|--------|
| Core entities | PostgreSQL | Relational, transactional, RLS |
| Evidence JSON | PostgreSQL JSONB | Flexible schema, queryable |
| Session state | Redis | Fast, ephemeral |
| Embeddings | pgvector | Vector similarity search |
| Artifacts | S3 | Large files, signed URLs |
| Audit log | Append-only table | Compliance, debugging |

### 7.3 Data Flow

```
1. INGESTION
   LinkedIn API ──┐
   GitHub API  ───┼──► Raw Data ──► Evidence Extractors ──► CandidateEvidence
   Layoff feeds ──┘

2. MATCHING
   CandidateEvidence ──┐
   CompanyModel ───────┼──► Matching Engine ──► Match Score
   CodebaseProfile ────┘

3. EVALUATION
   CandidateEvidence ──┐
   CompanyModel ───────┼──► Reasoning Engine ──► Proof Engine ──► ProofBrief
   ClaimTemplates ─────┘

4. DELIVERY
   ProofBrief ──┐
   Urgency ─────┼──► Alert Builder ──► Channel Delivery ──► Slack/Teams
   Timing ──────┘
```

---

## 8. RL Training Pipeline

### 8.1 Training Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RL TRAINING PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    DATA COLLECTION                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │   Curated    │  │  Synthetic   │  │  Preference  │   │   │
│  │  │   Examples   │  │    Data      │  │    Labels    │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    TRAINING LOOP                         │   │
│  │                                                          │   │
│  │  ┌──────────────┐                    ┌──────────────┐   │   │
│  │  │    ACTOR     │◄──── Gradient ─────│   CRITIC     │   │   │
│  │  │   (Policy)   │                    │   (Value)    │   │   │
│  │  └──────┬───────┘                    └──────┬───────┘   │   │
│  │         │                                   │            │   │
│  │         ▼                                   ▼            │   │
│  │  ┌──────────────┐                    ┌──────────────┐   │   │
│  │  │   Generate   │                    │   Evaluate   │   │   │
│  │  │  Reasoning   │───────────────────►│   Quality    │   │   │
│  │  └──────────────┘                    └──────────────┘   │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    EVALUATION                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │   Reasoning  │  │    Proof     │  │ Explanation  │   │   │
│  │  │   Validity   │  │  Correctness │  │   Quality    │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Training Data

**Curated Examples (Human-Labeled):**
- 500-1000 high-quality evaluation examples
- Each example: evidence bundle → reasoning chain → proof result
- Labeled by domain experts (senior engineers, hiring managers)

**Synthetic Data:**
- Generate claim-evidence pairs programmatically
- Vary evidence strength, claim types, company contexts
- 10,000+ synthetic examples for coverage

**Preference Labels:**
- Pairwise comparisons: "Which reasoning is better?"
- Used for RLHF-style fine-tuning
- Collected from beta users

### 8.3 Reward Function

```python
def compute_reward(
    reasoning: ReasoningChain,
    proof_result: ProofResult,
    ground_truth: GroundTruth,
) -> float:

    reward = 0.0

    # Reasoning validity (does the chain make sense?)
    if reasoning.is_logically_valid():
        reward += 0.3

    # Evidence linking (are evidence refs correct?)
    evidence_accuracy = reasoning.evidence_link_accuracy(ground_truth)
    reward += 0.3 * evidence_accuracy

    # Proof correctness (did we get the right answer?)
    if proof_result.status == ground_truth.status:
        reward += 0.2

    # Explanation quality (is the reasoning clear?)
    explanation_score = evaluate_explanation_quality(reasoning)
    reward += 0.2 * explanation_score

    return reward
```

### 8.4 Model Architecture

**Base Model:** Fine-tuned LLM (Claude/GPT-4 class)

**Actor Network:**
- Input: Evidence bundle + Company Model + Claim
- Output: Reasoning chain (structured JSON)
- Architecture: Transformer with structured output head

**Critic Network:**
- Input: Evidence + Reasoning chain
- Output: Quality score (0-1)
- Architecture: Transformer encoder + regression head

**Training:**
- PPO (Proximal Policy Optimization) or similar
- Batch size: 64-128 examples
- Training time: ~1 week on 8xA100

---

## 9. External Dependencies

### 9.1 Core Infrastructure

| Dependency | Purpose | Criticality | Alternative |
|------------|---------|-------------|-------------|
| **OpenClaw** | Agent backbone, multi-channel | High | Build custom (6+ months) |
| **PostgreSQL** | Primary database | High | None (standard) |
| **Redis** | Caching, queues | Medium | Memcached |
| **S3** | Artifact storage | Medium | GCS, Azure Blob |

### 9.2 AI/ML

| Dependency | Purpose | Criticality | Alternative |
|------------|---------|-------------|-------------|
| **Anthropic Claude API** | Base LLM for reasoning | High | OpenAI GPT-4, open-source |
| **PyTorch** | RL training | High | JAX, TensorFlow |
| **pgvector** | Embedding search | Medium | Pinecone, Weaviate |

### 9.3 Data Sources

| Dependency | Purpose | Criticality | Risk |
|------------|---------|-------------|------|
| **LinkedIn API** | Candidate profiles, signals | High | Rate limits, ToS, cost |
| **GitHub API** | Code analysis, contribution patterns | High | Rate limits (5000/hr) |
| **Layoff.fyi / similar** | Timing signals | Low | Scraping fragility |
| **Company GitHub** | Codebase analysis | Medium | Access permissions |

### 9.4 Channels

| Dependency | Purpose | Criticality | Risk |
|------------|---------|-------------|------|
| **Slack API** | Primary channel | High | App review process |
| **Microsoft Teams** | Enterprise channel | Medium | Azure marketplace |
| **WhatsApp Business API** | Mobile alerts | Low | Meta approval process |

---

## 10. Feasibility Analysis

### 10.1 Technical Feasibility

| Component | Feasibility | Confidence | Notes |
|-----------|-------------|------------|-------|
| **OpenClaw integration** | High | 90% | Well-documented, plugin architecture |
| **Evidence extraction** | High | 85% | APIs exist, parsing is straightforward |
| **Proof engine (rules)** | High | 95% | Deterministic, already prototyped |
| **RL reasoning engine** | Medium | 60% | Novel, requires significant R&D |
| **Codebase analysis** | Medium | 70% | Static analysis tools exist |
| **Proactive monitoring** | High | 85% | Standard event-driven architecture |
| **Multi-channel delivery** | High | 90% | OpenClaw handles this |

### 10.2 Data Feasibility

| Requirement | Feasibility | Notes |
|-------------|-------------|-------|
| **LinkedIn data access** | Medium | API exists but rate-limited; scraping risky |
| **GitHub data access** | High | Public API, generous limits |
| **Training data (curated)** | Medium | Requires manual labeling effort |
| **Training data (synthetic)** | High | Can generate programmatically |
| **Company codebase access** | High | GitHub app authorization |

### 10.3 RL Training Feasibility

| Aspect | Assessment | Risk Mitigation |
|--------|------------|-----------------|
| **Data quality** | Medium | Start with curated examples, expand with synthetic |
| **Reward signal clarity** | Medium | Define clear rubric, iterate on reward function |
| **Training compute** | High | Standard GPU cluster (8xA100 for 1 week) |
| **Evaluation difficulty** | Medium | Build comprehensive eval suite early |
| **Cold start** | High | Fine-tune from strong base model (Claude/GPT-4) |

### 10.4 Market Feasibility

| Factor | Assessment | Notes |
|--------|------------|-------|
| **Willingness to pay** | High | $30K saved per recruiter hire |
| **Adoption friction** | Medium | Slack install, GitHub connect |
| **Trust in AI evaluation** | Medium | Proof Briefs help (transparency) |
| **Competition** | Low | No direct competitor with this approach |

---

## 11. Risk Assessment

### 11.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| RL model doesn't generalize | Medium | High | Start with rule-based, add RL incrementally |
| LinkedIn API access restricted | Medium | High | Build multiple data sources, cache aggressively |
| OpenClaw dependency issues | Low | Medium | Contribute upstream, maintain fork if needed |
| Proof engine too rigid | Medium | Medium | Design for rule extensibility from day 1 |

### 11.2 Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Founders don't trust AI evaluation | Medium | High | Proof Briefs with evidence links, full transparency |
| Too many false positives | Medium | Medium | Tune matching thresholds, allow feedback |
| Alert fatigue | Medium | Medium | Smart batching, urgency levels |
| Wrong candidates surfaced | Low | High | Human in the loop, no automated outreach |

### 11.3 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LinkedIn ToS enforcement | Medium | High | Diversify data sources, build direct relationships |
| Competition from incumbents | Medium | Medium | Move fast, build moat in RL reasoning |
| Slow enterprise sales cycle | High | Medium | Start with startups (fast decision makers) |

---

## 12. Development Phases

### Phase 0: Foundation (4 weeks)
- [ ] Set up OpenClaw plugin skeleton
- [ ] Implement basic evidence extractors (GitHub, resume)
- [ ] Build rule-based proof engine (no RL yet)
- [ ] Create Company Model schema and calibration flow
- [ ] Slack integration for alerts

**Deliverable:** MVP that can evaluate a candidate with rules, output Proof Brief to Slack

### Phase 1: Core Product (8 weeks)
- [ ] LinkedIn evidence extractor
- [ ] Codebase analyzer (company GitHub)
- [ ] Gap detection and matching
- [ ] Proactive monitoring loop
- [ ] Brief builder with interview questions

**Deliverable:** Proactive agent that monitors and surfaces candidates with Proof Briefs

### Phase 2: RL Reasoning (12 weeks)
- [ ] Curated training data (500+ examples)
- [ ] Synthetic data generation
- [ ] Actor-critic training pipeline
- [ ] Evaluation suite
- [ ] Integration with proof engine

**Deliverable:** RL-trained reasoning engine that improves proof quality

### Phase 3: Scale & Polish (8 weeks)
- [ ] Additional channels (Teams, WhatsApp)
- [ ] Interview scheduling integration
- [ ] Analytics dashboard
- [ ] Enterprise features (SSO, audit logs)
- [ ] Performance optimization

**Deliverable:** Production-ready system for early customers

### Total Timeline: ~32 weeks (8 months)

---

## 13. Success Metrics

### 13.1 Product Metrics

| Metric | Target (6 mo) | Target (12 mo) |
|--------|---------------|----------------|
| Companies onboarded | 20 | 100 |
| Proof Briefs generated | 500 | 5,000 |
| Candidates surfaced proactively | 200 | 2,000 |
| Proof Brief → Reach Out rate | 30% | 40% |
| Reach Out → Interview rate | 50% | 60% |
| Interview → Hire rate | 20% | 25% |

### 13.2 Quality Metrics

| Metric | Target |
|--------|--------|
| Proof accuracy (vs. human eval) | 85%+ |
| UNPROVED claim → interview signal correlation | 70%+ |
| False positive rate (bad candidates surfaced) | <10% |
| User satisfaction (NPS) | 50+ |

### 13.3 Reasoning Metrics

| Metric | Target |
|--------|--------|
| Reasoning chain validity | 90%+ |
| Evidence-claim link accuracy | 85%+ |
| Explanation clarity (human eval) | 4/5+ |

---

## 14. Open Questions

### 14.1 Product Questions

1. **How much calibration is enough?**
   - 15-minute interview sufficient?
   - Need exemplar PRs?
   - How often to recalibrate?

2. **How to handle candidate opt-out?**
   - Do we evaluate without consent?
   - GDPR/CCPA implications?

3. **What's the right alert frequency?**
   - Real-time for hot candidates?
   - Daily digest?
   - User preference?

### 14.2 Technical Questions

1. **RL model architecture**
   - Fine-tune existing LLM vs. train from scratch?
   - Single model or separate actor/critic?
   - How to handle long evidence context?

2. **LinkedIn data strategy**
   - Official API (expensive, limited)?
   - Scraping (ToS risk)?
   - Data partnerships?

3. **Evaluation methodology**
   - How to measure reasoning quality?
   - Ground truth for proof correctness?
   - A/B testing framework?

### 14.3 Business Questions

1. **Pricing model**
   - Per seat?
   - Per hire?
   - Per evaluation?

2. **Go-to-market**
   - PLG (self-serve)?
   - Sales-led?
   - Community-led?

3. **Candidate marketplace**
   - Should candidates see their Proof Briefs?
   - Build a talent network?
   - Two-sided marketplace eventually?

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Company Model** | Executable evaluator calibrated to a specific company's hiring bar |
| **Proof Brief** | Output document with proved/unproved claims and interview plan |
| **Evidence** | Structured data extracted from external sources (GitHub, LinkedIn, etc.) |
| **Claim** | Hypothesis about a candidate (e.g., "has testing discipline") |
| **Proof Chain** | Reasoning from evidence to claim to proof status |
| **Actor-Critic** | RL architecture where actor proposes, critic evaluates |
| **Fail-Closed** | Design principle: no evidence = UNPROVED, not guessed |

---

## Appendix B: Related Work

### Mind-Reader (Internal)
- Proof-directed cognitive augmentation
- DSL for formal verification
- Actor-critic for reasoning improvement
- Web-of-Claims for evidence tracking

### ProofHire (Internal)
- Evidence-based hiring evaluation
- Rule-based proof engine
- Brief generation with interview questions
- Sandbox-based technical assessment

### OpenClaw (External)
- Multi-channel AI agent infrastructure
- Plugin architecture for extensibility
- Session and routing management
- Gateway for agent control

---

## Appendix C: References

1. OpenClaw Documentation: https://github.com/openclaw/openclaw
2. Mind-Reader Technical Architecture: `/Users/arjunvad/Desktop/mind-reader/TECHNICAL_ARCHITECTURE.md`
3. ProofHire Vision: `/Users/arjunvad/Desktop/proofhire/docs/VISION.md`
4. Actor-Critic Methods: Sutton & Barto, Reinforcement Learning (2018)
5. RLHF: Christiano et al., "Deep RL from Human Preferences" (2017)