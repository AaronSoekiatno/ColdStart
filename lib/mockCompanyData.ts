// Mock data for Company Dashboard demo

export interface CompanyProfile {
  id: string;
  name: string;
  website: string;
  location: string;
  team_size: string;
  operating_model: {
    pace: 'fast' | 'moderate' | 'deliberate';
    quality_bar: 'high' | 'balanced' | 'move-fast';
    priorities: string[];
    culture_description: string;
  };
}

export interface ProvenClaim {
  claim: string;
  evidence_source: 'github' | 'assessment' | 'verified_resume';
  evidence_detail: string;
}

export interface UnprovenClaim {
  claim: string;
  source: 'self_reported' | 'resume';
  interview_question: string;
}

export interface GitHubAnalysis {
  top_languages: Array<{ language: string; percentage: number }>;
  quality_score: number;
  active_months: number;
  meaningful_projects: number;
}

export interface MatchAnalysis {
  fit_areas: string[];
  gaps: string[];
}

export interface CandidateBrief {
  id: string;
  anonymized_name: string;
  school: string;
  years_of_experience: number;
  match_score: number;
  proven_claims: ProvenClaim[];
  unproven_claims: UnprovenClaim[];
  github_analysis: GitHubAnalysis;
  assessment_highlights?: string[];
  match_analysis: MatchAnalysis;
}

// Mock company data
export const mockCompany: CompanyProfile = {
  id: "demo-company-1",
  name: "FastShip AI",
  website: "fastship.ai",
  location: "San Francisco, CA",
  team_size: "11-50",
  operating_model: {
    pace: "fast",
    quality_bar: "high",
    priorities: ["speed", "autonomy", "ownership", "impact"],
    culture_description: "Move fast, ship often, own your domain. We value high-quality code and autonomous problem-solvers who take ownership of their work."
  }
};

