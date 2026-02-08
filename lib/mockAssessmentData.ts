// Mock assessment data based on assessment_artifact.md structure

export interface AssessmentResult {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  session_id: string;
  completed_at: string;
  duration_minutes: number;

  // Overall score
  total_score: number;
  max_score: number;

  // Score breakdown (per assessment_artifact.md)
  build_score: number;          // Build & Types (15 pts max)
  core_score: number;            // Core Requirements (35 pts max)
  enhanced_score: number;        // Enhanced Features (25 pts max)

  // Detailed test results
  test_results: {
    build: {
      typescript_validation: boolean;    // 15 pts
      type_quality_penalty: number;      // -5 pts if excessive 'any'
    };
    core: {
      unlock_ui: boolean;                // 5 pts
      data_fetching: boolean;            // 15 pts
      list_rendering: boolean;           // 5 pts
      highlighting: boolean;             // 10 pts
    };
    enhanced: {
      gemini_api: boolean;               // 5 pts
      error_handling_500: boolean;       // 5 pts
      loading_state: boolean;            // 5 pts
      network_failure: boolean;          // 3 pts
      error_boundary: boolean;           // 2 pts (bonus)
    };
  };

  // Code commits
  commits: {
    id: string;
    message: string;
    timestamp: string;
    added_lines: number;
    deleted_lines: number;
    files_changed: string[];
  }[];

  // AI usage (if tracked)
  ai_prompts_count?: number;
  ai_provider?: string;
}

