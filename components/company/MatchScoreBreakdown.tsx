import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { MatchAnalysis } from '@/lib/mockCompanyData';

interface MatchScoreBreakdownProps {
  score: number;
  matchAnalysis: MatchAnalysis;
  compact?: boolean;
}

export default function MatchScoreBreakdown({
  score,
  matchAnalysis,
  compact = false
}: MatchScoreBreakdownProps) {
  // Determine color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBorderColor = (score: number) => {
    if (score >= 80) return 'border-green-400';
    if (score >= 60) return 'border-yellow-400';
    return 'border-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return '#16a34a'; // green-600
    if (score >= 60) return '#ca8a04'; // yellow-600
    return '#dc2626'; // red-600
  };

  const scoreColor = getScoreColor(score);
  const borderColor = getBorderColor(score);
  const progressColor = getProgressColor(score);

  // Calculate circle progress
  const circumference = 2 * Math.PI * 36; // radius = 36
  const offset = circumference - (score / 100) * circumference;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Compact circular progress */}
        <div className="relative w-16 h-16">
          <svg className="transform -rotate-90 w-16 h-16">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="#e5e7eb"
              strokeWidth="6"
              fill="none"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke={progressColor}
              strokeWidth="6"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">Match Score</div>
          <div className="text-xs text-gray-500">
            {matchAnalysis.fit_areas.length} strengths • {matchAnalysis.gaps.length} gaps
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Full circular progress */}
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24">
          <svg className="transform -rotate-90 w-24 h-24">
            <circle
              cx="48"
              cy="48"
              r="36"
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="48"
              cy="48"
              r="36"
              stroke={progressColor}
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${scoreColor}`}>{score}</span>
            <span className="text-xs text-gray-500">Match</span>
          </div>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Overall Match</h4>
          <p className="text-xs text-gray-600">
            Based on skills, experience, and culture fit
          </p>
        </div>
      </div>

      {/* Fit Areas */}
      {matchAnalysis.fit_areas.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            Strengths ({matchAnalysis.fit_areas.length})
          </h5>
          <ul className="space-y-1.5">
            {matchAnalysis.fit_areas.map((area, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps */}
      {matchAnalysis.gaps.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
            Areas to Explore ({matchAnalysis.gaps.length})
          </h5>
          <ul className="space-y-1.5">
            {matchAnalysis.gaps.map((gap, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
