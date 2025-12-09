"use client";

import { memo } from "react";
import Image from "next/image";
import { DollarSign, ExternalLink } from "lucide-react";
import { SendEmailButton } from "./SendEmailButton";
import ycLogo from "../images/ycLogo.svg";

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
      description?: string;
      company_logo?: string;
      yc_link?: string;
    } | null;
  };
}

const MatchCardComponent = ({ match }: MatchCardProps) => {
  if (!match.startup) {
    return null;
  }

  return (
    <article className="relative rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-xl p-4 sm:p-6 md:p-8 lg:p-12 shadow-lg min-h-[500px] md:min-h-[600px] w-full max-w-full">
      {match.score >= 0.5 && (
        <span className="absolute -top-2 -left-2 md:-left-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm font-bold shadow-lg rounded-lg z-10 transform -rotate-14">
          Perfect
        </span>
      )}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 md:mb-6">
        <div className="flex-1 w-full">
          {/* Industry and Batch badges with Match score aligned */}
          <div className="mb-3 md:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {match.startup.industry && (
                <span className="inline-block bg-blue-500/10 border border-blue-500 rounded-xl md:rounded-2xl px-2 py-1 md:px-3 md:py-1 text-xs md:text-sm text-white/90 font-medium">
                  {match.startup.industry}
                </span>
              )}
              {match.startup.batch && (
                <span className="inline-block bg-white/10 border border-white/20 rounded-xl md:rounded-2xl px-2 py-1 md:px-3 md:py-1 text-xs md:text-sm text-white/90 font-medium">
                  {match.startup.batch}
                </span>
              )}
            </div>
            <div className="bg-white/10 border border-white/20 rounded-3xl md:rounded-4xl px-2 py-1.5 md:px-3 md:py-2 shadow-sm self-start sm:self-auto">
              <p className="text-lg md:text-xl lg:text-2xl font-bold text-blue-300">
                {Math.min((match.score * 100) + 40, 97).toFixed(0)}% <span className="text-sm md:text-base font-normal text-white/70 align-top inline-block mt-0.5 md:mt-1">match</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4">
            {/* Logo */}
            <div className="flex-shrink-0 flex flex-col">
              {match.startup.company_logo ? (
                <Image
                  src={match.startup.company_logo}
                  alt={`${match.startup.name} logo`}
                  width={112}
                  height={112}
                  className="object-contain w-16 h-auto sm:w-20 md:w-24 lg:w-28"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-lg bg-white/5 border border-white/10"></div>
                </div>
              )}
              <div className="mt-3 md:mt-5 flex gap-2">
                {match.startup.website && (
                  <a
                    href={match.startup.website.startsWith('http')
                      ? match.startup.website
                      : `https://${match.startup.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 md:gap-2 rounded-lg bg-white/10 border border-white/20 px-2 py-1.5 md:px-2 md:py-2 text-sm md:text-base text-white/90 font-medium w-fit"
                  >
                    <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </a>
                )}
                {match.startup.yc_link && (
                  <a
                    href={match.startup.yc_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-white/10 border border-white/20 px-2 py-1.5 md:px-2 md:py-2 w-fit"
                  >
                    <Image
                      src={ycLogo}
                      alt="Y Combinator"
                      width={14}
                      height={14}
                      className="object-contain md:w-4 md:h-4"
                    />
                  </a>
                )}
              </div>
            </div>
            {/* Name and Description stacked */}
            <div className="flex-1 w-full min-w-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-2 break-words">
                {match.startup.name}
              </h2>
              {match.startup.description && (
                <>
                  <p className="text-sm sm:text-base md:text-md text-white/70 mb-3 break-words">
                    {match.startup.description}
                  </p>
                  {match.startup.location && (
                    <div className="group relative h-[36px] md:h-[40px] w-[120px] md:w-[140px] [perspective:1000px]">
                      <div className="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                        {/* Front side - Headquarters */}
                        <div className="absolute inset-0 [backface-visibility:hidden] rounded-xl md:rounded-2xl bg-white/10 px-2.5 md:px-3 py-1.5 md:py-2 flex items-center justify-center">
                          <span className="text-xs md:text-sm text-white/90 font-medium">Headquarters</span>
                        </div>
                        {/* Back side - Location */}
                        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-xl md:rounded-2xl bg-white/10 px-2.5 md:px-3 py-1.5 md:py-2 flex items-center justify-center">
                          <span className="text-xs md:text-sm text-white/90 font-medium text-center leading-tight">{match.startup.location}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 md:mt-8 space-y-3 md:space-y-4 text-sm sm:text-base md:text-lg text-white/90">
        {match.startup.funding_stage && (
          <div className="flex items-start gap-2 md:gap-3">
            <DollarSign className="text-white/60 w-4 h-4 md:w-5 md:h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white/60 text-xs md:text-sm mb-1">Funding</p>
              <p className="text-white/90 text-sm md:text-base">
                {match.startup.funding_stage}
                {match.startup.funding_amount && ` • ${match.startup.funding_amount}`}
              </p>
            </div>
          </div>
        )}
        {match.startup.tags && (
          <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/20">
            <p className="text-white/60 text-xs md:text-sm mb-2">Tags</p>
            <p className="text-xs sm:text-sm md:text-base uppercase tracking-widest text-blue-300 font-semibold break-words">
              {match.startup.tags}
            </p>
          </div>
        )}
      </div>
      {match.startup.id && (
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 md:bottom-8 md:right-8 lg:bottom-12 lg:right-12">
          <SendEmailButton
            startupId={match.startup.id}
            matchScore={match.score}
            founderEmail={match.startup.founder_emails}
            variant="default"
            className="rounded-lg md:rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm"
          />
        </div>
      )}
    </article>
  );
};

export const MatchCard = memo(MatchCardComponent);