export const mockAssessmentResults: AssessmentResult[] = [
  {
    id: '1',
    candidate_id: 'cand-001',
    candidate_name: 'Alex Chen',
    candidate_email: 'alex.chen@email.com',
    session_id: 'sess-001',
    completed_at: '2024-01-15T14:32:00Z',
    duration_minutes: 18,
    total_score: 88,
    max_score: 95,
    build_score: 15,
    core_score: 32,
    enhanced_score: 23,
    test_results: {
      build: {
        typescript_validation: true,
        type_quality_penalty: 0,
      },
      core: {
        unlock_ui: true,
        data_fetching: true,
        list_rendering: true,
        highlighting: false,  // Lost 10 pts here
      },
      enhanced: {
        gemini_api: true,
        error_handling_500: true,
        loading_state: true,
        network_failure: true,
        error_boundary: false,
      },
    },
    commits: [
      {
        id: 'c1',
        message: 'feat: implement data fetching and list rendering',
        timestamp: '2024-01-15T14:18:00Z',
        added_lines: 124,
        deleted_lines: 8,
        files_changed: ['app/page.tsx', 'app/api/insights/performance/route.ts'],
      },
      {
        id: 'c2',
        message: 'feat: add error handling and loading states',
        timestamp: '2024-01-15T14:26:00Z',
        added_lines: 67,
        deleted_lines: 12,
        files_changed: ['app/page.tsx', 'components/ErrorBoundary.tsx'],
      },
      {
        id: 'c3',
        message: 'feat: integrate Gemini API for summaries',
        timestamp: '2024-01-15T14:31:00Z',
        added_lines: 89,
        deleted_lines: 4,
        files_changed: ['app/api/insights/generate-summary/route.ts'],
      },
    ],
    ai_prompts_count: 12,
    ai_provider: 'Claude Code',
  },
  {
    id: '2',
    candidate_id: 'cand-002',
    candidate_name: 'Jordan Taylor',
    candidate_email: 'jordan.t@email.com',
    session_id: 'sess-002',
    completed_at: '2024-01-15T16:45:00Z',
    duration_minutes: 17,
    total_score: 95,
    max_score: 95,
    build_score: 15,
    core_score: 35,
    enhanced_score: 25,
    test_results: {
      build: {
        typescript_validation: true,
        type_quality_penalty: 0,
      },
      core: {
        unlock_ui: true,
        data_fetching: true,
        list_rendering: true,
        highlighting: true,
      },
      enhanced: {
        gemini_api: true,
        error_handling_500: true,
        loading_state: true,
        network_failure: true,
        error_boundary: true,  // Got bonus!
      },
    },
    commits: [
      {
        id: 'c4',
        message: 'feat: unlock UI and implement core data flow',
        timestamp: '2024-01-15T16:32:00Z',
        added_lines: 156,
        deleted_lines: 23,
        files_changed: ['app/page.tsx', 'app/api/insights/performance/route.ts', 'lib/types.ts'],
      },
      {
        id: 'c5',
        message: 'feat: add highlighting for high performers',
        timestamp: '2024-01-15T16:38:00Z',
        added_lines: 42,
        deleted_lines: 8,
        files_changed: ['app/page.tsx', 'components/PerformanceCard.tsx'],
      },
      {
        id: 'c6',
        message: 'feat: comprehensive error handling + loading states',
        timestamp: '2024-01-15T16:43:00Z',
        added_lines: 98,
        deleted_lines: 15,
        files_changed: ['app/page.tsx', 'components/ErrorBoundary.tsx', 'app/api/insights/generate-summary/route.ts'],
      },
    ],
    ai_prompts_count: 8,
    ai_provider: 'GitHub Copilot',
  },
  {
    id: '3',
    candidate_id: 'cand-003',
    candidate_name: 'Sam Rivera',
    candidate_email: 'sam.rivera@email.com',
    session_id: 'sess-003',
    completed_at: '2024-01-14T11:20:00Z',
    duration_minutes: 19,
    total_score: 63,
    max_score: 95,
    build_score: 10,
    core_score: 30,
    enhanced_score: 8,
    test_results: {
      build: {
        typescript_validation: true,
        type_quality_penalty: -5,  // Used too many 'any' types
      },
      core: {
        unlock_ui: true,
        data_fetching: true,
        list_rendering: true,
        highlighting: false,  // Missed this
      },
      enhanced: {
        gemini_api: true,
        error_handling_500: false,  // Missed error handling
        loading_state: false,        // No loading state
        network_failure: false,
        error_boundary: false,
      },
    },
    commits: [
      {
        id: 'c7',
        message: 'wip: basic data fetching',
        timestamp: '2024-01-14T11:08:00Z',
        added_lines: 78,
        deleted_lines: 12,
        files_changed: ['app/page.tsx'],
      },
      {
        id: 'c8',
        message: 'wip: render list',
        timestamp: '2024-01-14T11:14:00Z',
        added_lines: 45,
        deleted_lines: 6,
        files_changed: ['app/page.tsx'],
      },
      {
        id: 'c9',
        message: 'add gemini route',
        timestamp: '2024-01-14T11:19:00Z',
        added_lines: 34,
        deleted_lines: 2,
        files_changed: ['app/api/insights/generate-summary/route.ts'],
      },
    ],
    ai_prompts_count: 23,
    ai_provider: 'ChatGPT',
  },
  {
    id: '4',
    candidate_id: 'cand-004',
    candidate_name: 'Morgan Kim',
    candidate_email: 'morgan.k@email.com',
    session_id: 'sess-004',
    completed_at: '2024-01-13T09:55:00Z',
    duration_minutes: 16,
    total_score: 77,
    max_score: 95,
    build_score: 15,
    core_score: 35,
    enhanced_score: 12,
    test_results: {
      build: {
        typescript_validation: true,
        type_quality_penalty: 0,
      },
      core: {
        unlock_ui: true,
        data_fetching: true,
        list_rendering: true,
        highlighting: true,
      },
      enhanced: {
        gemini_api: true,
        error_handling_500: true,
        loading_state: false,  // Missed loading state
        network_failure: false,
        error_boundary: false,
      },
    },
    commits: [
      {
        id: 'c10',
        message: 'feat: complete core requirements',
        timestamp: '2024-01-13T09:42:00Z',
        added_lines: 167,
        deleted_lines: 19,
        files_changed: ['app/page.tsx', 'app/api/insights/performance/route.ts', 'components/PerformanceCard.tsx'],
      },
      {
        id: 'c11',
        message: 'feat: add gemini integration and error handling',
        timestamp: '2024-01-13T09:53:00Z',
        added_lines: 76,
        deleted_lines: 8,
        files_changed: ['app/page.tsx', 'app/api/insights/generate-summary/route.ts'],
      },
    ],
    ai_prompts_count: 6,
    ai_provider: 'Claude Code',
  },
];

// Helper to get score color
export function getScoreColor(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 90) return 'text-green-600';
  if (percentage >= 75) return 'text-blue-600';
  if (percentage >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

// Helper to get score badge color
export function getScoreBadgeColor(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 90) return 'bg-green-50 text-green-700 border-green-200';
  if (percentage >= 75) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (percentage >= 60) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

// Helper to get grade
export function getGrade(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 95) return 'A+';
  if (percentage >= 90) return 'A';
  if (percentage >= 85) return 'A-';
  if (percentage >= 80) return 'B+';
  if (percentage >= 75) return 'B';
  if (percentage >= 70) return 'B-';
  if (percentage >= 65) return 'C+';
  if (percentage >= 60) return 'C';
  return 'F';
}
