'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Github, Award, ExternalLink } from 'lucide-react';
import { CandidateBrief } from '@/lib/mockCompanyData';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CandidateTableProps {
  candidates: CandidateBrief[];
}

export default function CandidateTable({ candidates }: CandidateTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleRequestIntroduction = (candidateName: string) => {
    toast.success('Introduction request sent!', {
      description: `We'll connect you with ${candidateName} soon.`
    });
  };

  const getMatchColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (score >= 75) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-600 uppercase tracking-wide">
        <div className="col-span-3">Candidate</div>
        <div className="col-span-2">Experience</div>
        <div className="col-span-2">Match Score</div>
        <div className="col-span-2">Proven Claims</div>
        <div className="col-span-2">To Explore</div>
        <div className="col-span-1"></div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-zinc-100">
        {candidates.map((candidate, index) => (
          <motion.div
            key={candidate.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="group"
          >
            {/* Main Row */}
            <div
              onClick={() => toggleRow(candidate.id)}
              className="grid grid-cols-12 gap-4 px-6 py-4 cursor-pointer hover:bg-zinc-50 transition-colors"
            >
              {/* Candidate Name */}
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {getInitials(candidate.anonymized_name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 truncate">{candidate.anonymized_name}</p>
                  <p className="text-xs text-zinc-500 truncate">{candidate.school}</p>
                </div>
              </div>

              {/* Experience */}
              <div className="col-span-2 flex items-center">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{candidate.years_of_experience} years</p>
                  <p className="text-xs text-zinc-500">
                    {candidate.github_analysis.top_languages[0]?.language || 'Full-stack'}
                  </p>
                </div>
              </div>

              {/* Match Score */}
              <div className="col-span-2 flex items-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${getMatchColor(candidate.match_score)}`}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  {candidate.match_score}% Match
                </span>
              </div>

              {/* Proven Claims Count */}
              <div className="col-span-2 flex items-center">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    {candidate.proven_claims.length}
                  </span>
                  <span className="text-zinc-400">proven</span>
                </span>
              </div>

              {/* Unproven Claims Count */}
              <div className="col-span-2 flex items-center">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="flex items-center gap-1 text-amber-600 font-semibold">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    {candidate.unproven_claims.length}
                  </span>
                  <span className="text-zinc-400">to ask</span>
                </span>
              </div>

              {/* Expand Icon */}
              <div className="col-span-1 flex items-center justify-end">
                <motion.div
                  animate={{ rotate: expandedRow === candidate.id ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-zinc-400 group-hover:text-zinc-600"
                >
                  <ChevronDown className="w-5 h-5" />
                </motion.div>
              </div>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
              {expandedRow === candidate.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden bg-zinc-50"
                >
                  <div className="px-6 py-6 space-y-6">
                    {/* Two Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left Column: Proven Claims */}
                      <div>
                        <h4 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                          </svg>
                          Proven by Evidence
                        </h4>
                        <div className="space-y-2">
                          {candidate.proven_claims.map((claim, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="bg-white rounded-lg border border-emerald-100 p-3 hover:border-emerald-200 transition-colors"
                            >
                              <div className="flex items-start gap-2">
                                <Github className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900">{claim.claim}</p>
                                  <p className="text-xs text-zinc-500 mt-1">{claim.evidence_detail}</p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* GitHub Analysis */}
                        <div className="mt-4 bg-white rounded-lg border border-zinc-200 p-4">
                          <h5 className="text-xs font-semibold text-zinc-700 uppercase mb-3">GitHub Analysis</h5>
                          <div className="space-y-2">
                            {candidate.github_analysis.top_languages.map((lang, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="flex-1">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-xs font-medium text-zinc-700">{lang.language}</span>
                                    <span className="text-xs text-zinc-500">{lang.percentage}%</span>
                                  </div>
                                  <div className="w-full bg-zinc-100 rounded-full h-1.5">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${lang.percentage}%` }}
                                      transition={{ delay: 0.2 + idx * 0.1, duration: 0.5 }}
                                      className="bg-blue-600 h-1.5 rounded-full"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-600">
                            <span>Quality: <strong className="text-zinc-900">{candidate.github_analysis.quality_score}/100</strong></span>
                            <span>•</span>
                            <span>Active: <strong className="text-zinc-900">{candidate.github_analysis.active_months}mo</strong></span>
                            <span>•</span>
                            <span>Projects: <strong className="text-zinc-900">{candidate.github_analysis.meaningful_projects}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Unproven + Match Analysis */}
                      <div className="space-y-4">
                        {/* Unproven Claims */}
                        <div>
                          <h4 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                            </svg>
                            Explore in Interview
                          </h4>
                          <div className="space-y-2">
                            {candidate.unproven_claims.map((claim, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white rounded-lg border border-amber-100 p-3 hover:border-amber-200 transition-colors"
                              >
                                <p className="text-sm font-medium text-amber-900 mb-1">{claim.claim}</p>
                                <p className="text-xs text-amber-700 mb-2">Source: {claim.source === 'self_reported' ? 'Self-reported' : 'Resume'}</p>
                                <p className="text-xs text-zinc-600 italic">💬 "{claim.interview_question}"</p>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Match Analysis */}
                        <div className="bg-white rounded-lg border border-zinc-200 p-4">
                          <h5 className="text-xs font-semibold text-zinc-700 uppercase mb-3">Match Analysis</h5>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-medium text-emerald-700 mb-2">Strengths ({candidate.match_analysis.fit_areas.length})</p>
                              <ul className="space-y-1">
                                {candidate.match_analysis.fit_areas.slice(0, 3).map((area, idx) => (
                                  <li key={idx} className="text-xs text-zinc-700 flex items-start gap-2">
                                    <span className="text-emerald-600 mt-0.5">✓</span>
                                    <span>{area}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {candidate.match_analysis.gaps.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-amber-700 mb-2">Gaps ({candidate.match_analysis.gaps.length})</p>
                                <ul className="space-y-1">
                                  {candidate.match_analysis.gaps.map((gap, idx) => (
                                    <li key={idx} className="text-xs text-zinc-700 flex items-start gap-2">
                                      <span className="text-amber-600 mt-0.5">!</span>
                                      <span>{gap}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Assessment Highlights */}
                        {candidate.assessment_highlights && candidate.assessment_highlights.length > 0 && (
                          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                            <h5 className="text-xs font-semibold text-blue-700 uppercase mb-2 flex items-center gap-2">
                              <Award className="w-3.5 h-3.5" />
                              Assessment Highlights
                            </h5>
                            <ul className="space-y-1">
                              {candidate.assessment_highlights.map((highlight, idx) => (
                                <li key={idx} className="text-xs text-blue-900 flex items-start gap-2">
                                  <span className="text-blue-600 mt-0.5">•</span>
                                  <span>{highlight}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-4 border-t border-zinc-200 flex justify-end">
                      <Button
                        onClick={() => handleRequestIntroduction(candidate.anonymized_name)}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white"
                      >
                        Request Introduction
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
