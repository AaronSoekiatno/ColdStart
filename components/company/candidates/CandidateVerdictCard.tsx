'use client';

import React from 'react';
import { CandidateBrief } from '@/lib/mockCompanyData';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronDown } from 'lucide-react';

interface CandidateVerdictCardProps {
  candidate: CandidateBrief;
  onCollapse: () => void;
  onExpandFull: (id: string) => void;
  onMoveToInterview: (id: string) => void;
}

export const CandidateVerdictCard: React.FC<CandidateVerdictCardProps> = ({
  candidate,
  onCollapse,
  onExpandFull,
  onMoveToInterview,
}) => {
  const {
    id,
    anonymized_name,
    avatar_url,
    years_of_experience,
    match_score,
    verdict,
    fit_snapshot,
    work_simulation_summary,
    verified_experience_summary,
    ai_tooling_summary,
    interview_focus,
  } = candidate;

  // Get match score color (light mode)
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 70) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  return (
    <div className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-lg">
      {/* Close button */}
      <button
        onClick={onCollapse}
        className="float-right text-gray-400 hover:text-gray-600"
      >
        <ChevronDown className="w-5 h-5" />
      </button>

      {/* Header with avatar and score */}
      <div className="flex items-start justify-between mb-6 clear-right">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={avatar_url} alt={anonymized_name} />
            <AvatarFallback className="text-xl bg-blue-100 text-blue-700 font-semibold">
              {anonymized_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{anonymized_name}</h2>
            <p className="text-gray-600">Software Engineer • {years_of_experience}yrs</p>
          </div>
        </div>
        <div className={`${getScoreColor(match_score)} text-white text-2xl font-bold rounded-lg px-4 py-2 shadow-md`}>
          {match_score}
        </div>
      </div>

      {/* Verdict Section */}
      {verdict && (
        <div className="mb-5 pb-5 border-b border-gray-200">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Verdict</h3>
          <div className="space-y-1">
            <p className="text-base font-semibold text-gray-900">{verdict.level}</p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Confidence:</span> {verdict.confidence}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Why:</span> {verdict.reasoning}
            </p>
          </div>
        </div>
      )}

      {/* Fit Snapshot */}
      {fit_snapshot && (
        <div className="mb-5 pb-5 border-b border-gray-200">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Fit Snapshot</h3>
          <div className="grid grid-cols-2 gap-6">
            {/* Strong Fits Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Strong Fits</h4>
              <ul className="space-y-1.5">
                {fit_snapshot.strong_fits.map((fit, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-emerald-500 mt-0.5 shrink-0 font-semibold">•</span>
                    <span>{fit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Needs Validation Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Needs Validation</h4>
              <ul className="space-y-1.5">
                {fit_snapshot.needs_validation.map((need, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-amber-500 mt-0.5 shrink-0 font-semibold">•</span>
                    <span>{need}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Work Simulation Result */}
      {work_simulation_summary && work_simulation_summary.length > 0 && (
        <div className="mb-5 pb-5 border-b border-gray-200">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
            Work Simulation Result
          </h3>
          <ul className="space-y-1.5">
            {work_simulation_summary.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Verified Production Experience */}
      {verified_experience_summary && verified_experience_summary.length > 0 && (
        <div className="mb-5 pb-5 border-b border-gray-200">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
            Verified Production Experience
          </h3>
          <ul className="space-y-1.5">
            {verified_experience_summary.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Tooling */}
      {ai_tooling_summary && (
        <div className="mb-5 pb-5 border-b border-gray-200">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
            AI Tooling
          </h3>
          <p className="text-sm text-gray-700">{ai_tooling_summary}</p>
        </div>
      )}

      {/* Suggested Interview Focus */}
      {interview_focus && interview_focus.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
            Suggested Interview Focus
          </h3>
          <ul className="space-y-1.5">
            {interview_focus.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <Button
          variant="outline"
          className="flex-1 border-gray-300 hover:bg-gray-50"
          onClick={() => onExpandFull(id)}
        >
          <span>View Full Evidence</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
        <Button
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => onMoveToInterview(id)}
        >
          <span>Move to Interview</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};
