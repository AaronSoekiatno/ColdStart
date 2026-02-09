'use client';

import React, { useState } from 'react';
import { CandidateBrief } from '@/lib/mockCompanyData';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CandidateFullEvidenceProps {
  candidate: CandidateBrief;
  onClose: () => void;
  onMoveToInterview: (id: string) => void;
}

const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">{title}</h3>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
};

export const CandidateFullEvidence: React.FC<CandidateFullEvidenceProps> = ({
  candidate,
  onClose,
  onMoveToInterview,
}) => {
  const {
    id,
    anonymized_name,
    avatar_url,
    years_of_experience,
    match_score,
    github_analysis,
    real_world_experience,
    assessment_details,
    ai_usage,
    proven_claims,
    unproven_claims,
  } = candidate;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 70) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto bg-white border border-gray-300 rounded-lg shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" onClick={onClose}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Summary
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => onMoveToInterview(id)}
              >
                <span>Move to Interview</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={avatar_url} alt={anonymized_name} />
                  <AvatarFallback className="text-xl bg-blue-100 text-blue-700 font-semibold">{anonymized_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{anonymized_name}</h1>
                  <p className="text-gray-600">Software Engineer • {years_of_experience}yrs</p>
                </div>
              </div>
              <div className={`${getScoreColor(match_score)} text-white text-2xl font-bold rounded-lg px-4 py-2`}>
                {match_score}
              </div>
            </div>
          </div>

          {/* Evidence Sections */}
          <div className="p-6 space-y-4">
            {/* Engineering Signal */}
            <CollapsibleSection title="Engineering Signal (Verified)" defaultOpen>
              <p className="text-sm text-gray-700">
                Primary language: <span className="font-medium">{github_analysis.top_languages[0]?.language || 'Unknown'}</span>
              </p>
              <p className="text-sm text-gray-700">
                Consistent production-level contributions for {github_analysis.active_months}+ months
              </p>
              <p className="text-sm text-gray-700">
                Refactoring- and debugging-heavy commit patterns
              </p>
              <p className="text-sm text-gray-700">
                Quality Score: <span className="font-medium">{github_analysis.quality_score}/100</span>
              </p>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-gray-600">Language Breakdown:</p>
                {github_analysis.top_languages.map((lang) => (
                  <div key={lang.language} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{lang.language}</span>
                      <span>{lang.percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${lang.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="text-xs text-gray-500 mt-2">
                  <p>Activity: {github_analysis.active_months} months</p>
                  <p>Projects: {github_analysis.meaningful_projects} meaningful projects</p>
                </div>
              </div>
            </CollapsibleSection>

            {/* Detailed Work History */}
            {real_world_experience && real_world_experience.length > 0 && (
              <CollapsibleSection title="Detailed Work History">
                <div className="space-y-4">
                  {real_world_experience.map((exp, index) => (
                    <div key={index} className="border-l-2 border-blue-500 pl-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800">{exp.role}</h4>
                          <p className="text-sm text-gray-600">
                            {exp.company} • {exp.duration}
                          </p>
                        </div>
                        {exp.verified && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                            Verified
                          </span>
                        )}
                      </div>
                      <ul className="mt-2 space-y-1">
                        {exp.key_achievements.map((achievement, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">•</span>
                            <span>{achievement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Full Assessment Breakdown */}
            {assessment_details && (
              <CollapsibleSection title="Full Assessment Breakdown">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Time to Complete</p>
                    <p className="text-sm text-gray-700">{assessment_details.time_to_complete}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Difficulty</p>
                    <p className="text-sm text-gray-700 capitalize">{assessment_details.problem_difficulty}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Code Quality Score</p>
                    <p className="text-sm text-gray-700">{assessment_details.code_quality_score}/100</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Test Coverage</p>
                    <p className="text-sm text-gray-700">{assessment_details.test_coverage}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Edge Cases Handled</p>
                    <p className="text-sm text-gray-700">{assessment_details.edge_cases_handled}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Approach Notes</p>
                  <p className="text-sm text-gray-600">{assessment_details.approach_notes}</p>
                </div>
              </CollapsibleSection>
            )}

            {/* Detailed AI Usage */}
            {ai_usage && (
              <CollapsibleSection title="Detailed AI Usage">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Tools</p>
                    <p className="text-sm text-gray-700">{ai_usage.tools_used.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Frequency</p>
                    <p className="text-sm text-gray-700 capitalize">{ai_usage.usage_frequency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Prompt Engineering</p>
                    <p className="text-sm text-gray-700 capitalize">{ai_usage.prompt_engineering_skill}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Use Cases</p>
                    <ul className="space-y-1">
                      {ai_usage.use_cases.map((useCase, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-gray-400 mt-0.5">•</span>
                          <span>{useCase}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* Proven Claims */}
            {proven_claims && proven_claims.length > 0 && (
              <CollapsibleSection title="Proven Claims (Evidence-Backed)">
                <div className="space-y-3">
                  {proven_claims.map((claim, index) => (
                    <div key={index} className="space-y-1">
                      <p className="text-sm font-medium text-emerald-400 flex items-start gap-2">
                        <span>✓</span>
                        <span>{claim.claim}</span>
                      </p>
                      <p className="text-xs text-gray-500 ml-5">
                        Source: {claim.evidence_source.replace('_', ' ')} - {claim.evidence_detail}
                      </p>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Interview Questions */}
            {unproven_claims && unproven_claims.length > 0 && (
              <CollapsibleSection title="Interview Questions (Auto-Generated)">
                <div className="space-y-4">
                  {unproven_claims.map((claim, index) => (
                    <div key={index} className="space-y-2">
                      <p className="text-sm font-medium text-amber-400 flex items-start gap-2">
                        <span>?</span>
                        <span>{claim.claim} ({claim.source.replace('_', ' ')})</span>
                      </p>
                      <p className="text-sm text-gray-600 ml-5 flex items-start gap-2">
                        <span className="text-gray-400">💬</span>
                        <span>"{claim.interview_question}"</span>
                      </p>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Summary
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => onMoveToInterview(id)}
              >
                <span>Move to Interview</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
