'use client';

import React, { useState } from 'react';
import {
  Github,
  Code,
  CheckCircle,
  AlertCircle,
  GraduationCap,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Award,
  Clock,
  Sparkles
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CandidateBrief } from '@/lib/mockCompanyData';
import MatchScoreBreakdown from './MatchScoreBreakdown';
import { toast } from 'sonner';

interface CandidateBriefCardProps {
  candidate: CandidateBrief;
}

export default function CandidateBriefCard({ candidate }: CandidateBriefCardProps) {
  const [showGitHubDetails, setShowGitHubDetails] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);

  const handleRequestIntroduction = () => {
    toast.success('Introduction request sent!', {
      description: "We'll connect you with this candidate soon."
    });
  };

  const getEvidenceIcon = (source: string) => {
    switch (source) {
      case 'github':
        return <Github className="w-3.5 h-3.5" />;
      case 'assessment':
        return <Award className="w-3.5 h-3.5" />;
      case 'verified_resume':
        return <CheckCircle className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <Card className="p-6 bg-white shadow-md hover:shadow-lg transition-shadow">
      <div className="space-y-6">
        {/* Header: Candidate Info + Match Score */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Candidate Info */}
          <div className="flex-1 flex gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
              {candidate.avatar_url ? (
                <img
                  src={candidate.avatar_url}
                  alt={candidate.anonymized_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                  {candidate.anonymized_name[0]}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {candidate.anonymized_name}
              </h3>
              <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-gray-400" />
                  <span>{candidate.school}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <span>{candidate.years_of_experience} years experience</span>
                </div>
              </div>
            </div>
          </div>

          {/* Match Score - Compact on mobile, full on desktop */}
          <div className="lg:w-64 flex-shrink-0">
            <MatchScoreBreakdown
              score={candidate.match_score}
              matchAnalysis={candidate.match_analysis}
              compact={false}
            />
          </div>
        </div>

        {/* Why Hire Summary */}
        {candidate.why_hire_summary && (
          <div className="bg-gray-50 border-l-4 border-blue-400 rounded-r-lg p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Why Hire
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">{candidate.why_hire_summary}</p>
          </div>
        )}

        {/* Real World Experience */}
        {candidate.real_world_experience && candidate.real_world_experience.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gray-600" />
              Real-World Experience
            </h4>
            <div className="space-y-3">
              {candidate.real_world_experience.map((exp, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{exp.role}</p>
                      <p className="text-xs text-gray-600">{exp.company} · {exp.duration}</p>
                    </div>
                    {exp.verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-700">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {exp.key_achievements.map((achievement, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-gray-400 mt-0.5">→</span>
                        <span>{achievement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Proven Claims Section */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Proven Claims ({candidate.proven_claims.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {candidate.proven_claims.map((claim, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200 px-3 py-1.5 text-sm group cursor-help relative"
                title={`Source: ${claim.evidence_source}\n${claim.evidence_detail}`}
              >
                <span className="flex items-center gap-1.5">
                  {getEvidenceIcon(claim.evidence_source)}
                  {claim.claim}
                </span>
              </Badge>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            These claims are backed by verified evidence from GitHub, assessments, or verified sources
          </p>
        </div>

        {/* Unproven Claims Section */}
        {candidate.unproven_claims.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              To Explore in Interview ({candidate.unproven_claims.length})
            </h4>
            <div className="space-y-2">
              {candidate.unproven_claims.map((claim, idx) => (
                <div
                  key={idx}
                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-900">
                        {claim.claim}
                      </p>
                      <p className="text-xs text-yellow-700 mt-0.5">
                        Source: {claim.source === 'self_reported' ? 'Self-reported' : 'Resume'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-yellow-800 ml-6 italic">
                    Suggested question: "{claim.interview_question}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GitHub Analysis */}
        <div>
          <button
            onClick={() => setShowGitHubDetails(!showGitHubDetails)}
            className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 mb-3 hover:text-blue-600 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Github className="w-4 h-4" />
              GitHub Analysis
            </span>
            {showGitHubDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Summary (always visible) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Quality Score</div>
              <div className="text-lg font-semibold text-gray-900">
                {candidate.github_analysis.quality_score}/100
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Active Period</div>
              <div className="text-lg font-semibold text-gray-900">
                {candidate.github_analysis.active_months}mo
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Projects</div>
              <div className="text-lg font-semibold text-gray-900">
                {candidate.github_analysis.meaningful_projects}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Top Language</div>
              <div className="text-lg font-semibold text-gray-900">
                {candidate.github_analysis.top_languages[0].language}
              </div>
            </div>
          </div>

          {/* Detailed view (collapsible) */}
          {showGitHubDetails && (
            <div className="space-y-3 border-t pt-3">
              <div>
                <h5 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                  Language Breakdown
                </h5>
                <div className="space-y-2">
                  {candidate.github_analysis.top_languages.map((lang, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-700">{lang.language}</span>
                          <span className="text-sm font-medium text-gray-900">
                            {lang.percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${lang.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Assessment Highlights */}
        {candidate.assessment_highlights && candidate.assessment_highlights.length > 0 && (
          <div>
            <button
              onClick={() => setShowAssessment(!showAssessment)}
              className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 mb-3 hover:text-blue-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Assessment Results
              </span>
              {showAssessment ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAssessment && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <ul className="space-y-2">
                  {candidate.assessment_highlights.map((highlight, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-blue-900">
                      <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4 border-t">
          <Button
            onClick={handleRequestIntroduction}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Request Introduction
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
