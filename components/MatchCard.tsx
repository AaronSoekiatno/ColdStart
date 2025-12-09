"use client";

import { memo } from "react";
import { MapPin, DollarSign, ExternalLink } from "lucide-react";
import { SendEmailButton } from "./SendEmailButton";

interface MatchCardProps {
  match: {
    id: string;
    score: number;
    matched_at: string;
    startup: {
      id?: string;
      name: string;
      industry: string;
      location: string;
      funding_stage: string;
      funding_amount: string;
      tags: string;
      website: string;
      founder_emails?: string;
      batch?: string;
    } | null;
  };
}

const MatchCardComponent = ({ match }: MatchCardProps) => {
  if (!match.startup) {
    return null;
  }

  return (
    <article className="relative rounded-3xl bg-white/10 backdrop-blur-xl p-8 md:p-12 shadow-lg min-h-[600px]">
      {match.score >= 0.5 && (
        <span className="absolute -top-2 -left-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 text-sm font-bold shadow-lg rounded-lg z-10 transform -rotate-14">
          Perfect-Fit
        </span>
      )}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 pr-4">
          {match.startup.batch && (
            <div className="mb-3">
              <span className="inline-block bg-white/10 border border-white/20 rounded-2xl px-3 py-1 text-sm text-white/90 font-medium">
                {match.startup.batch}
              </span>
            </div>
          )}
          <div className="flex items-center gap-4 mb-2">
            {/* Logo placeholder */}
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/5 border border-white/10"></div>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white">
              {match.startup.name}
            </h2>
          </div>
          <p className="text-lg text-white/70">{match.startup.industry}</p>
        </div>
        <div className="text-right ml-4 flex-shrink-0 flex flex-col items-end gap-3">
          {match.startup.id && (
            <SendEmailButton
              startupId={match.startup.id}
              matchScore={match.score}
              founderEmail={match.startup.founder_emails}
              variant="default"
              className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm"
            />
          )}
          <div>
            <p className="text-sm text-white/60 mb-1">Match score</p>
            <p className="text-3xl md:text-4xl font-bold text-blue-300">
              {Math.min((match.score * 100) + 40, 97).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4 text-base md:text-lg text-white/90">
        {match.startup.location && (
          <div className="flex items-start gap-3">
            <MapPin className="text-white/60 w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white/60 text-sm mb-1">Location</p>
              <p className="text-white/90">{match.startup.location}</p>
            </div>
          </div>
        )}
        {match.startup.funding_stage && (
          <div className="flex items-start gap-3">
            <DollarSign className="text-white/60 w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white/60 text-sm mb-1">Funding</p>
              <p className="text-white/90">
                {match.startup.funding_stage}
                {match.startup.funding_amount && ` • ${match.startup.funding_amount}`}
              </p>
            </div>
          </div>
        )}
        {match.startup.tags && (
          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-white/60 text-sm mb-2">Tags</p>
            <p className="text-sm md:text-base uppercase tracking-widest text-blue-300 font-semibold">
              {match.startup.tags}
            </p>
          </div>
        )}
      </div>

          {match.startup.website && (
        <div className="mt-10">
          <a
            href={match.startup.website.startsWith('http')
              ? match.startup.website
              : `https://${match.startup.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white/90 font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Website</span>
          </a>
        </div>
      )}
    </article>
  );
};

export const MatchCard = memo(MatchCardComponent);

