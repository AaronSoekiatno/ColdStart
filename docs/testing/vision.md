# ProofHire: Model-to-Model Talent Matching

## Executive Summary

ProofHire is building the infrastructure to replace resume-based hiring with **model-to-model matching** — where a computational model of a company's engineering culture and needs is matched against a computational model of a candidate's skills, behaviors, and working style.

Instead of humans pattern-matching keywords on resumes to job descriptions, ProofHire enables:

- **Companies** to express what they need through a trained model that understands their codebase, culture, and priorities
- **Candidates** to demonstrate who they are through a behavioral model captured from real work
- **Matching** that happens at the model level — precise, explainable, and bias-resistant

---

## The Problem

### Current State of Technical Hiring

1. **Resumes are low-signal** — They capture credentials, not capabilities. A resume says "5 years of Python" but nothing about debugging intuition, code quality standards, or collaboration style.

2. **Interviews are inconsistent** — Different interviewers evaluate differently. The same candidate gets different outcomes based on who interviews them.

3. **Job descriptions are wishful thinking** — Companies list requirements they think they need, often misaligned with what actually predicts success in the role.

4. **No ground truth** — There's no systematic way to learn what actually makes someone successful at a specific company.

### The Fundamental Mismatch

Companies try to describe what they want in natural language (job descriptions).
Candidates try to describe what they offer in natural language (resumes).
Humans try to match these descriptions through conversation (interviews).

Every step loses information. Every step introduces bias.

---

## Our Vision: Model-to-Model Matching

### Core Concept

Replace natural language descriptions with **computational models** that capture the full dimensionality of what companies need and what candidates offer.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   COMPANY MODEL                      CANDIDATE MODEL            │
│   ─────────────                      ───────────────            │
│                                                                 │
│   ┌─────────────────┐                ┌─────────────────┐        │
│   │ Codebase DNA    │                │ Skill Embedding │        │
│   │ • Patterns      │                │ • From work     │        │
│   │ • Conventions   │                │ • From behavior │        │
│   │ • Complexity    │                │ • From output   │        │
│   └────────┬────────┘                └────────┬────────┘        │
│            │                                  │                 │
│   ┌────────▼────────┐                ┌────────▼────────┐        │
│   │ Culture Vector  │                │ Behavior Model  │        │
│   │ • Pace          │                │ • How they debug│        │
│   │ • Quality bar   │                │ • How they learn│        │
│   │ • Autonomy      │                │ • How they ship │        │
│   └────────┬────────┘                └────────┬────────┘        │
│            │                                  │                 │
│   ┌────────▼────────┐                ┌────────▼────────┐        │
│   │ Success Profile │                │ Work Style      │        │
│   │ • From alumni   │                │ • Agentic flow  │        │
│   │ • From founders │                │ • Tool usage    │        │
│   │ • From outcomes │                │ • Iteration     │        │
│   └────────┬────────┘                └────────┬────────┘        │
│            │                                  │                 │
│            └──────────────┬───────────────────┘                 │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │   MATCH     │                              │
│                    │   SCORE     │                              │
│                    │             │                              │
│                    │ Similarity  │                              │
│                    │ Gaps        │                              │
│                    │ Fit areas   │                              │
│                    └─────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### B2B: The Company Model

