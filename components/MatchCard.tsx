"use client";

import { memo, useRef, useState, useEffect } from "react";
import Image from "next/image";
import { DollarSign, ExternalLink, ChevronDown, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { splitFounderNames } from "@/lib/clean-founder-names";
import { UpgradeModal } from "./UpgradeModal";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
      yc_description?: string;
      team_size?: string;
      founder_emails?: string;
      founder_names?: string;
      founder_linkedin?: string;
      founder_twitter_urls?: string;
      founder_backgrounds?: string;
      founders_pfp?: string;
      batch?: string;
      description?: string;
      company_logo?: string;
      yc_link?: string;
      company_twitter_url?: string;
      founders?: Array<{
        id: string;
        name: string;
        email?: string;
        role?: string;
        linkedin_url?: string;
        twitter_url?: string;
        background?: string;
        profile_picture?: string;
      }>;
    } | null;
  };
  isPremium?: boolean;
  userEmail?: string;
}

const MatchCardComponent = ({ match, isPremium = false, userEmail = '' }: MatchCardProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const companySectionRef = useRef<HTMLDivElement>(null);
  const foundersSectionRef = useRef<HTMLDivElement>(null);
  // Single founder selection (always single selection for all users)
  const [selectedFounderIndex, setSelectedFounderIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'company' | 'founders'>('company');
  const [showFullYcDescription, setShowFullYcDescription] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [emailDropdownOpen, setEmailDropdownOpen] = useState(false);
  // Track failed image loads to fall back to placeholder
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  
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

  // Helper to truncate YC description to first two sentences
  const getTruncatedYcDescription = (text?: string | null): string | null => {
    if (!text) return null;
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return null;

    // Split on sentence-ending punctuation followed by space + capital or quote
    const sentenceEndRegex = /([.!?])\s+(?=[A-Z"'\u2018\u2019\u201C\u201D])/g;
    const parts: string[] = [];
    let lastIndex = 0;
    let matchRegex: RegExpExecArray | null;

    while ((matchRegex = sentenceEndRegex.exec(normalized)) !== null && parts.length < 2) {
      const endIndex = matchRegex.index + matchRegex[1].length;
      parts.push(normalized.slice(lastIndex, endIndex).trim());
      lastIndex = endIndex + 1; // skip space
    }

    if (parts.length === 0) {
      return normalized;
    }

    if (parts.length < 2 && lastIndex < normalized.length) {
      parts.push(normalized.slice(lastIndex).trim());
    }

    return parts.slice(0, 2).join(" ");
  };

  const fullYcDescription = startup.yc_description ?? "";
  const truncatedYcDescription = getTruncatedYcDescription(fullYcDescription);
  const shouldShowYcToggle =
    !!truncatedYcDescription &&
    fullYcDescription.trim().length > truncatedYcDescription.length;

  // Use founders from founders table if available, otherwise fall back to CSV columns
  const foundersFromTable = startup.founders && startup.founders.length > 0
    ? startup.founders
    : null;

  // Parse founder data - prefer founders table, fallback to CSV columns
  const founderNames = foundersFromTable
    ? foundersFromTable.map(f => f.name)
    : splitFounderNames(startup.founder_names);

  const founderLinkedInUrls = foundersFromTable
    ? foundersFromTable.map(f => f.linkedin_url || '')
    : (startup.founder_linkedin
        ? startup.founder_linkedin.split(',').map(url => url.trim())
        : []);

  const founderTwitterUrls = foundersFromTable
    ? foundersFromTable.map(f => f.twitter_url || '')
    : (startup.founder_twitter_urls
        ? startup.founder_twitter_urls.split(',').map(url => url.trim())
        : []);

  const founderEmails = foundersFromTable
    ? foundersFromTable.map(f => f.email || '')
    : (startup.founder_emails
        ? startup.founder_emails.split(',').map(email => email.trim())
        : []);

  // Get profile pictures - prefer from founders table, fallback to founders_pfp array
  const founderProfilePictures: string[] = [];
  
  if (foundersFromTable) {
    // Use profile_picture from founders table if available
    for (let i = 0; i < foundersFromTable.length; i++) {
      const profilePicture = foundersFromTable[i].profile_picture;
      if (profilePicture) {
        founderProfilePictures[i] = profilePicture;
      }
    }
  }
  
  // Fallback: Use founders_pfp from startup (handles case when founders table doesn't exist)
  if (startup.founders_pfp) {
    // Parse founders_pfp - handle both array and string formats
    let founderProfilePicturesRaw: string[] = [];
    
    if (Array.isArray(startup.founders_pfp)) {
      // PostgreSQL array comes as array
      founderProfilePicturesRaw = startup.founders_pfp
        .map(url => String(url).trim())
        .filter(url => url && url !== '');
    } else if (typeof startup.founders_pfp === 'string') {
      // Comma-separated string
      founderProfilePicturesRaw = startup.founders_pfp
        .split(',')
        .map(url => url.trim())
        .filter(url => url && url !== '');
    }

    // Map profile pictures to founders by index
    // If founders table doesn't exist, use founders_pfp for all founders
    // If founders table exists, only fill in missing ones
    for (let i = 0; i < founderNames.length; i++) {
      // If founders table doesn't exist OR this index doesn't have a picture yet, use founders_pfp
      if (!foundersFromTable || !founderProfilePictures[i]) {
        if (founderProfilePicturesRaw[i]) {
          founderProfilePictures[i] = founderProfilePicturesRaw[i];
        }
      }
    }
  }

  // Debug: Log founder profile pictures
  const parsedPfp = startup.founders_pfp 
    ? (Array.isArray(startup.founders_pfp)
        ? startup.founders_pfp
        : startup.founders_pfp.split(',').map(url => url.trim()))
    : [];
  
  console.log('[MatchCard] Profile picture debug:', {
    startupName: startup.name,
    foundersFromTable: foundersFromTable?.length || 0,
    foundersPfpFromStartup: startup.founders_pfp,
    foundersPfpType: typeof startup.founders_pfp,
    foundersPfpIsArray: Array.isArray(startup.founders_pfp),
    parsedPfpArray: parsedPfp,
    founderNames,
    founderNamesCount: founderNames.length,
    founderProfilePictures,
    founderProfilePicturesLength: founderProfilePictures.length,
    founderProfilePicturesByIndex: founderProfilePictures.map((url, idx) => ({ index: idx, name: founderNames[idx], url }))
  });

  // Parse founder backgrounds - use from founders table if available, otherwise parse CSV
  const founderBackgroundsArray = foundersFromTable
    ? foundersFromTable.map(f => f.background || '')
    : founderNames.map((name, idx) => {
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

  // Get selected founder email (single selection only)
  const selectedFounderEmail = selectedFounderIndex !== null && founderEmails[selectedFounderIndex]
    ? founderEmails[selectedFounderIndex]
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
    <article className="relative rounded-xl sm:rounded-2xl md:rounded-3xl bg-white px-2.5 pt-2 pb-3 sm:px-4 sm:pb-6 md:px-6 md:pb-8 lg:px-8 lg:pb-12 shadow-md w-full max-w-full">
      {/* Sticky Header Container - Desktop Only */}
      <div className="lg:sticky lg:top-[64px] lg:z-40 bg-white -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 pt-2.5 sm:px-4 md:px-6 lg:px-8 lg:rounded-t-2xl lg:rounded-t-3xl">
        {/* Top Header with Tabs and Generate Email Button */}
        <div className="mb-4 flex items-center justify-between gap-4">
          {/* Tabs on left */}
          <div className="flex gap-1 sm:gap-3">
            <button
              onClick={() => scrollToSection(companySectionRef, 'company')}
              className={`px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'company'
                  ? 'text-gray-900 border-blue-500'
                  : 'text-gray-700 hover:text-gray-900 border-transparent hover:border-blue-300'
              }`}
            >
              Company
            </button>
            <button
              onClick={() => scrollToSection(foundersSectionRef, 'founders')}
              className={`px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'founders'
                  ? 'text-gray-900 border-blue-500'
                  : 'text-gray-700 hover:text-gray-900 border-transparent hover:border-blue-300'
              }`}
            >
              Founders
            </button>
          </div>
          {/* Generate Email Dropdown - Right aligned */}
          {match.startup.id && (
            <div className="flex-shrink-0">
              <DropdownMenu open={emailDropdownOpen} onOpenChange={setEmailDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-md md:rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 sm:px-5 sm:py-2.5 text-sm sm:text-base font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm cursor-pointer">
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Email</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-72 !bg-white !border-gray-200 !shadow-lg !text-gray-900 !backdrop-blur-none"
                  style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}
                >
                  <DropdownMenuLabel className="!text-gray-900 px-3 py-2 font-semibold">Choose Email Style</DropdownMenuLabel>
                  <DropdownMenuSeparator className="!bg-gray-200" />
                  <DropdownMenuItem
                    onClick={() => {
                      // Check if founder selection is required but no founder is selected
                      if (founderNames.length > 0 && selectedFounderIndex === null) {
                        setEmailDropdownOpen(false);
                        toast({
                          title: "Select a founder",
                          description: "Please select a founder first before generating an email.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setEmailPersona('direct-ask');
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('emailPersona', 'direct-ask');
                      }
                      setEmailDropdownOpen(false);
                      // Navigate to email generation page
                      if (match.startup?.id) {
                        const params = new URLSearchParams();
                        params.append('startupId', match.startup.id);
                        params.append('matchScore', match.score.toString());
                        params.append('persona', 'direct-ask');
                        if (selectedFounderEmail) {
                          params.append('founderEmail', selectedFounderEmail);
                        }
                        router.push(`/generate-email?${params.toString()}`);
                      }
                    }}
                    className="!text-gray-900 cursor-pointer hover:!bg-gray-100 focus:!bg-gray-100 py-3 px-3"
                  >
                    <div className="w-full">
                      <div className="font-semibold mb-1">Direct Ask</div>
                      <div className="text-xs text-gray-600">Get straight to the point. Respectful and efficient.</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Premium check - show upgrade modal if not premium
                      if (!isPremium) {
                        setShowUpgradeModal(true);
                        setEmailDropdownOpen(false);
                        return;
                      }
                      // Check if founder selection is required but no founder is selected
                      if (founderNames.length > 0 && selectedFounderIndex === null) {
                        setEmailDropdownOpen(false);
                        toast({
                          title: "Select a founder",
                          description: "Please select a founder first before generating an email.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setEmailPersona('genuine-fan');
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('emailPersona', 'genuine-fan');
                      }
                      setEmailDropdownOpen(false);
                      // Navigate to email generation page
                      if (match.startup?.id) {
                        const params = new URLSearchParams();
                        params.append('startupId', match.startup.id);
                        params.append('matchScore', match.score.toString());
                        params.append('persona', 'genuine-fan');
                        if (selectedFounderEmail) {
                          params.append('founderEmail', selectedFounderEmail);
                        }
                        router.push(`/generate-email?${params.toString()}`);
                      }
                    }}
                    className="!text-gray-900 cursor-pointer hover:!bg-gray-100 focus:!bg-gray-100 py-3 px-3"
                  >
                    <div className="w-full">
                      <div className="font-semibold mb-1">Genuine Fan</div>
                      <div className="text-xs text-gray-600">Show authentic interest and personal connection.</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Premium check - show upgrade modal if not premium
                      if (!isPremium) {
                        setShowUpgradeModal(true);
                        setEmailDropdownOpen(false);
                        return;
                      }
                      // Check if founder selection is required but no founder is selected
                      if (founderNames.length > 0 && selectedFounderIndex === null) {
                        setEmailDropdownOpen(false);
                        toast({
                          title: "Select a founder",
                          description: "Please select a founder first before generating an email.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setEmailPersona('value-first');
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('emailPersona', 'value-first');
                      }
                      setEmailDropdownOpen(false);
                      // Navigate to email generation page
                      if (match.startup?.id) {
                        const params = new URLSearchParams();
                        params.append('startupId', match.startup.id);
                        params.append('matchScore', match.score.toString());
                        params.append('persona', 'value-first');
                        if (selectedFounderEmail) {
                          params.append('founderEmail', selectedFounderEmail);
                        }
                        router.push(`/generate-email?${params.toString()}`);
                      }
                    }}
                    className="!text-gray-900 cursor-pointer hover:!bg-gray-100 focus:!bg-gray-100 py-3 px-3"
                  >
                    <div className="w-full">
                      <div className="font-semibold mb-1">Value-First</div>
                      <div className="text-xs text-gray-600">Lead with what you can bring to the table.</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Separator below top header */}
        <div className="mb-3 sm:mb-4 md:mb-6 border-t border-gray-200"></div>
      </div>

      {/* Company Section */}
      <div ref={companySectionRef} className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 md:mb-6">
        <div className="flex-1 w-full">
          <div className="flex flex-row items-start gap-3 sm:gap-4 md:gap-5 lg:gap-6">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-start">
              {match.startup.company_logo ? (
                <Image
                  src={match.startup.company_logo}
                  alt={`${match.startup.name} logo`}
                  width={112}
                  height={112}
                  className="object-contain w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-lg"
                  unoptimized
                  loading="eager"
                />
              ) : (
                <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-lg bg-gray-100 border border-gray-300"></div>
                </div>
              )}
            </div>
            {/* Name, match score, description, and links - aligned with logo */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3 mb-1 sm:mb-1.5">
                <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 break-words leading-tight">
                  {match.startup.name}
                </h2>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl sm:rounded-3xl px-2 py-1 sm:px-3 sm:py-2 shadow-sm w-fit sm:min-w-[120px] flex items-center justify-center flex-shrink-0">
                  <p className="text-xs sm:text-base md:text-lg font-bold text-blue-300 whitespace-nowrap">
                    {Math.min((match.score * 100) + 40, 97).toFixed(0)}%{" "}
                    <span className="text-[10px] sm:text-sm font-normal text-gray-600 align-top inline-block ml-0.5">
                      match
                    </span>
                  </p>
                </div>
              </div>
              {match.startup.description && (
                <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-1.5 sm:mb-2 break-words leading-relaxed line-clamp-2 sm:line-clamp-none">
                  {match.startup.description}
          </p>
        )}
              {/* Website, YC, and Twitter buttons underneath description */}
              <div className="flex gap-1.5 sm:gap-2 flex-wrap mt-1 sm:-mt-0.5">
        {match.startup.website && (
          <a
            href={match.startup.website.startsWith('http')
              ? match.startup.website
              : `https://${match.startup.website}`}
            target="_blank"
            rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 sm:gap-1.5 md:gap-2 rounded-md sm:rounded-lg bg-gray-50 border border-gray-300 px-1.5 py-0.5 sm:px-2.5 sm:py-1.5 md:px-3 md:py-2 text-[10px] sm:text-sm text-gray-900 font-medium w-fit hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                    <span>Website</span>
                  </a>
                )}
                {match.startup.yc_link && (
                  <a
                    href={match.startup.yc_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-gray-50 border border-gray-300 w-5 h-5 sm:w-8 sm:h-8 md:w-10 md:h-10 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <Image
                      src="/images/ycLogo.svg"
                      alt="Y Combinator"
                      width={14}
                      height={14}
                      className="object-contain w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4"
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
                    className="inline-flex items-center justify-center rounded-full bg-gray-50 border border-gray-300 w-5 h-5 sm:w-8 sm:h-8 md:w-10 md:h-10 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <Image
                      src="/images/twitterLogo.svg"
                      alt="Twitter"
                      width={16}
                      height={16}
                      className="w-2.5 h-2.5 sm:w-4 sm:h-4"
                    />
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* YC Description and Stats row underneath logo + main header, centered */}
          {(
            truncatedYcDescription ||
            match.startup.industry ||
            match.startup.batch ||
            match.startup.team_size ||
            match.startup.location
          ) && (
            <div className="mt-4 sm:mt-5 md:mt-8 w-full flex flex-col items-start">
              {truncatedYcDescription && (
                <p className="text-[11px] sm:text-sm md:text-base text-gray-700 leading-relaxed text-left max-w-3xl">
                  {showFullYcDescription ? fullYcDescription : truncatedYcDescription}
                  {shouldShowYcToggle && (
                    <button
                      type="button"
                      onClick={() => setShowFullYcDescription((prev) => !prev)}
                      className="ml-2 text-[10px] sm:text-xs text-blue-300 hover:underline align-baseline"
                    >
                      {showFullYcDescription ? "Show less" : "Show more"}
                    </button>
                  )}
                </p>
              )}
              {/* Stats row: Company Size, Batch, Industry, Headquarters */}
              <div className="mt-4 sm:mt-6 md:mt-8 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 w-full max-w-4xl self-center">
                {/* Company Size */}
                {match.startup.team_size && (
                  <div className="text-left">
                    <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Company Size
                    </p>
                    <p className="text-[11px] sm:text-sm text-gray-900 mt-0.5 sm:mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {match.startup.team_size}
                    </p>
                  </div>
                )}
                {/* Batch */}
                {match.startup.batch && (
                  <div className="text-left">
                    <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Batch
                    </p>
                    <p className="text-[11px] sm:text-sm text-gray-900 mt-0.5 sm:mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {match.startup.batch}
                    </p>
                  </div>
                )}
                {/* Industry */}
                {match.startup.industry && (
                  <div className="text-left">
                    <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Industry
                    </p>
                    <p className="text-[11px] sm:text-xs text-gray-900 mt-0.5 sm:mt-1 overflow-hidden text-ellipsis">
                      {match.startup.industry}
                    </p>
                  </div>
                )}
                {/* Headquarters */}
                {match.startup.location && (
                  <div className="text-left">
                    <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Headquarters
                    </p>
                    <p className="text-[11px] sm:text-sm text-gray-900 mt-0.5 sm:mt-1 overflow-hidden text-ellipsis">
                      {match.startup.location}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Line separator */}
      <div className="mt-4 sm:mt-6 md:mt-8 border-t border-gray-200"></div>

      {/* Founders Section */}
      {founderNames.length > 0 && (
        <div ref={foundersSectionRef} className="mt-4 sm:mt-6 md:mt-8">
          <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
            <h3 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 text-left">Active Founders</h3>
            <p className="text-xs sm:text-base text-gray-600">
              Select a founder
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:gap-3 md:gap-4">
            {/* Founder Cards - one for each founder */}
            {founderNames.map((founderName, index) => {
              const nameParts = founderName.trim().split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              const initial = firstName[0] || lastName[0] || '?';

              const isSelected = selectedFounderIndex === index;
              
              const handleFounderToggle = (e?: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => {
                if (e) {
                  e.stopPropagation();
                }
                // Single selection only - toggle if clicking same, select if different
                setSelectedFounderIndex(prev => prev === index ? null : index);
              };
              
              const handleCardClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                handleFounderToggle(e);
              };

              return (
                <div 
                  key={index} 
                  className={`bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm border p-2.5 sm:p-4 md:p-5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-300 border-2 bg-blue-50' 
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                  onClick={handleCardClick}
                >
                  <div className="flex flex-row items-start gap-2.5 sm:gap-3 md:gap-4">
                    {/* Founder Photo */}
                    <div className="flex-shrink-0 w-12 h-12 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-lg sm:rounded-xl md:rounded-2xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden">
                      {founderProfilePictures[index] && founderProfilePictures[index].trim() !== '' && !failedImages.has(index) ? (
                        <Image
                          src={`/api/image-proxy?url=${encodeURIComponent(founderProfilePictures[index])}`}
                          alt={`${founderName} profile picture`}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          unoptimized
                          loading="eager"
                          onError={() => {
                            console.log(`[MatchCard] Image failed to load for founder ${founderName} at index ${index}:`, founderProfilePictures[index]);
                            setFailedImages(prev => new Set(prev).add(index));
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                          <span className="text-gray-400 text-lg sm:text-2xl md:text-3xl font-semibold">
                            {initial.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Founder Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <h4 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 truncate">
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
                            className="border border-gray-300 rounded-full p-1 sm:p-1.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Image
                              src="/images/linkedinLogo.svg"
                              alt="LinkedIn"
                              width={16}
                              height={16}
                              className="w-3 h-3 sm:w-4 sm:h-4"
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
                            className="border border-gray-300 rounded-full p-1 sm:p-1.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Image
                              src="/images/twitterLogo.svg"
                              alt="Twitter"
                              width={16}
                              height={16}
                              className="w-3 h-3 sm:w-4 sm:h-4"
                            />
                          </a>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-sm text-gray-500 mb-1 sm:mb-2 md:mb-3">Founder</p>
                      {founderBackgroundsArray[index] && (
                        <div className="text-[11px] sm:text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-line line-clamp-3 sm:line-clamp-none">
                          {founderBackgroundsArray[index]}
                        </div>
        )}
      </div>
                    {/* Selection Control - Radio button for single selection */}
                    <div className="flex-shrink-0 flex items-center self-center">
                      <input
                        type="radio"
                        name="founder-selection"
                        checked={isSelected}
                        onChange={handleFounderToggle}
                        className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
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
      {/* Upgrade Modal */}
      {userEmail && (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          hiddenMatchCount={0}
          email={userEmail}
          customTitle="Upgrade to Premium to Unlock Email Personas"
          isPremium={isPremium}
        />
      )}
    </article>
  );
};

export const MatchCard = memo(MatchCardComponent);

