'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Award,
  Clock,
  Code2,
  GitCommit,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  mockAssessmentResults,
  getScoreColor,
  getScoreBadgeColor,
  getGrade,
  type AssessmentResult,
} from '@/lib/mockAssessmentData';

export default function AssessmentResultsDashboard() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  // Calculate stats
  const avgScore =
    mockAssessmentResults.reduce((sum, r) => sum + r.total_score, 0) / mockAssessmentResults.length;
  const perfectScores = mockAssessmentResults.filter((r) => r.total_score === r.max_score).length;
  const avgDuration =
    mockAssessmentResults.reduce((sum, r) => sum + r.duration_minutes, 0) /
    mockAssessmentResults.length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Award className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-zinc-500">Avg Score</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-zinc-900">{Math.round(avgScore)}</span>
            <span className="text-sm text-zinc-400">/95</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">{Math.round((avgScore / 95) * 100)}% pass rate</p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-zinc-500">Perfect Scores</span>
          </div>
          <span className="text-3xl font-bold text-zinc-900">{perfectScores}</span>
          <p className="text-xs text-zinc-500 mt-1">
            {Math.round((perfectScores / mockAssessmentResults.length) * 100)}% of total
          </p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-zinc-500">Avg Time</span>
          </div>
          <span className="text-3xl font-bold text-zinc-900">{Math.round(avgDuration)}m</span>
          <p className="text-xs text-zinc-500 mt-1">20m limit</p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-zinc-500">Completed</span>
          </div>
          <span className="text-3xl font-bold text-zinc-900">{mockAssessmentResults.length}</span>
          <p className="text-xs text-zinc-500 mt-1">Total assessments</p>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-600 uppercase tracking-wide">
          <div className="col-span-3">Candidate</div>
          <div className="col-span-2">Score</div>
          <div className="col-span-2">Build</div>
          <div className="col-span-2">Core</div>
          <div className="col-span-2">Enhanced</div>
          <div className="col-span-1"></div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-zinc-100">
          {mockAssessmentResults.map((result) => {
            const percentage = Math.round((result.total_score / result.max_score) * 100);
            const grade = getGrade(result.total_score, result.max_score);
            const isExpanded = expandedRow === result.id;

            return (
              <div key={result.id} className="group">
                {/* Main Row */}
                <div
                  onClick={() => toggleRow(result.id)}
                  className="grid grid-cols-12 gap-4 px-6 py-4 cursor-pointer hover:bg-zinc-50 transition-colors"
                >
                  {/* Candidate */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {getInitials(result.candidate_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 truncate">{result.candidate_name}</p>
                      <p className="text-xs text-zinc-500 truncate">{formatDate(result.completed_at)}</p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="col-span-2 flex items-center">
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${getScoreBadgeColor(
                        result.total_score,
                        result.max_score
                      )}`}
                    >
                      <span className="text-xl font-black">{grade}</span>
                      <div className="h-4 w-px bg-current opacity-20" />
                      <span className="text-sm font-bold">{percentage}%</span>
                    </div>
                  </div>

                  {/* Build Score */}
                  <div className="col-span-2 flex items-center">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-bold text-zinc-900">{result.build_score}</span>
                          <span className="text-xs text-zinc-400">/15</span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-1 mt-1">
                          <div
                            className="bg-blue-500 h-1 rounded-full transition-all"
                            style={{ width: `${(result.build_score / 15) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Core Score */}
                  <div className="col-span-2 flex items-center">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-bold text-zinc-900">{result.core_score}</span>
                          <span className="text-xs text-zinc-400">/35</span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-1 mt-1">
                          <div
                            className="bg-emerald-500 h-1 rounded-full transition-all"
                            style={{ width: `${(result.core_score / 35) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Score */}
                  <div className="col-span-2 flex items-center">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-bold text-zinc-900">{result.enhanced_score}</span>
                          <span className="text-xs text-zinc-400">/25</span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-1 mt-1">
                          <div
                            className="bg-purple-500 h-1 rounded-full transition-all"
                            style={{ width: `${(result.enhanced_score / 25) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expand Icon */}
                  <div className="col-span-1 flex items-center justify-end">
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-zinc-400 group-hover:text-zinc-600"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </motion.div>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden bg-zinc-50"
                    >
                      <div className="px-6 py-6 space-y-6">
                        {/* Quick Stats */}
                        <div className="flex items-center gap-6 text-sm text-zinc-600">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>
                              Completed in <strong className="text-zinc-900">{result.duration_minutes}m</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <GitCommit className="w-4 h-4" />
                            <span>
                              <strong className="text-zinc-900">{result.commits.length}</strong> commits
                            </span>
                          </div>
                          {result.ai_prompts_count && (
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              <span>
                                <strong className="text-zinc-900">{result.ai_prompts_count}</strong> AI prompts (
                                {result.ai_provider})
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Test Results Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Build & Types */}
                          <div>
                            <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              Build & Types ({result.build_score}/15)
                            </h4>
                            <div className="space-y-2">
                              <div className="bg-white rounded-lg border border-zinc-200 p-3">
                                <div className="flex items-center gap-2">
                                  {result.test_results.build.typescript_validation ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                                  )}
                                  <span className="text-sm text-zinc-700">TypeScript validation</span>
                                </div>
                              </div>
                              {result.test_results.build.type_quality_penalty < 0 && (
                                <div className="bg-red-50 rounded-lg border border-red-200 p-3">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                                    <span className="text-sm text-red-700">
                                      Type quality penalty ({result.test_results.build.type_quality_penalty} pts)
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Core Requirements */}
                          <div>
                            <h4 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              Core Requirements ({result.core_score}/35)
                            </h4>
                            <div className="space-y-2">
                              {[
                                { key: 'unlock_ui', label: 'Unlock UI', pts: 5 },
                                { key: 'data_fetching', label: 'Data fetching', pts: 15 },
                                { key: 'list_rendering', label: 'List rendering', pts: 5 },
                                { key: 'highlighting', label: 'Highlighting', pts: 10 },
                              ].map(({ key, label, pts }) => (
                                <div key={key} className="bg-white rounded-lg border border-zinc-200 p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {result.test_results.core[key as keyof typeof result.test_results.core] ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                      ) : (
                                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                                      )}
                                      <span className="text-sm text-zinc-700">{label}</span>
                                    </div>
                                    <span className="text-xs text-zinc-400">{pts} pts</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Enhanced Features */}
                          <div>
                            <h4 className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-purple-500" />
                              Enhanced Features ({result.enhanced_score}/25)
                            </h4>
                            <div className="space-y-2">
                              {[
                                { key: 'gemini_api', label: 'Gemini API', pts: 5, bonus: false },
                                { key: 'error_handling_500', label: 'Error handling', pts: 5, bonus: false },
                                { key: 'loading_state', label: 'Loading state', pts: 5, bonus: false },
                                { key: 'network_failure', label: 'Network failure', pts: 3, bonus: false },
                                { key: 'error_boundary', label: 'Error boundary', pts: 2, bonus: true },
                              ].map(({ key, label, pts, bonus }) => (
                                <div
                                  key={key}
                                  className={`rounded-lg border p-3 ${
                                    bonus ? 'bg-purple-50 border-purple-200' : 'bg-white border-zinc-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {result.test_results.enhanced[
                                        key as keyof typeof result.test_results.enhanced
                                      ] ? (
                                        <CheckCircle2
                                          className={`w-4 h-4 shrink-0 ${bonus ? 'text-purple-600' : 'text-emerald-600'}`}
                                        />
                                      ) : (
                                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                                      )}
                                      <span className={`text-sm ${bonus ? 'text-purple-700' : 'text-zinc-700'}`}>
                                        {label}
                                      </span>
                                    </div>
                                    <span className={`text-xs ${bonus ? 'text-purple-400' : 'text-zinc-400'}`}>
                                      {pts} pts {bonus && '★'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Code Commits */}
                        <div className="pt-4 border-t border-zinc-200">
                          <h4 className="text-sm font-semibold text-zinc-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <GitCommit className="w-4 h-4 text-zinc-700" />
                            Code Activity ({result.commits.length} commits)
                          </h4>
                          <div className="space-y-2">
                            {result.commits.map((commit) => (
                              <div key={commit.id} className="bg-white rounded-lg border border-zinc-200 p-3">
                                <p className="text-sm font-medium text-zinc-900 mb-2">{commit.message}</p>
                                <div className="flex items-center gap-4 text-xs text-zinc-500">
                                  <span>{new Date(commit.timestamp).toLocaleTimeString()}</span>
                                  <span>•</span>
                                  <span className="text-emerald-600 font-medium">+{commit.added_lines}</span>
                                  <span className="text-red-600 font-medium">-{commit.deleted_lines}</span>
                                  <span>•</span>
                                  <span className="truncate">{commit.files_changed.join(', ')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