**Input Sources:**
- Company codebase (GitHub/GitLab integration)
- Engineering documentation and RFCs
- Founder/hiring manager interview
- Historical hiring outcomes (who succeeded, who didn't)
- PR review patterns and coding standards

**What the Model Captures:**
- **Codebase DNA** — Architectural patterns, language idioms, complexity distribution, test coverage norms
- **Culture Vector** — Pace of shipping, quality bar, tolerance for ambiguity, review rigor
- **Success Profile** — Behavioral patterns of engineers who thrived vs. struggled

**Output:**
- A trained model (fine-tuned LLM or embedding space) that can:
  - Generate relevant coding challenges from the company's actual patterns
  - Evaluate candidate work against company-specific standards
  - Predict cultural fit based on behavioral signals

### B2C: The Candidate Model

**Input Sources:**
- Work simulation (observed in real-time)
- Behavioral telemetry during the simulation
- Code output and artifacts
- Written communication (PR descriptions, technical writeups)
- Optional: GitHub history, portfolio projects

**What the Model Captures:**
- **Skill Embedding** — Technical capabilities demonstrated through work, not claimed on resume
- **Agentic Workflow** — How they approach problems (systematic vs. exploratory, depth-first vs. breadth-first)
- **Behavioral Fingerprint** — Debugging patterns, refactoring tendencies, documentation habits

**Output:**
- A candidate model that can be:
  - Compared against any company model for fit scoring
  - Explained in human terms ("strong debugger, prefers depth over breadth, high code quality standards")
  - Updated as the candidate completes more work samples

### The Match

Instead of humans reading resumes and making gut calls:

```python
match_score = similarity(company_model, candidate_model)
gap_analysis = identify_gaps(company_model, candidate_model)
fit_areas = identify_strengths(company_model, candidate_model)
interview_focus = generate_questions(gap_analysis)
```

**Properties of model-to-model matching:**
- **Deterministic** — Same inputs produce same outputs
- **Explainable** — Every score traces back to specific evidence
- **Bias-resistant** — Models don't see names, schools, or demographics
- **Learnable** — System improves as we see hiring outcomes

---

## Technical Architecture

### Current Implementation (Phase 1: Rule-Based Foundation)

We've built the infrastructure layer that will power the model-based system:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PROOFHIRE v1.0                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   FOUNDER    │    │  SIMULATION  │    │    PROOF     │      │
│  │  INTERVIEW   │───▶│   SANDBOX    │───▶│   ENGINE     │      │
│  │              │    │              │    │              │      │
│  │ 4 questions  │    │ Docker       │    │ Rule-based   │      │
│  │ about pace,  │    │ isolated     │    │ claim        │      │
│  │ quality,     │    │ execution    │    │ evaluation   │      │
│  │ priorities   │    │              │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │     COM      │    │  ARTIFACTS   │    │    BRIEF     │      │
│  │              │    │              │    │              │      │
│  │ Company      │    │ • Diffs      │    │ Proven/      │      │
│  │ Operating    │    │ • Test logs  │    │ Unproven     │      │
│  │ Model (JSON) │    │ • Coverage   │    │ Claims       │      │
│  │              │    │ • Metrics    │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**What We've Built:**

| Component | Description | Status |
|-----------|-------------|--------|
| **Simulation Sandbox** | Docker-based isolated execution environment with resource limits, network isolation, and deterministic grading | ✅ Complete |
| **Artifact Pipeline** | Collection and storage of all candidate outputs (diffs, test logs, coverage reports, writeups) | ✅ Complete |
| **Evidence Extractors** | Parsers for different artifact types to extract structured data | ✅ Complete |
| **Proof Engine** | Rule-based evaluation that marks claims as PROVED or UNPROVED | ✅ Complete |
| **Brief Generator** | Templated output of evaluation results with evidence links | ✅ Complete |
| **Company Operating Model** | JSON representation of company preferences from founder interview | ✅ Complete |
| **Rubric System** | Weighted dimensions (correctness, testing, code quality, communication) | ✅ Complete |

**Current Limitations (To Be Replaced by Models):**

| Current | Future |
|---------|--------|
| 4-question founder interview | Codebase analysis + fine-tuning |
| Pre-built static simulations | Dynamically generated from company patterns |
| Binary test pass/fail metrics | Behavioral telemetry + skill embedding |
| Threshold-based rules | Model similarity scoring |

### Target Architecture (Phase 2: Model-Based)

```
┌─────────────────────────────────────────────────────────────────┐
│                        PROOFHIRE v2.0                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  COMPANY SIDE                          CANDIDATE SIDE           │
│  ────────────                          ──────────────           │
│                                                                 │
│  ┌──────────────┐                      ┌──────────────┐        │
│  │   CODEBASE   │                      │  SIMULATION  │        │
│  │   INGESTION  │                      │  + TELEMETRY │        │
│  │              │                      │              │        │
│  │ • Clone repo │                      │ • Keystrokes │        │
│  │ • Parse AST  │                      │ • File nav   │        │
│  │ • Extract    │                      │ • Search     │        │
│  │   patterns   │                      │ • Debugging  │        │
│  └──────┬───────┘                      └──────┬───────┘        │
│         │                                     │                 │
│         ▼                                     ▼                 │
│  ┌──────────────┐                      ┌──────────────┐        │
│  │   COMPANY    │                      │  CANDIDATE   │        │
│  │   ENCODER    │                      │   ENCODER    │        │
│  │              │                      │              │        │
│  │ Fine-tuned   │                      │ Behavioral   │        │
│  │ on codebase  │                      │ embedding    │        │
│  │ + founder    │                      │ from work    │        │
│  │ preferences  │                      │              │        │
│  └──────┬───────┘                      └──────┬───────┘        │
│         │                                     │                 │
│         ▼                                     ▼                 │
│  ┌──────────────┐                      ┌──────────────┐        │
│  │   COMPANY    │                      │  CANDIDATE   │        │
│  │    MODEL     │◄────────────────────▶│    MODEL     │        │
│  │              │     MATCHING         │              │        │
│  │ Embedding in │                      │ Embedding in │        │
│  │ shared space │                      │ shared space │        │
│  └──────────────┘                      └──────────────┘        │
│                                                                 │
│                    ┌──────────────┐                             │
│                    │    MATCH     │                             │
│                    │   REPORT     │                             │
│                    │              │                             │
│                    │ • Score      │                             │
│                    │ • Gaps       │                             │
│                    │ • Strengths  │                             │
│                    │ • Questions  │                             │
│                    └──────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Intellectual Property & Novel Contributions

### 1. Company Operating Model (COM) Framework

**What it is:** A structured representation of how a company operates that can be derived from multiple sources and used to calibrate evaluation.

**Novel aspects:**
- Captures dimensions that predict engineering success (pace, quality bar, ambiguity tolerance, priorities)
- Designed to be populated by interview, codebase analysis, or outcome learning
- Serves as the "training signal" for company-specific evaluation

**Current IP:**
- COM schema and derivation logic
- Interview-to-COM mapping algorithms
- Rubric generation from COM

### 2. Fail-Closed Proof Engine

**What it is:** An evaluation system that explicitly marks claims as PROVED or UNPROVED, never guessing.

**Novel aspects:**
- Every claim must be backed by deterministic evidence
- Unproven claims become structured interview questions
- Creates audit trail from claim → evidence → artifact
- Designed for legal defensibility (no discriminatory inference)

**Current IP:**
- Proof rule specification language
- Evidence-to-claim mapping
- Unproven claim → interview question generation

### 3. Behavioral Telemetry Capture (Planned)

**What it is:** Recording of candidate workflow during simulation to build behavioral models.

**Novel aspects:**
- Captures *how* someone works, not just *what* they produce
- Enables modeling of debugging intuition, exploration patterns, learning velocity
- Creates rich signal beyond code output

**Planned telemetry:**
- Keystroke dynamics (not content, timing patterns)
- File navigation sequences
- Search query patterns
- Error-correction cycles
- Documentation reference patterns

### 4. Dynamic Benchmark Generation (Planned)

**What it is:** Using company codebase to generate relevant, company-specific coding challenges.

**Novel aspects:**
- Challenges mirror real work the candidate would do
- Difficulty calibrated to company's actual codebase complexity
- Can generate infinite variations to prevent cheating
- Evolves as company codebase evolves

**Approach:**
- Parse company codebase for common patterns
- Identify complexity hotspots
- Generate synthetic bugs or feature requests
- Validate with company engineers

### 5. Dual-Embedding Match Space (Planned)

**What it is:** Representing both companies and candidates as embeddings in a shared space for similarity computation.

**Novel aspects:**
- Same model architecture encodes both sides
- Enables "companies like X hired candidates like Y" analysis
- Matching is symmetric and explainable
- Can identify gaps and strengths precisely

---

## Concept Demonstration

### Scenario: Startup Hiring Backend Engineer

**Today (Industry Standard):**
1. Founder writes job description based on intuition
2. Candidates submit resumes
3. Recruiter keyword-matches resumes
4. Engineers conduct inconsistent interviews
5. Hiring decision made on gut feel
6. 6 months later: "not a culture fit"

**With ProofHire (Current v1.0):**
1. Founder answers 4 calibration questions
2. System generates weighted rubric
3. Candidate completes standardized simulation
4. System collects deterministic evidence (tests, coverage, diff)
5. Proof engine evaluates claims against evidence
6. Founder receives brief with proven/unproven claims
7. Interview focuses on unproven areas

**With ProofHire (Future v2.0):**
1. System analyzes company's GitHub → builds company model
2. Founder confirms/adjusts model via conversation
3. System generates company-specific simulation from codebase patterns
4. Candidate completes simulation while behavioral telemetry captured
5. System builds candidate model from behavior + output
6. Models compared in shared embedding space
7. Match report shows: fit score, specific gaps, specific strengths
8. Interview questions generated from gap analysis
9. Post-hire outcome feeds back to improve matching

### Evidence of Concept Validity

**Why this approach works:**

1. **Information density** — A 2-hour simulation with telemetry captures more signal than a 2-page resume
2. **Objectivity** — Models don't have "gut feelings" or unconscious bias
3. **Learnability** — System improves as we observe hiring outcomes
4. **Scalability** — Once company model exists, matching is instant
5. **Defensibility** — Every decision traces to evidence, important for legal compliance

---

## Competitive Landscape

| Company | Approach | Limitation |
|---------|----------|------------|
| **HackerRank/LeetCode** | Algorithmic puzzles | Tests puzzle-solving, not real work |
| **Triplebyte** (defunct) | Standardized quiz | One-size-fits-all, no company calibration |
| **Karat** | Human interviewers | Expensive, inconsistent, not scalable |
| **Vervoe** | Job simulations | No model-based matching, rule-based scoring |
| **Pymetrics** | Behavioral games | No technical assessment, games ≠ work |
| **Eightfold.ai** | Resume parsing + ML | Still based on resume claims, not demonstrated work |

**ProofHire's differentiation:**
- Only platform building company-specific models from codebase
- Only platform capturing agentic workflow, not just output
- Only platform with fail-closed, legally defensible evaluation
- Only platform doing model-to-model matching

---

## Roadmap

### Phase 1: Foundation (Current) ✅
- Rule-based evaluation infrastructure
- Simulation sandbox
- Artifact collection
- Basic COM from interview
- Brief generation

### Phase 2: Telemetry (Next)
- Add behavioral telemetry to sandbox
- Capture workflow patterns
- Build candidate behavior dataset
- Early candidate embedding experiments

### Phase 3: Company Model
- GitHub integration for codebase analysis
- Code pattern extraction
- Company embedding from codebase + interview
- Dynamic simulation generation (basic)

### Phase 4: Full Model Matching
- Shared embedding space for companies and candidates
- Similarity-based matching
- Outcome feedback loop
- Continuous model improvement

---

## Conclusion

ProofHire is building toward a future where hiring decisions are made by comparing computational models of companies and candidates — not by humans pattern-matching keywords on documents.

The current system establishes the infrastructure: secure execution, evidence collection, and structured evaluation. The roadmap adds the intelligence: behavioral modeling, company encoding, and model-based matching.

The result is hiring that is:
- **More accurate** — Based on demonstrated work, not claimed credentials
- **More fair** — Models don't see protected attributes
- **More efficient** — Matching is instant once models exist
- **More defensible** — Every decision traces to evidence

---

## Appendix: Technical Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS |
| **Backend** | FastAPI, Python 3.11, Async SQLAlchemy |
| **Database** | PostgreSQL 15 |
| **Cache/Queue** | Redis 7 |
| **Object Storage** | S3-compatible (MinIO in dev) |
| **Sandbox** | Docker with resource limits, network isolation |
| **Infrastructure** | Docker Compose (dev), Kubernetes (planned prod) |
| **ML (Planned)** | PyTorch, Sentence Transformers, Fine-tuned LLMs |

---

*Document Version: 1.0*
*Last Updated: February 2026*
*Status: Internal Draft*