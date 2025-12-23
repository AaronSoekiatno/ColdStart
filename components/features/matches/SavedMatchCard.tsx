'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Bookmark, Mail, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MatchCard } from './MatchCard';
import { splitFounderNames } from '@/lib/clean-founder-names';

interface SavedMatchCardProps {
  match: {
    id: string;
    score: number;
    matched_at: string;
    has_job_listings?: boolean;
    jobs?: Array<{
      job_title: string;
      job_url: string;
      job_type?: string;
      salary_range?: string;
      experience_level?: string;
    }>;
    startup: {
      id?: string;
      name: string;
      industry: string;
      location: string;
      funding_amount?: string;
      website: string;
      founder_emails?: string;
      founder_names?: string;
      founder_linkedin?: string;
      founder_backgrounds?: string;
      founders_pfp?: string;
      batch?: string;
      description?: string;
      company_logo?: string;
      yc_link?: string;
      keywords?: string;
    } | null;
  };
  isPremium: boolean;
  userEmail: string;
  onToggleSave?: () => void;
  isSaved?: boolean;
}

export function SavedMatchCard({ match, isPremium, userEmail, onToggleSave, isSaved = true }: SavedMatchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFounderDropdown, setShowFounderDropdown] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const getCompanyLogo = () => {
    return match.startup?.company_logo || null;
  };

  const companyLogo = getCompanyLogo();
  // Match the score calculation from MatchCard (score * 100 + 40, capped at 97)
  const matchScore = Math.min((match.score * 100) + 40, 97).toFixed(0);

  // Parse founder data similar to MatchCard
  const founderData = useMemo(() => {
    const startup = match.startup;
    if (!startup) return { founderNames: [], founderEmails: [] };

    const founderNames = splitFounderNames(startup.founder_names, startup.name);
    const founderEmails = startup.founder_emails
      ? startup.founder_emails.split(',').map(email => email.trim())
      : [];

    return { founderNames, founderEmails };
  }, [match.startup]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowFounderDropdown(false);
      }
    };

    if (showFounderDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFounderDropdown]);

  const handleContactFounder = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If no founders, expand card to show full details
    if (founderData.founderNames.length === 0) {
      setIsExpanded(true);
      return;
    }

    // If only one founder with email, navigate directly
    if (founderData.founderNames.length === 1 && founderData.founderEmails[0]) {
      const params = new URLSearchParams();
      params.append('startupId', match.startup?.id || '');
      params.append('matchScore', match.score.toString());
      params.append('founderEmail', founderData.founderEmails[0]);
      router.push(`/generate-email?${params.toString()}`);
      return;
    }

    // Show dropdown for multiple founders
    setShowFounderDropdown(true);
  };

  const handleSelectFounder = (index: number) => {
    const founderEmail = founderData.founderEmails[index];
    if (!founderEmail) {
      // If no email, expand card to show full details
      setIsExpanded(true);
      setShowFounderDropdown(false);
      return;
    }

    const params = new URLSearchParams();
    params.append('startupId', match.startup?.id || '');
    params.append('matchScore', match.score.toString());
    params.append('founderEmail', founderEmail);
    router.push(`/generate-email?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
      {/* Compact Card Header */}
      <div
        className="p-4 flex items-center gap-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Company Logo */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-300 flex items-center justify-center text-white font-semibold text-lg shadow-sm overflow-hidden relative">
          {companyLogo ? (
            <Image
              src={`/api/image-proxy?url=${encodeURIComponent(companyLogo)}`}
              alt={match.startup?.name || 'Startup'}
              fill
              className="object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-lg">
              {match.startup?.name?.charAt(0).toUpperCase() || 'S'}
            </span>
          )}
        </div>

        {/* Startup Name */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {match.startup?.name || 'Unknown Startup'}
          </h3>
          <p className="text-sm text-gray-500 truncate">
            {match.startup?.keywords 
              ? `${match.startup.keywords.split(',').map((k: string) => k.trim()).join(' • ')} • ${match.startup?.industry} • ${match.startup?.location}`
              : `${match.startup?.industry} • ${match.startup?.location}`
            }
          </p>
        </div>

        {/* Match Score - Hidden when expanded */}
        {!isExpanded && (
          <div className="flex-shrink-0">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-2 py-0.5 sm:px-2.5 sm:py-1 shadow-sm w-fit min-w-[100px] flex items-center justify-center">
              <p className="text-xs sm:text-base font-bold text-blue-300 whitespace-nowrap">
                {matchScore}%
              </p>
            </div>
          </div>
        )}

        {/* Contact Founder Button - Hidden when expanded */}
        {!isExpanded && (
          <div className="flex-shrink-0 relative" onClick={(e) => e.stopPropagation()}>
            <button
              ref={buttonRef}
              onClick={handleContactFounder}
              className="flex items-center justify-center gap-1.5 rounded-md md:rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm cursor-pointer min-w-[120px] sm:min-w-[140px]"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Founder</span>
            </button>

            {/* Founder Selection Dropdown */}
            {showFounderDropdown && founderData.founderNames.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute right-0 top-full mt-2 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[200px] max-w-[280px] max-h-[300px] overflow-y-auto"
              >
                <div className="p-2 border-b border-gray-200 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">Select a founder</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFounderDropdown(false);
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
                <div className="py-1">
                  {founderData.founderNames.map((name, index) => {
                    const hasEmail = !!founderData.founderEmails[index];
                    return (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectFounder(index);
                        }}
                        disabled={!hasEmail}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                          hasEmail
                            ? 'text-gray-900 cursor-pointer'
                            : 'text-gray-400 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <div className="font-medium">{name}</div>
                        {!hasEmail && (
                          <div className="text-xs text-gray-500 mt-0.5">No email available</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Saved Button */}
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleSave}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={isSaved ? "Unsave match" : "Save match"}
          >
            <Bookmark
              className={`w-5 h-5 ${isSaved ? 'fill-blue-300 text-blue-300' : 'text-gray-400'}`}
            />
          </button>
        </div>

        {/* Dropdown Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Full Card */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          <MatchCard
            match={match}
            isPremium={isPremium}
            userEmail={userEmail}
            initialIsSaved={true}
          />
        </div>
      )}
    </div>
  );
}

