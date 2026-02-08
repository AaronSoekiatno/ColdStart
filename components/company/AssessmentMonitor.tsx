'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  CheckCircle2,
  XCircle,
  Code2,
  GitCommit,
  Clock,
  Award,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  mockAssessmentResults,
  getScoreColor,
  getScoreBadgeColor,
  getGrade,
  type AssessmentResult,
} from '@/lib/mockAssessmentData';

export default function AssessmentMonitor() {
  const [selectedResult, setSelectedResult] = useState<AssessmentResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({
    build: true,
    core: true,
    enhanced: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const formatDuration = (minutes: number) => {
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate stats
  const avgScore =
    mockAssessmentResults.reduce((sum, r) => sum + r.total_score, 0) /
    mockAssessmentResults.length;
  const perfectScores = mockAssessmentResults.filter((r) => r.total_score === r.max_score).length;
  const avgDuration =
    mockAssessmentResults.reduce((sum, r) => sum + r.duration_minutes, 0) /
    mockAssessmentResults.length;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Award className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Avg Score</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-gray-900">{Math.round(avgScore)}</div>
            <div className="text-sm text-gray-500">/95</div>
          </div>
          <div className="text-xs text-gray-500 mt-1">{Math.round((avgScore / 95) * 100)}% pass rate</div>
        </Card>

        <Card className="p-4 bg-white border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Perfect Scores</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{perfectScores}</div>
          <div className="text-xs text-gray-500 mt-1">
            {Math.round((perfectScores / mockAssessmentResults.length) * 100)}% of candidates
          </div>
        </Card>

        <Card className="p-4 bg-white border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Avg Duration</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{Math.round(avgDuration)}m</div>
          <div className="text-xs text-gray-500 mt-1">20m limit</div>
        </Card>

        <Card className="p-4 bg-white border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Code2 className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Assessed</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{mockAssessmentResults.length}</div>
          <div className="text-xs text-gray-500 mt-1">Completed</div>
        </Card>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Assessment Results</h3>
        <div className="grid gap-4">
          {mockAssessmentResults.map((result) => {
            const percentage = Math.round((result.total_score / result.max_score) * 100);
            const grade = getGrade(result.total_score, result.max_score);
            const isSelected = selectedResult?.id === result.id;

            return (
              <Card
                key={result.id}
                className={cn(
                  'p-5 bg-white border cursor-pointer transition-all hover:shadow-md',
                  isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
                )}
                onClick={() => setSelectedResult(isSelected ? null : result)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {/* Grade Badge */}
                    <div
                      className={cn(
                        'w-16 h-16 rounded-xl flex flex-col items-center justify-center border-2',
                        getScoreBadgeColor(result.total_score, result.max_score)
                      )}
                    >
                      <div className="text-2xl font-black">{grade}</div>
                      <div className="text-[10px] font-bold opacity-60">{percentage}%</div>
                    </div>

                    {/* Candidate Info */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">{result.candidate_name}</h4>
                      <p className="text-sm text-gray-500">{result.candidate_email}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(result.completed_at)}
                        </span>
                        <span>•</span>
                        <span>{formatDuration(result.duration_minutes)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Score Summary */}
                  <div className="text-right">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn('text-3xl font-black', getScoreColor(result.total_score, result.max_score))}
                      >
                        {result.total_score}
                      </span>
                      <span className="text-lg text-gray-400">/{result.max_score}</span>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Bar */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <span>Score Breakdown</span>
                  </div>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-100">
                    <div
                      className="bg-blue-500"
                      style={{
                        width: `${(result.build_score / result.max_score) * 100}%`,
                      }}
                      title={`Build: ${result.build_score}/15`}
                    />
                    <div
                      className="bg-green-500"
                      style={{
                        width: `${(result.core_score / result.max_score) * 100}%`,
                      }}
                      title={`Core: ${result.core_score}/35`}
                    />
                    <div
                      className="bg-purple-500"
                      style={{
                        width: `${(result.enhanced_score / result.max_score) * 100}%`,
                      }}
                      title={`Enhanced: ${result.enhanced_score}/25`}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-gray-600">Build: {result.build_score}/15</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-gray-600">Core: {result.core_score}/35</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-gray-600">Enhanced: {result.enhanced_score}/25</span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <GitCommit className="w-4 h-4" />
                    <span>{result.commits.length} commits</span>
                  </div>
                  {result.ai_prompts_count && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {result.ai_prompts_count} AI prompts ({result.ai_provider})
                      </span>
                    </div>
                  )}
                  <div className="ml-auto text-sm text-gray-400">
                    {isSelected ? 'Click to collapse' : 'Click to expand'}
                  </div>
                </div>

                {/* Expanded Details */}
                {isSelected && (
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-6">
                    {/* Build & Types Section */}
                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection('build');
                        }}
                        className="flex items-center gap-2 w-full text-left mb-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                      >
                        {expandedSections.build ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <h5 className="font-bold text-gray-900">
                          Build & Types ({result.build_score}/15 pts)
                        </h5>
                      </button>
                      {expandedSections.build && (
                        <div className="space-y-2 ml-6">
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            {result.test_results.build.typescript_validation ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            )}
                            <span className="text-sm text-gray-700">TypeScript validation (15 pts)</span>
                          </div>
                          {result.test_results.build.type_quality_penalty < 0 && (
                            <div className="flex items-center gap-3 p-2 bg-red-50 rounded-lg border border-red-200">
                              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                              <span className="text-sm text-red-700">
                                Type quality penalty: {result.test_results.build.type_quality_penalty} pts (excessive 'any')
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Core Requirements Section */}
                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection('core');
                        }}
                        className="flex items-center gap-2 w-full text-left mb-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                      >
                        {expandedSections.core ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <h5 className="font-bold text-gray-900">
                          Core Requirements ({result.core_score}/35 pts)
                        </h5>
                      </button>
                      {expandedSections.core && (
                        <div className="space-y-2 ml-6">
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            {result.test_results.core.unlock_ui ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            )}
                            <span className="text-sm text-gray-700">Unlock UI (5 pts)</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            {result.test_results.core.data_fetching ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            )}
                            <span className="text-sm text-gray-700">Data fetching (15 pts)</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            {result.test_results.core.list_rendering ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            )}
                            <span className="text-sm text-gray-700">List rendering (5 pts)</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            {result.test_results.core.highlighting ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            )}
                            <span className="text-sm text-gray-700">Highlighting (10 pts)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Features Section */}
                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection('enhanced');
                        }}
                        className="flex items-center gap-2 w-full text-left mb-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                      >
                        {expandedSections.enhanced ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <h5 className="font-bold text-gray-900">
                          Enhanced Features ({result.enhanced_score}/25 pts)
                        </h5>
                      </button>
                      {expandedSections.enhanced && (
                        <div className="space-y-2 ml-6">
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            {result.test_results.enhanced.gemini_api ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            )}
                            <span className="text-sm text-gray-700">Gemini API integration (5 pts)</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            {result.test_results.enhanced.error_handling_500 ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            )}
                            <span className="text-sm text-gray-700">Error handling - 500 (5 pts)</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            {result.test_results.enhanced.loading_state ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            )}
                            <span className="text-sm text-gray-700">Loading state (5 pts)</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            {result.test_results.enhanced.network_failure ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                            )}
                            <span className="text-sm text-gray-700">Network failure handling (3 pts)</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
                            {result.test_results.enhanced.error_boundary ? (
                              <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-400 shrink-0" />
                            )}
                            <span className="text-sm text-purple-700">Error boundary (2 pts bonus)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Code Commits */}
                    <div>
                      <h5 className="font-bold text-gray-900 mb-3">
                        Code Activity ({result.commits.length} commits)
                      </h5>
                      <div className="space-y-2">
                        {result.commits.map((commit) => (
                          <div
                            key={commit.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm"
                          >
                            <GitCommit className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 font-medium">{commit.message}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                <span>{new Date(commit.timestamp).toLocaleTimeString()}</span>
                                <span>•</span>
                                <span className="text-green-600">+{commit.added_lines}</span>
                                <span className="text-red-600">-{commit.deleted_lines}</span>
                                <span>•</span>
                                <span className="truncate">{commit.files_changed.join(', ')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
