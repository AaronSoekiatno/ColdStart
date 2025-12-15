"use client";

import { memo, useRef, useState, useEffect } from "react";
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
  isPremium?: boolean;
}

const MatchCardComponent = ({ match, isPremium = false }: MatchCardProps) => {
  const companySectionRef = useRef<HTMLDivElement>(null);
  const foundersSectionRef = useRef<HTMLDivElement>(null);
  // For premium users: array of selected indices (multiple selection)
  // For free users: array with max 1 item (single selection)
  const [selectedFounderIndices, setSelectedFounderIndices] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'company' | 'founders'>('company');
  
  // Initialize emailPersona from sessionStorage to survive Fast Refresh, default to 'direct-ask'
  const [emailPersona, setEmailPersona] = useState<'direct-ask' | 'genuine-fan' | 'value-first'>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('emailPersona');
      if (stored === 'genuine-fan' || stored === 'direct-ask' || stored === 'value-first') {
        return stored as 'direct-ask' | 'genuine-fan' | 'value-first';
      }
    }
    return 'direct-ask';
  });

  // Sync emailPersona to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('emailPersona', emailPersona);
      console.log(`[MatchCard] emailPersona changed to: ${emailPersona}, isPremium: ${isPremium}, saved to sessionStorage`);
    }
  }, [emailPersona, isPremium]);

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

  // Parse founder emails (comma-separated, one per founder)
  const founderEmails = startup.founder_emails
    ? startup.founder_emails.split(',').map(email => email.trim())
    : [];

  // Parse founder backgrounds - split by "Name:" pattern
  const founderBackgroundsArray = founderNames.map((name, idx) => {
    if (!startup.founder_backgrounds) return '';

    // Create regex to find "FounderName: background text"
    // Match from "Name:" until the next founder's "Name:" or end of string
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nextFounderName = idx < founderNames.length - 1 ? founderNames[idx + 1] : null;

    let pattern;
    if (nextFounderName) {
      const escapedNextName = nextFounderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = new RegExp(`${escapedName}:\\s*([\\s\\S]*?)(?=\\n*${escapedNextName}:|$)`, 'i');
    } else {
      // Last founder - match until end of string
      pattern = new RegExp(`${escapedName}:\\s*([\\s\\S]*)$`, 'i');
    }

    const match = startup.founder_backgrounds.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }

    return '';
  });

  // Get selected founder emails (single for free, multiple for premium)
  const selectedFounderEmails = selectedFounderIndices
    .map(index => founderEmails[index])
    .filter((email): email is string => !!email);
  
  // For backward compatibility with SendEmailButton, pass comma-separated string for multiple
  const selectedFounderEmail = selectedFounderEmails.length > 0 
    ? selectedFounderEmails.join(',') 
    : undefined;

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>, tab: 'company' | 'founders') => {
    if (ref.current) {
      // Calculate offset to account for sticky header (approximately 80px)
      const offset = 80;
      const elementPosition = ref.current.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Update active tab state
      setActiveTab(tab);
    }
  };

  // Update active tab based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (!companySectionRef.current || !foundersSectionRef.current) return;

      const companyRect = companySectionRef.current.getBoundingClientRect();
      const foundersRect = foundersSectionRef.current.getBoundingClientRect();
      const offset = 100; // Offset for sticky header

      // Check which section is more visible in the viewport
      const companyTop = companyRect.top;
      const foundersTop = foundersRect.top;

      // If founders section is in view and above the offset, switch to founders tab
      if (foundersTop <= offset && foundersTop > -foundersRect.height / 2) {
        setActiveTab('founders');
      } 
      // If company section is in view and above the offset, switch to company tab
      else if (companyTop <= offset && companyTop > -companyRect.height / 2) {
        setActiveTab('company');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <article className="relative rounded-2xl md:rounded-3xl bg-white px-3 pt-2 pb-4 sm:px-4 -pt-4 sm:pb-6 md:px-6 md:pb-8 lg:px-8 lg:pb-12 shadow-md w-full max-w-full">
      {/* Sticky Header Container - Desktop Only */}
      <div className="lg:sticky lg:top-[64px] lg:z-40 bg-white -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 pt-2.5 sm:px-4 md:px-6 lg:px-8 lg:rounded-t-2xl lg:rounded-t-3xl">
        {/* Top Header with Tabs and Generate Email Button */}
        <div className="mb-2 flex items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => scrollToSection(companySectionRef, 'company')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'company'
                  ? 'text-gray-900 border-blue-500'
                  : 'text-gray-700 hover:text-gray-900 border-transparent hover:border-blue-300'
              }`}
            >
              Company
            </button>
            <button
              onClick={() => scrollToSection(foundersSectionRef, 'founders')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'founders'
                  ? 'text-gray-900 border-blue-500'
                  : 'text-gray-700 hover:text-gray-900 border-transparent hover:border-blue-300'
              }`}
            >
              Founders
            </button>
          </div>
          {/* Email Persona Selection (Premium Only) and Generate Email Button */}
          {match.startup.id && (
            <div className="flex items-center gap-7">
              {/* Email Persona Selection - Premium Only */}
              {isPremium && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEmailPersona('direct-ask');
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('emailPersona', 'direct-ask');
                      }
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      emailPersona === 'direct-ask'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Direct Ask
                  </button>
                  <button
                    onClick={() => {
                      console.log(`[MatchCard] Genuine Fan clicked - current: ${emailPersona}, isPremium: ${isPremium}`);
                      setEmailPersona('genuine-fan');
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('emailPersona', 'genuine-fan');
                      }
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      emailPersona === 'genuine-fan'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Genuine Fan
                  </button>
                  <button
                    onClick={() => {
                      console.log(`[MatchCard] Value-First clicked - current: ${emailPersona}, isPremium: ${isPremium}`);
                      setEmailPersona('value-first');
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('emailPersona', 'value-first');
                      }
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      emailPersona === 'value-first'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Value-First
                  </button>
                </div>
              )}
              {/* Generate Email Button */}
              {(() => {
                // Double-check sessionStorage in case state was reset by Fast Refresh
                let finalPersona = emailPersona;
                if (typeof window !== 'undefined' && isPremium === true) {
                  const storedPersona = sessionStorage.getItem('emailPersona');
                  if (storedPersona === 'genuine-fan' || storedPersona === 'direct-ask' || storedPersona === 'value-first') {
                    finalPersona = storedPersona as 'direct-ask' | 'genuine-fan' | 'value-first';
                    // Sync state if it was reset
                    if (finalPersona !== emailPersona) {
                      console.log(`[MatchCard] State mismatch detected - state: ${emailPersona}, sessionStorage: ${storedPersona}, syncing...`);
                      setEmailPersona(finalPersona);
                    }
                  }
                }
                const computedPersona = (isPremium === true) ? finalPersona : 'direct-ask';
                console.log(`[MatchCard] Rendering SendEmailButton - isPremium: ${isPremium}, emailPersona: ${emailPersona}, finalPersona: ${finalPersona}, computed persona: ${computedPersona}`);
                return (
                  <SendEmailButton
                    startupId={match.startup.id}
                    matchScore={match.score}
                    founderEmail={selectedFounderEmail}
                    persona={computedPersona}
                    variant="default"
                    requiresFounderSelection={founderNames.length > 0}
                    isFounderSelected={selectedFounderIndices.length > 0}
                    className="rounded-md md:rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-0.5 text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm cursor-pointer"
                  />
                );
              })()}
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
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 text-left">Active Founders</h3>
            <p className="text-sm sm:text-base text-gray-600">
              {isPremium ? 'Select founders' : 'Select a founder'}
            </p>
          </div>
          <div className="flex flex-col gap-3 md:gap-4">
            {/* Founder Cards - one for each founder */}
            {founderNames.map((founderName, index) => {
              const nameParts = founderName.trim().split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              const initial = firstName[0] || lastName[0] || '?';

              const isSelected = selectedFounderIndices.includes(index);
              
              const handleFounderToggle = (e?: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => {
                if (e) {
                  e.stopPropagation();
                }
                if (isPremium) {
                  // Premium: toggle selection (multiple allowed)
                  setSelectedFounderIndices(prev => 
                    prev.includes(index)
                      ? prev.filter(i => i !== index)
                      : [...prev, index]
                  );
                } else {
                  // Free: single selection only
                  setSelectedFounderIndices(prev => 
                    prev.includes(index) ? [] : [index]
                  );
                }
              };
              
              const handleCardClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                handleFounderToggle(e);
              };

              return (
                <div 
                  key={index} 
                  className={`bg-white rounded-xl md:rounded-2xl shadow-sm border p-3 sm:p-4 md:p-5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-300 border-2 bg-blue-50' 
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                  onClick={handleCardClick}
                >
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
                      {founderBackgroundsArray[index] && (
                        <div className="text-xs sm:text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                          {founderBackgroundsArray[index]}
                        </div>
        )}
      </div>
                    {/* Selection Control - Checkbox for premium, Radio for free */}
                    <div className="flex-shrink-0 flex items-center">
                      <input
                        type={isPremium ? "checkbox" : "radio"}
                        name={isPremium ? `founder-checkbox-${index}` : "founder-selection"}
                        checked={isSelected}
                        onChange={handleFounderToggle}
                        className={`w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer ${
                          isPremium ? 'rounded' : ''
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      />
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

