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
    <article className="relative rounded-2xl md:rounded-3xl bg-white px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8 lg:py-12 shadow-md min-h-[500px] md:min-h-[600px] w-full max-w-full overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 md:mb-6">
        <div className="flex-1 w-full">
          {/* Industry and Batch badges with Match score aligned */}
          <div className="mb-3 md:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {match.startup.industry && (
                <span className="inline-block bg-blue-50 border border-blue-500 rounded-xl md:rounded-2xl px-2 py-1 md:px-3 md:py-1 text-xs md:text-sm text-gray-900 font-medium">
                  {match.startup.industry}
                </span>
              )}
              {match.startup.batch && (
                <span className="inline-block bg-gray-50 border border-gray-300 rounded-xl md:rounded-2xl px-2 py-1 md:px-3 md:py-1 text-xs md:text-sm text-gray-900 font-medium">
                  {match.startup.batch}
                </span>
              )}
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-3xl md:rounded-4xl px-2 py-1.5 md:px-3 md:py-2 shadow-sm self-start sm:self-auto transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-blue-300/50">
              <p className="text-lg md:text-xl lg:text-2xl font-bold text-blue-300">
                {Math.min((match.score * 100) + 40, 97).toFixed(0)}% <span className="text-sm md:text-base font-normal text-gray-600 align-top inline-block mt-0.5 md:mt-1">match</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 md:gap-5 lg:gap-6">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-start">
              {match.startup.company_logo ? (
                <Image
                  src={match.startup.company_logo}
                  alt={`${match.startup.name} logo`}
                  width={112}
                  height={112}
                  className="object-contain w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-lg"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-lg bg-gray-100 border border-gray-300"></div>
                </div>
              )}
            </div>
            {/* Name, Description, and Links - aligned with logo */}
            <div className="flex-1 w-full min-w-0 flex flex-col -mt-3">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 mb-1 sm:mb-1.5 break-words leading-tight">
                {match.startup.name}
              </h2>
              {match.startup.description && (
                <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-1.5 sm:mb-2 break-words leading-relaxed">
                  {match.startup.description}
                </p>
              )}
              {/* Website and YC buttons underneath description */}
              <div className="flex gap-2 flex-wrap -mt-0.5">
                {match.startup.website && (
                  <a
                    href={match.startup.website.startsWith('http')
                      ? match.startup.website
                      : `https://${match.startup.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 sm:gap-1.5 md:gap-2 rounded-xl sm:rounded-2xl bg-gray-50 border border-gray-300 px-2 py-1 sm:px-2.5 sm:py-1.5 md:px-3 md:py-2 text-xs sm:text-sm text-gray-900 font-medium w-fit hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                    <span>Website</span>
                  </a>
                )}
                {match.startup.yc_link && (
                  <a
                    href={match.startup.yc_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-gray-50 border border-gray-300 w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <Image
                      src={ycLogo}
                      alt="Y Combinator"
                      width={14}
                      height={14}
                      className="object-contain w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4"
                    />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Line separator */}
      <div className="mx-2 sm:mx-3 md:mx-4 lg:mx-6 mt-6 md:mt-8 border-t border-gray-200"></div>

      <div className="mt-6 md:mt-8 space-y-3 md:space-y-4 text-sm sm:text-base md:text-lg text-gray-900">
        {match.startup.funding_stage && (
          <div className="flex items-start gap-2 md:gap-3">
            <DollarSign className="text-gray-500 w-4 h-4 md:w-5 md:h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs md:text-sm mb-1">Funding</p>
              <p className="text-gray-900 text-sm md:text-base">
                {match.startup.funding_stage}
                {match.startup.funding_amount && ` • ${match.startup.funding_amount}`}
              </p>
            </div>
          </div>
        )}
        {match.startup.tags && (
          <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
            <p className="text-gray-500 text-xs md:text-sm mb-2">Tags</p>
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
            className="rounded-lg md:rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm cursor-pointer"
          />
        </div>
      )}
    </article>
  );
};

export const MatchCard = memo(MatchCardComponent);

