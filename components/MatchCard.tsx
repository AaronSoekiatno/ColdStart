"use client";

import { memo, useRef } from "react";
import Image from "next/image";
import { DollarSign, ExternalLink } from "lucide-react";
import { SendEmailButton } from "./SendEmailButton";
import { splitFounderNames } from "@/lib/clean-founder-names";

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
      founder_names?: string;
      founder_linkedin?: string;
      founder_twitter_urls?: string;
      founder_backgrounds?: string;
      batch?: string;
      description?: string;
      company_logo?: string;
      yc_link?: string;
      company_twitter_url?: string;
    } | null;
  };
}

const MatchCardComponent = ({ match }: MatchCardProps) => {
  const companySectionRef = useRef<HTMLDivElement>(null);
  const foundersSectionRef = useRef<HTMLDivElement>(null);

  if (!match.startup) {
    return null;
  }

  const startup = match.startup;

  // Parse founder names (comma-separated) and filter out false positives
  const founderNames = splitFounderNames(startup.founder_names);

  // Parse LinkedIn URLs (comma-separated, one per founder)
  const founderLinkedInUrls = startup.founder_linkedin
    ? startup.founder_linkedin.split(',').map(url => url.trim())
    : [];

  // Parse Twitter URLs (comma-separated, one per founder)
  const founderTwitterUrls = startup.founder_twitter_urls
    ? startup.founder_twitter_urls.split(',').map(url => url.trim())
    : [];

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <article className="relative rounded-2xl md:rounded-3xl bg-white px-3 pt-2 pb-4 sm:px-4 -pt-4 sm:pb-6 md:px-6 md:pb-8 lg:px-8 lg:pb-12 shadow-md w-full max-w-full">
      {/* Sticky Header Container - Desktop Only */}
      <div className="lg:sticky lg:top-[64px] lg:z-40 bg-white -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 pt-2.5 sm:px-4 md:px-6 lg:px-8 lg:rounded-t-2xl lg:rounded-t-3xl">
        {/* Top Header with Tabs and Generate Email Button */}
        <div className="mb-2 flex items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => scrollToSection(companySectionRef)}
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors border-b-2 border-transparent hover:border-blue-300"
            >
              Company
            </button>
            <button
              onClick={() => scrollToSection(foundersSectionRef)}
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors border-b-2 border-transparent hover:border-blue-300"
            >
              Founders
            </button>
          </div>
          {/* Generate Email Button */}
          {match.startup.id && (
            <div className="flex-shrink-0">
              <SendEmailButton
                startupId={match.startup.id}
                matchScore={match.score}
                founderEmail={match.startup.founder_emails}
                variant="default"
                className="rounded-md md:rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-0.5 text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Separator below top header */}
        <div className="mb-4 md:mb-6 border-t border-gray-200"></div>
      </div>

      {/* Company Section */}
      <div ref={companySectionRef} className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 md:mb-6">
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
            <div className="bg-gray-50 border border-gray-200 rounded-3xl px-2 py-1.5 md:px-3 md:py-2 shadow-sm self-start sm:self-auto transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-blue-300/50 w-[120px] sm:w-[130px] md:w-[140px] min-h-[32px] sm:min-h-[34px] md:min-h-[36px] flex items-center justify-center">
              <p className="text-lg md:text-xl lg:text-2xl font-bold text-blue-300 whitespace-nowrap">
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
              {/* Website, YC, and Twitter buttons underneath description */}
              <div className="flex gap-2 flex-wrap -mt-0.5">
                {match.startup.website && (
                  <a
                    href={match.startup.website.startsWith('http')
                      ? match.startup.website
                      : `https://${match.startup.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 sm:gap-1.5 md:gap-2 rounded-lg bg-gray-50 border border-gray-300 px-2 py-1 sm:px-2.5 sm:py-1.5 md:px-3 md:py-2 text-xs sm:text-sm text-gray-900 font-medium w-fit hover:bg-gray-100 transition-colors cursor-pointer"
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
                      src="/images/ycLogo.svg"
                      alt="Y Combinator"
                      width={14}
                      height={14}
                      className="object-contain w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4"
                    />
                  </a>
                )}
                {match.startup.company_twitter_url && (
                  <a
                    href={match.startup.company_twitter_url.startsWith('http')
                      ? match.startup.company_twitter_url
                      : `https://${match.startup.company_twitter_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-gray-50 border border-gray-300 w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <Image
                      src="/images/twitterLogo.svg"
                      alt="Twitter"
                      width={16}
                      height={16}
                      className="w-4 h-4 sm:w-4 sm:h-4"
                    />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Line separator */}
      <div className="mt-6 md:mt-8 border-t border-gray-200"></div>

      {/* Founders Section */}
      {founderNames.length > 0 && (
        <div ref={foundersSectionRef} className="mt-6 md:mt-8">
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4 text-left">Active Founders</h3>
          <div className="flex flex-col gap-3 md:gap-4">
            {/* Founder Cards - one for each founder */}
            {founderNames.map((founderName, index) => {
              const nameParts = founderName.trim().split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              const initial = firstName[0] || lastName[0] || '?';

              return (
                <div key={index} className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 md:p-5">
                  <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4">
                    {/* Founder Photo Placeholder */}
                    <div className="flex-shrink-0 w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                        <span className="text-gray-400 text-xl sm:text-2xl md:text-3xl font-semibold">
                          {initial.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {/* Founder Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                          {founderName}
                        </h4>
                        {/* LinkedIn Icon */}
                        {founderLinkedInUrls[index] && (
                          <a
                            href={founderLinkedInUrls[index].startsWith('http')
                              ? founderLinkedInUrls[index]
                              : `https://${founderLinkedInUrls[index]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border border-gray-300 rounded-full p-1.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <Image
                              src="/images/linkedinLogo.svg"
                              alt="LinkedIn"
                              width={16}
                              height={16}
                              className="w-4 h-4 sm:w-4 sm:h-4"
                            />
                          </a>
                        )}
                        {/* Twitter Icon */}
                        {founderTwitterUrls[index] && (
                          <a
                            href={founderTwitterUrls[index].startsWith('http')
                              ? founderTwitterUrls[index]
                              : `https://${founderTwitterUrls[index]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border border-gray-300 rounded-full p-1.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <Image
                              src="/images/twitterLogo.svg"
                              alt="Twitter"
                              width={16}
                              height={16}
                              className="w-4 h-4 sm:w-4 sm:h-4"
                            />
                          </a>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 mb-2 md:mb-3">Founder</p>
                      {startup.founder_backgrounds && index === 0 && (
                        <div className="text-xs sm:text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                          {startup.founder_backgrounds}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
};

export const MatchCard = memo(MatchCardComponent);

