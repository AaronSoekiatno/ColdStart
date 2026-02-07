// Mock data for Company Dashboard demo

export interface CompanyProfile {
  id: string;
  name: string;
  logo_url?: string;
  website: string;
  location: string;
  team_size: string;
  operating_model: {
    pace: 'fast' | 'moderate' | 'deliberate';
    quality_bar: 'high' | 'balanced' | 'move-fast';
    priorities: string[];
    culture_description: string;
    github_repo_url?: string | null;
    codebase_provided?: boolean;
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

export interface RealWorldExperience {
  company: string;
  role: string;
  duration: string;
  key_achievements: string[];
  verified: boolean;
}

export interface AssessmentDetails {
  time_to_complete: string;
  problem_difficulty: 'easy' | 'medium' | 'hard';
  code_quality_score: number;
  test_coverage: number;
  edge_cases_handled: number;
  approach_notes: string;
}

export interface AIUsagePattern {
  tools_used: string[];
  usage_frequency: 'heavy' | 'moderate' | 'light';
  use_cases: string[];
  prompt_engineering_skill: 'advanced' | 'intermediate' | 'beginner';
}

export interface MatchAnalysis {
  fit_areas: string[];
  gaps: string[];
}

export interface CandidateBrief {
  id: string;
  anonymized_name: string;
  avatar_url?: string;
  school: string;
  years_of_experience: number;
  match_score: number;
  proven_claims: ProvenClaim[];
  unproven_claims: UnprovenClaim[];
  github_analysis: GitHubAnalysis;
  assessment_highlights?: string[];
  assessment_details?: AssessmentDetails;
  real_world_experience?: RealWorldExperience[];
  ai_usage?: AIUsagePattern;
  match_analysis: MatchAnalysis;
}

// New Interface for Job Contexts
export interface JobContext {
  id: string;
  title: string; // e.g. "Senior Full Stack Engineer - Palantir"
  type: 'backend' | 'frontend' | 'fullstack' | 'ml' | 'other';
}

// Mock company data - Palantir
export const mockCompany: CompanyProfile = {
  id: "palantir-1",
  name: "Palantir Technologies",
  logo_url: "https://companieslogo.com/img/orig/PLTR.D-618f91d3.png?t=1720244493",
  website: "palantir.com",
  location: "Denver, CO",
  team_size: "1000-5000",
  operating_model: {
    pace: "deliberate",
    quality_bar: "high",
    priorities: ["ownership", "impact", "quality", "autonomy"],
    culture_description: "Build software that solves the world's hardest problems. We value deep technical expertise, rigorous problem-solving, and engineers who take extreme ownership of complex systems that matter.",
    github_repo_url: "https://github.com/palantir/osquery",
    codebase_provided: true
  }
};

// Mock Job Contexts
export const mockJobContexts: JobContext[] = [
  { id: 'job-1', title: 'Senior Full Stack Engineer - Palantir', type: 'fullstack' },
  { id: 'job-2', title: 'Backend Developer - Palantir', type: 'backend' },
  { id: 'job-3', title: 'Frontend Specialist - Palantir', type: 'frontend' },
  { id: 'job-4', title: 'Machine Learning Engineer - Palantir', type: 'ml' },
];

// Mock candidate briefs
export const mockCandidates: CandidateBrief[] = [
  {
    id: "candidate-1",
    anonymized_name: "Candidate A",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&h=256&auto=format&fit=crop",
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
    assessment_details: {
      time_to_complete: "45 minutes",
      problem_difficulty: "medium",
      code_quality_score: 95,
      test_coverage: 87,
      edge_cases_handled: 5,
      approach_notes: "Used a systematic approach with clear separation of concerns. Implemented comprehensive error handling and wrote unit tests before shipping. Demonstrated strong understanding of time complexity and space optimization."
    },
    real_world_experience: [
      {
        company: "Series A Fintech Startup",
        role: "Backend Engineer",
        duration: "2 years",
        key_achievements: [
          "Built payment reconciliation system processing $10M+ monthly",
          "Reduced API latency by 60% through strategic caching",
          "Implemented fraud detection pipeline catching 95% of fraudulent transactions"
        ],
        verified: true
      },
      {
        company: "FAANG Company (Internship)",
        role: "Software Engineering Intern",
        duration: "3 months",
        key_achievements: [
          "Shipped feature to 100M+ users",
          "Collaborated with cross-functional team of 8 engineers"
        ],
        verified: true
      }
    ],
    ai_usage: {
      tools_used: ["GitHub Copilot", "Claude", "ChatGPT"],
      usage_frequency: "heavy",
      use_cases: [
        "Code generation for boilerplate and repetitive patterns",
        "Debugging complex issues with detailed context",
        "Architecture design brainstorming and tradeoff analysis",
        "Test case generation and edge case identification"
      ],
      prompt_engineering_skill: "advanced"
    },
    match_analysis: {
      fit_areas: [
        "4+ years Python experience (matches Palantir stack)",
        "Deep problem-solving mindset shown in assessment",
        "High code quality standards align with Palantir values",
        "Strong ownership demonstrated through fraud detection work",
        "Full-stack capabilities valuable for product teams"
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
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&h=256&auto=format&fit=crop",
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
    real_world_experience: [
      {
        company: "Series B SaaS Company",
        role: "Senior Frontend Engineer",
        duration: "3 years",
        key_achievements: [
          "Led frontend rewrite serving 500K+ daily users",
          "Reduced bundle size by 40% improving page load times",
          "Mentored 2 junior engineers to mid-level"
        ],
        verified: true
      }
    ],
    ai_usage: {
      tools_used: ["GitHub Copilot", "Claude"],
      usage_frequency: "moderate",
      use_cases: [
        "Component scaffolding and TypeScript types",
        "Code review assistance",
        "Documentation writing"
      ],
      prompt_engineering_skill: "intermediate"
    },
    match_analysis: {
      fit_areas: [
        "6+ years experience exceeds requirements",
        "Strong frontend expertise matches tech stack",
        "Open source contributions show ownership mindset",
        "High-quality code standards align with Palantir values",
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
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&h=256&auto=format&fit=crop",
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
    ai_usage: {
      tools_used: ["Cursor", "ChatGPT"],
      usage_frequency: "moderate",
      use_cases: [
        "API endpoint scaffolding",
        "SQL query optimization ideas"
      ],
      prompt_engineering_skill: "beginner"
    },
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
    avatar_url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=256&h=256&auto=format&fit=crop",
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
        "High code quality aligns with Palantir standards",
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
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&h=256&auto=format&fit=crop",
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
    avatar_url: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?q=80&w=256&h=256&auto=format&fit=crop",
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
    avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=256&h=256&auto=format&fit=crop",
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
    avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=256&h=256&auto=format&fit=crop",
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