// Mock candidate briefs
export const mockCandidates: CandidateBrief[] = [
  {
    id: "candidate-1",
    anonymized_name: "Candidate A",
    school: "MIT",
    years_of_experience: 4,
    match_score: 92,
    proven_claims: [
      {
        claim: "Active Python contributor (18+ months)",
        evidence_source: "github",
        evidence_detail: "124 commits across 6 projects, consistent activity since Jan 2023"
      },
      {
        claim: "Strong debugger (15+ bug fixes)",
        evidence_source: "github",
        evidence_detail: "Refactoring commits, iterative development patterns, systematic bug hunting"
      },
      {
        claim: "Production-ready code quality",
        evidence_source: "assessment",
        evidence_detail: "Passed technical assessment with 95% score, excellent code structure"
      },
      {
        claim: "Full-stack experience (React + Python)",
        evidence_source: "github",
        evidence_detail: "3 full-stack projects with modern React patterns and Django/Flask backends"
      }
    ],
    unproven_claims: [
      {
        claim: "Machine Learning experience",
        source: "self_reported",
        interview_question: "Can you walk me through a recent ML project and your role in it?"
      },
      {
        claim: "Led a team of 3 engineers",
        source: "resume",
        interview_question: "Tell me about your leadership experience. What were the key challenges?"
      }
    ],
    github_analysis: {
      top_languages: [
        { language: "Python", percentage: 65 },
        { language: "JavaScript", percentage: 25 },
        { language: "Go", percentage: 10 }
      ],
      quality_score: 87,
      active_months: 18,
      meaningful_projects: 4
    },
    assessment_highlights: [
      "Completed assessment in 45 minutes",
      "Wrote clean, well-tested code with edge case handling",
      "Caught edge cases during testing phase",
      "Added helpful code comments and documentation"
    ],
    match_analysis: {
      fit_areas: [
        "4+ years Python experience (matches requirement)",
        "Fast-paced startup background at Series A company",
        "High code quality standards demonstrated in GitHub",
        "Strong problem-solving skills shown in assessment",
        "Full-stack capabilities match team needs"
      ],
      gaps: [
        "No ML production experience verified",
        "Limited distributed systems exposure",
        "Leadership claims need exploration in interview"
      ]
    }
  },
  {
    id: "candidate-2",
    anonymized_name: "Candidate B",
    school: "Stanford",
    years_of_experience: 6,
    match_score: 88,
    proven_claims: [
      {
        claim: "TypeScript expert (3+ years)",
        evidence_source: "github",
        evidence_detail: "85% of code in TypeScript, advanced patterns, type-safe architecture"
      },
      {
        claim: "React component library author",
        evidence_source: "github",
        evidence_detail: "Published npm package with 500+ downloads, comprehensive documentation"
      },
      {
        claim: "Strong testing discipline",
        evidence_source: "github",
        evidence_detail: "90%+ test coverage in major projects, Jest and Cypress test suites"
      }
    ],
    unproven_claims: [
      {
        claim: "Scaled system to 1M users",
        source: "resume",
        interview_question: "What were the specific scaling challenges and how did you solve them?"
      },
      {
        claim: "Backend architecture expertise",
        source: "self_reported",
        interview_question: "Describe a complex backend system you've designed. What trade-offs did you make?"
      }
    ],
    github_analysis: {
      top_languages: [
        { language: "TypeScript", percentage: 70 },
        { language: "JavaScript", percentage: 20 },
        { language: "Python", percentage: 10 }
      ],
      quality_score: 91,
      active_months: 24,
      meaningful_projects: 7
    },
    assessment_highlights: [
      "Completed assessment in 38 minutes",
      "Excellent code organization and modularity",
      "Proactively added error handling",
      "Strong debugging skills demonstrated"
    ],
    match_analysis: {
      fit_areas: [
        "6+ years experience exceeds requirements",
        "Strong frontend expertise matches tech stack",
        "Open source contributions show ownership mindset",
        "High-quality code standards align with company values",
        "Testing discipline matches quality bar"
      ],
      gaps: [
        "Backend experience needs verification",
        "Limited Python exposure (only 10% of GitHub activity)",
        "Scaling claims need deeper exploration"
      ]
    }
  },
  {
    id: "candidate-3",
    anonymized_name: "Candidate C",
    school: "UC Berkeley",
    years_of_experience: 3,
    match_score: 85,
    proven_claims: [
      {
        claim: "Go specialist (2+ years)",
        evidence_source: "github",
        evidence_detail: "60% Go code, microservices patterns, concurrent programming expertise"
      },
      {
        claim: "API design experience",
        evidence_source: "github",
        evidence_detail: "RESTful APIs with OpenAPI specs, versioning, comprehensive docs"
      },
      {
        claim: "Fast learner (multiple tech stacks)",
        evidence_source: "github",
        evidence_detail: "Contributed to projects in 5+ languages over 3 years"
      }
    ],
    unproven_claims: [
      {
        claim: "Kubernetes deployment experience",
        source: "resume",
        interview_question: "Walk me through a K8s deployment you've managed. What challenges did you face?"
      }
    ],
    github_analysis: {
      top_languages: [
        { language: "Go", percentage: 60 },
        { language: "Python", percentage: 25 },
        { language: "JavaScript", percentage: 15 }
      ],
      quality_score: 83,
      active_months: 14,
      meaningful_projects: 5
    },
    assessment_highlights: [
      "Completed assessment in 52 minutes",
      "Good problem decomposition skills",
      "Clean code with clear naming conventions"
    ],
    match_analysis: {
      fit_areas: [
        "3 years experience matches mid-level requirements",
        "Polyglot developer fits diverse tech stack",
        "Startup experience at early-stage company",
        "Strong backend fundamentals"
      ],
      gaps: [
        "Junior compared to other candidates",
        "Limited frontend experience (only 15% JavaScript)",
        "DevOps claims need verification",
        "Shorter GitHub activity window (14 months)"
      ]
    }
  },
  {
    id: "candidate-4",
    anonymized_name: "Candidate D",
    school: "Carnegie Mellon",
    years_of_experience: 5,
    match_score: 90,
    proven_claims: [
      {
        claim: "Systems programming expert",
        evidence_source: "github",
        evidence_detail: "Low-level optimization, memory management, performance tuning"
      },
      {
        claim: "Open source maintainer",
        evidence_source: "github",
        evidence_detail: "Core contributor to popular Rust project, 200+ merged PRs"
      },
      {
        claim: "Technical writer",
        evidence_source: "github",
        evidence_detail: "Comprehensive READMEs, architectural docs, tutorial content"
      },
      {
        claim: "Code review rigor",
        evidence_source: "github",
        evidence_detail: "Detailed PR reviews with security and performance feedback"
      }
    ],
    unproven_claims: [
      {
        claim: "Mentored junior developers",
        source: "resume",
        interview_question: "Tell me about your mentoring approach. How do you help juniors grow?"
      }
    ],
    github_analysis: {
      top_languages: [
        { language: "Rust", percentage: 50 },
        { language: "Python", percentage: 30 },
        { language: "C++", percentage: 20 }
      ],
      quality_score: 94,
      active_months: 22,
      meaningful_projects: 6
    },
    assessment_highlights: [
      "Completed assessment in 40 minutes",
      "Exceptional code quality and performance optimization",
      "Considered multiple solutions before implementing",
      "Added comprehensive test coverage"
    ],
    match_analysis: {
      fit_areas: [
        "5 years experience with deep technical expertise",
        "Ownership mindset shown through open source maintenance",
        "High code quality aligns with company standards",
        "Strong documentation culture matches team values",
        "Performance-oriented approach fits product needs"
      ],
      gaps: [
        "Limited JavaScript/frontend experience",
        "Rust-heavy background may need tech stack adjustment"
      ]
    }
  },
  {
    id: "candidate-5",
    anonymized_name: "Candidate E",
    school: "University of Washington",
    years_of_experience: 2,
    match_score: 78,
    proven_claims: [
      {
        claim: "React proficiency",
        evidence_source: "github",
        evidence_detail: "4 React projects with hooks, context, and modern patterns"
      },
      {
        claim: "Rapid prototyper",
        evidence_source: "github",
        evidence_detail: "Multiple MVPs built in <2 week sprints, quick iteration cycles"
      },
      {
        claim: "Design sensibility",
        evidence_source: "github",
        evidence_detail: "Polished UIs with Tailwind, responsive design, accessibility features"
      }
    ],
    unproven_claims: [
      {
        claim: "Startup founder experience",
        source: "resume",
        interview_question: "Tell me about your startup. What did you build and what did you learn?"
      },
      {
        claim: "Growth mindset",
        source: "self_reported",
        interview_question: "Give me an example of learning something completely new. How did you approach it?"
      }
    ],
    github_analysis: {
      top_languages: [
        { language: "JavaScript", percentage: 55 },
        { language: "TypeScript", percentage: 30 },
        { language: "Python", percentage: 15 }
      ],
      quality_score: 76,
      active_months: 10,
      meaningful_projects: 3
    },
    match_analysis: {
      fit_areas: [
        "Strong frontend skills match product needs",
        "Fast shipping mentality aligns with pace",
        "Startup DNA fits company culture",
        "Design awareness valuable for product team"
      ],
      gaps: [
        "Only 2 years experience (junior level)",
        "Limited backend depth",
        "Shorter GitHub activity window",
        "Code quality scores lower than other candidates",
        "Less proven at scale"
      ]
    }
  },
  {
    id: "candidate-6",
    anonymized_name: "Candidate F",
    school: "Georgia Tech",
    years_of_experience: 7,
    match_score: 86,
    proven_claims: [
      {
        claim: "Data infrastructure specialist",
        evidence_source: "github",
        evidence_detail: "Built ETL pipelines, data modeling, PostgreSQL optimization"
      },
      {
        claim: "Python automation expert",
        evidence_source: "github",
        evidence_detail: "Scripts and tools used across organization, clean abstractions"
      },
      {
        claim: "Problem solver (complex debugging)",
        evidence_source: "github",
        evidence_detail: "Detailed commit messages showing methodical debugging approach"
      }
    ],
    unproven_claims: [
      {
        claim: "Cross-functional collaboration",
        source: "resume",
        interview_question: "Describe working with product and design. How do you handle conflicting priorities?"
      },
      {
        claim: "Real-time systems experience",
        source: "self_reported",
        interview_question: "Tell me about a real-time system you've built. What were the latency requirements?"
      }
    ],
    github_analysis: {
      top_languages: [
        { language: "Python", percentage: 75 },
        { language: "SQL", percentage: 15 },
        { language: "JavaScript", percentage: 10 }
      ],
      quality_score: 85,
      active_months: 20,
      meaningful_projects: 5
    },
    assessment_highlights: [
      "Completed assessment in 55 minutes",
      "Thorough approach with good edge case handling",
      "Well-structured solution"
    ],
    match_analysis: {
      fit_areas: [
        "7 years experience brings seniority to team",
        "Python expertise matches backend stack",
        "Data infrastructure skills valuable for product",
        "Systematic problem-solving approach",
        "Proven track record at multiple companies"
      ],
      gaps: [
        "Limited frontend experience (only 10% JavaScript)",
        "Real-time systems claims need verification",
        "May be over-qualified for current role level"
      ]
    }
  },
  {
    id: "candidate-7",
    anonymized_name: "Candidate G",
    school: "UT Austin",
    years_of_experience: 3,
    match_score: 82,
    proven_claims: [
      {
        claim: "Mobile development (React Native)",
        evidence_source: "github",
        evidence_detail: "2 published apps, cross-platform expertise, native modules"
      },
      {
        claim: "Animation and UX polish",
        evidence_source: "github",
        evidence_detail: "Smooth transitions, micro-interactions, performance-optimized"
      },
      {
        claim: "User-focused development",
        evidence_source: "github",
        evidence_detail: "A/B testing implementations, analytics integration, user feedback loops"
      }
    ],
    unproven_claims: [
      {
        claim: "Product thinking",
        source: "self_reported",
        interview_question: "Walk me through how you approach building a new feature. How do you prioritize?"
      }
    ],
    github_analysis: {
      top_languages: [
        { language: "JavaScript", percentage: 50 },
        { language: "TypeScript", percentage: 40 },
        { language: "Swift", percentage: 10 }
      ],
      quality_score: 80,
      active_months: 16,
      meaningful_projects: 4
    },
    match_analysis: {
      fit_areas: [
        "3 years experience matches requirements",
        "Strong frontend/mobile skills",
        "User-centric approach aligns with product focus",
        "Performance-conscious development",
        "Shipped products to real users"
      ],
      gaps: [
        "Mobile-first background (company is web-focused)",
        "Limited backend experience",
        "Product thinking needs validation"
      ]
    }
  },
  {
    id: "candidate-8",
    anonymized_name: "Candidate H",
    school: "Cornell",
    years_of_experience: 4,
    match_score: 89,
    proven_claims: [
      {
        claim: "Full-stack generalist",
        evidence_source: "github",
        evidence_detail: "Equal contributions to frontend (React) and backend (Node/Python)"
      },
      {
        claim: "DevOps proficiency",
        evidence_source: "github",
        evidence_detail: "Docker configs, CI/CD pipelines, infrastructure as code"
      },
      {
        claim: "Security-conscious developer",
        evidence_source: "github",
        evidence_detail: "Security audits, input validation, authentication implementations"
      },
      {
        claim: "Agile practitioner",
        evidence_source: "github",
        evidence_detail: "Small, incremental commits, feature flags, iterative development"
      }
    ],
    unproven_claims: [
      {
        claim: "Incident response experience",
        source: "resume",
        interview_question: "Tell me about responding to a production incident. What was your process?"
      }
    ],
    github_analysis: {
      top_languages: [
        { language: "TypeScript", percentage: 40 },
        { language: "Python", percentage: 35 },
        { language: "JavaScript", percentage: 25 }
      ],
      quality_score: 88,
      active_months: 19,
      meaningful_projects: 6
    },
    assessment_highlights: [
      "Completed assessment in 42 minutes",
      "Well-balanced solution with good abstractions",
      "Added security considerations",
      "Comprehensive error handling"
    ],
    match_analysis: {
      fit_areas: [
        "4 years experience with full-stack versatility",
        "DevOps skills reduce operational burden",
        "Security mindset valuable for product",
        "Agile/iterative approach matches company pace",
        "Balanced technical breadth and depth"
      ],
      gaps: [
        "Generalist background (less specialized expertise)",
        "Incident response claims need validation"
      ]
    }
  }
];
