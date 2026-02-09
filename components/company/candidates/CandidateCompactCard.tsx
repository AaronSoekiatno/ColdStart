'use client';

import React from 'react';
import { CandidateBrief } from '@/lib/mockCompanyData';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronRight } from 'lucide-react';

interface CandidateCompactCardProps {
  candidate: CandidateBrief;
  onExpand: (id: string) => void;
}

export const CandidateCompactCard: React.FC<CandidateCompactCardProps> = ({
  candidate,
  onExpand,
}) => {
  const {
    id,
    anonymized_name,
    avatar_url,
    years_of_experience,
    match_score,
    verdict,
    fit_snapshot,
  } = candidate;

  // Get match score color (light mode)
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 70) return 'bg-blue-500';
    return 'bg-amber-500';
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer group"
      onClick={() => onExpand(id)}
    >
      {/* Header: Avatar + Name + Score */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={avatar_url} alt={anonymized_name} />
            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
              {anonymized_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-gray-900">{anonymized_name}</h3>
            <p className="text-sm text-gray-500">{years_of_experience}yrs experience</p>
          </div>
        </div>
        <div className={`${getScoreColor(match_score)} text-white text-lg font-bold rounded-lg px-3 py-1.5 shadow-sm`}>
          {match_score}
        </div>
      </div>

      {/* Quick Summary */}
      {verdict && (
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-900">{verdict.level}</p>
          <p className="text-xs text-gray-600 mt-0.5">{verdict.confidence}</p>
        </div>
      )}

      {/* Quick Fits - Single line each */}
      {fit_snapshot && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-500 font-semibold">{fit_snapshot.strong_fits.length} Strong</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-500 font-semibold">{fit_snapshot.needs_validation.length} To Explore</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </div>
      )}
    </div>
  );
};
