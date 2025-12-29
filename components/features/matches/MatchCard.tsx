"use client";

import { memo, useRef, useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { ExternalLink, Mail, AlertCircle, Bookmark, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { splitFounderNames } from "@/lib/clean-founder-names";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { formatJobRecency } from "@/lib/utils";

interface MatchCardProps {
  match: {
    id: string;
    score: number;
    matched_at: string;
    has_job_listings?: boolean;
    job?: {
      job_url?: string;
      job_title?: string;
      job_type?: string;
      salary_range?: string;
      experience_level?: string;
      created_at?: string;
    } | null;
    jobs?: Array<{
      job_url?: string;
      job_title?: string;
      job_type?: string;
      salary_range?: string;
      experience_level?: string;
      created_at?: string;
    }>;
    alsoConsider?: Array<{
      job_url?: string;
      job_title?: string;
      job_type?: string;
      salary_range?: string;
      experience_level?: string;
      created_at?: string;
    }>;
    startup: {
      id?: string;
      name: string;
      industry: string;
      location: string;
      funding_amount?: string;
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
      keywords?: string;
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
  initialIsSaved?: boolean;
  initialFounderError?: string | null;
  onFounderError?: (error: string | null) => void;
  onSaveToggle?: (matchId: string, isSaved: boolean) => void;
  currentIndex?: number;
}

const MatchCardComponent = ({ match, isPremium = false, userEmail = '', initialIsSaved = false, initialFounderError = null, onFounderError, onSaveToggle, currentIndex = 0 }: MatchCardProps) => {
  const router = useRouter();
  const companySectionRef = useRef<HTMLDivElement>(null);
  const applicationSectionRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'company' | 'apply'>('company');
  const [showFullYcDescription, setShowFullYcDescription] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // Single founder selection (always single selection for all users)
  const [selectedFounderIndex, setSelectedFounderIndex] = useState<number | null>(null);
  // Track error message for founder selection
  const [founderSelectionError, setFounderSelectionError] = useState<string | null>(initialFounderError);
  // Track failed image loads to fall back to placeholder
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  // Track loaded images to show them once they're ready
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  // Track manual tab clicks to prevent scroll handler from overriding
  const manualTabClickRef = useRef<{ tab: 'company' | 'apply'; timestamp: number } | null>(null);
  // Track if match is saved - initialize with prop if provided
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [showAlsoConsider, setShowAlsoConsider] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!match.startup) {
    return null;
  }

  const startup = match.startup;

  // Check if there are fresh jobs (posted within last 7 days)
  const hasFreshJobs = useMemo(() => {
    const jobsToCheck = match.jobs && match.jobs.length > 0 ? match.jobs : (match.job ? [match.job] : []);
    return jobsToCheck.some(job => {
      if (!job.created_at) return false;
      try {
        const created = new Date(job.created_at);
        if (isNaN(created.getTime())) return false;
        const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 7; // Fresh if posted within last 7 days
      } catch {
        return false;
      }
    });
  }, [match.jobs, match.job]);

  // Check if this is a stealth opportunity (no job listings)
  const isStealthOpportunity = useMemo(() => {
    const hasJobs = (match.jobs && match.jobs.length > 0) || match.job?.job_url;
    return !hasJobs;
  }, [match.jobs, match.job]);

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

  // Memoize founder data parsing to avoid re-parsing on every render
  // This ensures startup and founder data are processed together efficiently
  const founderData = useMemo(() => {
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

    return {
      founderNames,
      founderLinkedInUrls,
      founderTwitterUrls,
      founderEmails,
      founderProfilePictures,
      founderBackgroundsArray,
    };
  }, [startup.founders, startup.founder_names, startup.founder_linkedin, startup.founder_twitter_urls, startup.founder_emails, startup.founders_pfp, startup.founder_backgrounds]);

  // Destructure memoized founder data
  const { founderNames, founderLinkedInUrls, founderTwitterUrls, founderEmails, founderProfilePictures, founderBackgroundsArray } = founderData;

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>, tab: 'company' | 'apply') => {
    // Don't scroll to apply section if it doesn't exist
    if (tab === 'apply' && !match.job?.job_url) {
      return;
    }

    if (ref.current) {
      // Mark this as a manual tab click to prevent scroll handler from overriding
      manualTabClickRef.current = { tab, timestamp: Date.now() };

      // Calculate offset to account for sticky header (approximately 80px)
      const offset = 80;
      const elementPosition = ref.current.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      // Update active tab state immediately
      setActiveTab(tab);
    }
  };

  const handleSaveToggle = async () => {
    if (isSaving) return;

    // Optimistic update - update UI immediately
    const previousSavedState = isSaved;
    const newSavedState = !isSaved;
    setIsSaved(newSavedState);
    setIsSaving(true);
    
    // Immediately notify parent to update savedMatchIds (optimistic update)
    onSaveToggle?.(match.id, newSavedState);

    try {
      if (previousSavedState) {
        // Unsave the match
        const response = await fetch(`/api/matches/saved?matchId=${match.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          // Revert on failure - revert both local state and parent state
          setIsSaved(previousSavedState);
          onSaveToggle?.(match.id, previousSavedState);
          let errorData: any = {};
          try {
            errorData = await response.json();
          } catch {
            errorData = { message: await response.text().catch(() => 'Unknown error') };
          }
          console.error('Failed to unsave match:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            matchId: match.id,
          });
        }
        // Note: onSaveToggle was already called optimistically, no need to call again
      } else {
        // Save the match
        if (!match.id) {
          console.error('Cannot save match: match.id is missing');
          setIsSaved(previousSavedState);
          return;
        }

        const response = await fetch('/api/matches/saved', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            matchId: match.id,
            startupId: match.startup?.id, // Include startup_id as fallback
          }),
        });

        if (!response.ok && response.status !== 409) {
          // Revert on failure (except for 409 which means already saved) - revert both local and parent state
          setIsSaved(previousSavedState);
          onSaveToggle?.(match.id, previousSavedState);
          let errorData: any = {};
          try {
            errorData = await response.json();
          } catch {
            errorData = { message: await response.text().catch(() => 'Unknown error') };
          }
          console.error('Failed to save match:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            matchId: match.id,
          });
        }
        // Note: onSaveToggle was already called optimistically, no need to call again on success
      }
    } catch (error) {
      // Revert on error - revert both local and parent state
      setIsSaved(previousSavedState);
      onSaveToggle?.(match.id, previousSavedState);
      console.error('Error toggling save status:', error);
    } finally {
      setIsSaving(false);
    }
  };


  // Always sync saved state with prop - prop is the source of truth from Supabase
  // This ensures the bookmark icon reflects the actual saved state in the database
  useEffect(() => {
    setIsSaved(initialIsSaved);
  }, [initialIsSaved]);

  // Update active tab based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (!companySectionRef.current) return;

      // If a manual tab click happened recently (within 1 second), don't override it
      if (manualTabClickRef.current) {
        const timeSinceClick = Date.now() - manualTabClickRef.current.timestamp;
        if (timeSinceClick < 1000) {
          // Keep the manually selected tab active
          setActiveTab(manualTabClickRef.current.tab);
          return;
        } else {
          // Clear the manual click ref after 1 second
          manualTabClickRef.current = null;
        }
      }

      // If no application section, always show company tab
      const hasJobs = (match.jobs && match.jobs.length > 0) || match.job?.job_url;
      if (!hasJobs || !applicationSectionRef.current) {
        setActiveTab('company');
        return;
      }

      const offset = 100; // Offset for sticky header
      const viewportHeight = window.innerHeight;

      // Get positions of both sections
      const companyRect = companySectionRef.current.getBoundingClientRect();
      const applicationRect = applicationSectionRef.current.getBoundingClientRect();

      // Calculate how much of each section is visible in the viewport
      const companyVisibleTop = Math.max(0, companyRect.top);
      const companyVisibleBottom = Math.min(viewportHeight, companyRect.bottom);
      const companyVisibleHeight = Math.max(0, companyVisibleBottom - companyVisibleTop);

      const applicationVisibleTop = Math.max(0, applicationRect.top);
      const applicationVisibleBottom = Math.min(viewportHeight, applicationRect.bottom);
      const applicationVisibleHeight = Math.max(0, applicationVisibleBottom - applicationVisibleTop);

      // Determine which section is more prominently in view
      // Priority: whichever section has more visible area, or is closer to the top
      if (applicationVisibleHeight > 0 && applicationRect.top <= offset + 50) {
        // Application section is in view and near/above the offset
        setActiveTab('apply');
      } else if (companyVisibleHeight > 0 && companyRect.top <= offset + 50) {
        // Company section is in view and near/above the offset
        setActiveTab('company');
      } else if (applicationRect.top < companyRect.top) {
        // If neither is clearly in view, use whichever is higher on the page
        setActiveTab('apply');
      } else {
        setActiveTab('company');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [match.job?.job_url]);

  return (
    <article className="relative rounded-xl sm:rounded-2xl md:rounded-3xl bg-white px-2.5 pt-2 pb-3 sm:px-4 sm:pb-6 md:px-6 md:pb-8 lg:px-8 lg:pb-12 shadow-md w-full max-w-full">
      {/* Sticky Header Container - Desktop Only */}
      <div className="lg:sticky lg:top-[64px] lg:z-40 bg-white -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 pt-2.5 sm:px-4 md:px-6 lg:px-8 lg:rounded-t-2xl lg:rounded-t-3xl">
        {/* Top Header with Tabs and Contact Founder Button */}
        <div className="mb-4 flex items-center justify-between gap-4">
          {/* Tabs on left */}
          <div className="flex gap-1 sm:gap-3">
            <button
              onClick={() => scrollToSection(companySectionRef, 'company')}
              className={`px-2 py-1 sm:px-4 sm:py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${activeTab === 'company'
                ? 'text-gray-900 border-blue-500'
                : 'text-gray-700 hover:text-gray-900 border-transparent hover:border-blue-300'
                }`}
            >
              Company
            </button>
            {match.job?.job_url && (
              <button
                onClick={() => scrollToSection(applicationSectionRef, 'apply')}
                className={`px-2 py-1 sm:px-4 sm:py-2 text-sm font-medium transition-colors border-b-2 cursor-pointer ${activeTab === 'apply'
                  ? 'text-gray-900 border-blue-500'
                  : 'text-gray-700 hover:text-gray-900 border-transparent hover:border-blue-300'
                  }`}
              >
                Apply
              </button>
            )}
          </div>
          {/* Save and Contact Founder Buttons - Right aligned */}
          {match.startup.id && (
            <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                className={`flex items-center justify-center gap-1.5 rounded-md md:rounded-lg border px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition shadow-sm cursor-pointer ${isSaved
                    ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                onClick={handleSaveToggle}
                disabled={isSaving}
                aria-label={isSaved ? "Unsave match" : "Save match"}
              >
                <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSaved ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 rounded-md md:rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm cursor-pointer min-w-[120px] sm:min-w-[140px] animate-pulse-subtle"
                onClick={() => {
                  if (match.startup?.id) {
                    // Check if a founder is selected
                    if (selectedFounderIndex === null) {
                      const errorMsg = "Please select a founder first";
                      setFounderSelectionError(errorMsg);
                      onFounderError?.(errorMsg);

                      // Auto-scroll to founders section with offset for sticky header
                      const foundersSection = document.querySelector('[data-section="founders"]');
                      if (foundersSection) {
                        const headerOffset = 140; // Account for sticky header
                        const elementPosition = foundersSection.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                        window.scrollTo({
                          top: offsetPosition,
                          behavior: 'smooth'
                        });
                      }

                      return;
                    }

                    // Check if the selected founder has an email
                    if (!founderEmails[selectedFounderIndex]) {
                      const errorMsg = "Selected founder has no email";
                      setFounderSelectionError(errorMsg);
                      onFounderError?.(errorMsg);
                      return;
                    }

                    // Log selection details for debugging
                    console.log('[MatchCard] Contact Founder clicked:', {
                      selectedFounderIndex,
                      founderNames,
                      founderEmails,
                      selectedFounderName: founderNames[selectedFounderIndex],
                      selectedFounderEmail: founderEmails[selectedFounderIndex],
                      allFounderEmails: founderEmails,
                      startupId: match.startup.id,
                    });

                    // Clear any error and proceed
                    setFounderSelectionError(null);
                    onFounderError?.(null);
                    onFounderError?.(null);
                    const params = new URLSearchParams();
                    params.append('startupId', match.startup.id);
                    params.append('matchScore', match.score.toString());
                    params.append('founderEmail', founderEmails[selectedFounderIndex]);
                    params.append('returnIndex', currentIndex.toString());
                    console.log('[MatchCard] Navigating with params:', {
                      founderEmail: founderEmails[selectedFounderIndex],
                      fullParams: params.toString(),
                    });
                    // Store current index in sessionStorage as backup
                    sessionStorage.setItem('matchesCurrentIndex', currentIndex.toString());
                    router.push(`/generate-email?${params.toString()}`);
                  }
                }}
              >
                <Mail className="w-4 h-4" />
                <span>Contact Founder</span>
              </button>
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
                <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-gray-200 flex items-center justify-center">
                  <span className="text-gray-600 text-lg sm:text-2xl md:text-3xl lg:text-4xl font-semibold">
                    {match.startup.name.split(' ')[0].charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* Name, match score, description, and links - aligned with logo */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3 mb-1 sm:mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 break-words leading-tight">
                    {match.startup.name}
                  </h2>
                  {/* Fresh Jobs Badge - Next to company name */}
                  {hasFreshJobs && (
                    <div className="relative inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight">
                        Fresh
                      </span>
                    </div>
                  )}
                  {/* Stealth Opportunity Badge - Next to company name */}
                  {isStealthOpportunity && (
                    <div className="relative inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tight">
                        Stealth
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl sm:rounded-3xl px-2 py-1 sm:px-3 sm:py-2 shadow-sm w-fit sm:min-w-[120px] flex items-center justify-center flex-shrink-0">
                  <p className="text-xs sm:text-base md:text-lg font-bold text-blue-300 whitespace-nowrap">
                    {Math.min((match.score * 100) + 40, 97).toFixed(0)}%{" "}
                    <span className="text-[10px] sm:text-sm font-normal text-gray-600 align-top inline-block mt-1">
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
              {/* Keywords */}
              {match.startup.keywords && (
                <p className="text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2 break-words leading-relaxed">
                  {match.startup.keywords.split(',').map(keyword => keyword.trim()).join(' • ')}
                </p>
              )}
              {/* Website, YC, and Twitter buttons underneath description */}
              <div className="flex gap-1.5 sm:gap-2 flex-wrap items-center mt-1 sm:-mt-0.5">
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
                        className="ml-2 text-[10px] sm:text-xs text-blue-300 hover:underline align-baseline cursor-pointer"
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
                      <p className="text-[11px] sm:text-sm font-bold text-gray-900 mt-0.5 sm:mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
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
                      <p className="text-[11px] sm:text-sm font-bold text-gray-900 mt-0.5 sm:mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
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
                      <p className="text-[11px] sm:text-xs font-bold text-gray-900 mt-0.5 sm:mt-1 overflow-hidden text-ellipsis">
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
                      <p className="text-[11px] sm:text-sm font-bold text-gray-900 mt-0.5 sm:mt-1 overflow-hidden text-ellipsis">
                        {match.startup.location}
                      </p>
                    </div>
                  )}
                  {/* Funding Amount */}
                  {match.startup.funding_amount && (
                    <div className="text-left">
                      <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Funding
                      </p>
                      <p className="text-[11px] sm:text-sm font-bold text-gray-900 mt-0.5 sm:mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                        {match.startup.funding_amount}
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
        <div className="mt-4 sm:mt-6 md:mt-8" data-section="founders">
          <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4 flex-wrap gap-2">
            <h3 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 text-left">Active Founders</h3>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {founderSelectionError && (
                <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" />
              )}
              <p className={`text-xs sm:text-base ${founderSelectionError ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                {founderSelectionError || 'Select a founder'}
              </p>
            </div>
          </div>

          {/* Value Proposition Banner */}
          <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-gray-900 mb-1">
                  Reach out to founders directly
                </h4>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Generate a personalized email based on your background and this company's work. Skip the job board and start a conversation.
                </p>
              </div>
            </div>
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
                const newIndex = selectedFounderIndex === index ? null : index;
                console.log('[MatchCard] Founder selection changed:', {
                  clickedIndex: index,
                  previousIndex: selectedFounderIndex,
                  newIndex,
                  founderName: founderNames[index],
                  founderEmail: founderEmails[index],
                  allFounderNames: founderNames,
                  allFounderEmails: founderEmails,
                });
                setSelectedFounderIndex(newIndex);
                // Clear error when a founder is selected
                setFounderSelectionError(null);
                onFounderError?.(null);
              };

              const handleCardClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                handleFounderToggle(e);
              };

              return (
                <div
                  key={index}
                  className={`bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm border p-2.5 sm:p-4 md:p-5 cursor-pointer transition-all ${isSelected
                    ? 'border-blue-300 border-2 bg-blue-50'
                    : 'border-gray-100 hover:border-gray-200'
                    }`}
                  onClick={handleCardClick}
                >
                  <div className="flex flex-row items-start gap-2.5 sm:gap-3 md:gap-4">
                    {/* Founder Photo */}
                    <div className="flex-shrink-0 w-12 h-12 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-lg sm:rounded-xl md:rounded-2xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden relative">
                      {founderProfilePictures[index] && founderProfilePictures[index].trim() !== '' && !failedImages.has(index) ? (
                        <>
                          {/* Show initial letter first */}
                          {!loadedImages.has(index) && (
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center z-10">
                              <span className="text-gray-400 text-lg sm:text-2xl md:text-3xl font-semibold">
                                {initial.toUpperCase()}
                              </span>
                            </div>
                          )}
                          {/* Image that loads on top */}
                          <Image
                            src={`/api/image-proxy?url=${encodeURIComponent(founderProfilePictures[index])}`}
                            alt={`${founderName} profile picture`}
                            width={80}
                            height={80}
                            className={`w-full h-full object-cover transition-opacity duration-300 ${loadedImages.has(index) ? 'opacity-100' : 'opacity-0'}`}
                            unoptimized
                            loading="eager"
                            onLoad={() => {
                              setLoadedImages(prev => new Set(prev).add(index));
                            }}
                            onError={() => {
                              setFailedImages(prev => new Set(prev).add(index));
                              setLoadedImages(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(index);
                                return newSet;
                              });
                            }}
                          />
                        </>
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

      {/* Application Section - show all jobs ordered by role preference */}
      {((match.jobs && match.jobs.length > 0) || match.job?.job_url) && (
        <div ref={applicationSectionRef} className="mt-4 sm:mt-6 md:mt-8">
          <h3 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 text-left mb-2 sm:mb-3 md:mb-4">
            Application{((match.jobs && match.jobs.length > 1) || (match.jobs && match.jobs.length === 0 && match.job)) ? 's' : ''}
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {/* Use jobs array if available, otherwise fall back to single job for backward compatibility */}
            {match.jobs && match.jobs.length > 0 ? (
              match.jobs.map((job, index) => {
                const recency = formatJobRecency(job.created_at);
                return (
                  <div key={index} className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      {/* Left side: Job Title and Job Details */}
                      <div className="flex-1">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm sm:text-base md:text-lg font-bold text-gray-900">
                              {job.job_title || 'Job Title Not Available'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            {job.job_type && (
                              <>
                                <span className="capitalize">{job.job_type}</span>
                                {(job.salary_range || job.experience_level) && (
                                  <span className="text-gray-400">•</span>
                                )}
                              </>
                            )}
                            {job.salary_range && (
                              <>
                                <span>{job.salary_range}</span>
                                {job.experience_level && (
                                  <span className="text-gray-400">•</span>
                                )}
                              </>
                            )}
                            {job.experience_level && (
                              <span>{job.experience_level} preferred</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Recency and Application Link Button */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-2">
                        {recency && (
                          <span className="text-xs sm:text-sm text-gray-500 font-normal">
                            {recency}
                          </span>
                        )}
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-md md:rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm cursor-pointer min-w-[120px] sm:min-w-[140px]"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Apply Now</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : match.job?.job_url ? (
              // Fallback to single job for backward compatibility
              (() => {
                const recency = formatJobRecency(match.job.created_at);
                return (
                  <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      {/* Left side: Job Title and Job Details */}
                      <div className="flex-1">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm sm:text-base md:text-lg font-bold text-gray-900">
                              {match.job.job_title || 'Job Title Not Available'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            {match.job.job_type && (
                              <>
                                <span className="capitalize">{match.job.job_type}</span>
                                {(match.job.salary_range || match.job.experience_level) && (
                                  <span className="text-gray-400">•</span>
                                )}
                              </>
                            )}
                            {match.job.salary_range && (
                              <>
                                <span>{match.job.salary_range}</span>
                                {match.job.experience_level && (
                                  <span className="text-gray-400">•</span>
                                )}
                              </>
                            )}
                            {match.job.experience_level && (
                              <span>{match.job.experience_level} preferred</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Recency and Application Link Button */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-2">
                        {recency && (
                          <span className="text-xs sm:text-sm text-gray-500 font-normal">
                            {recency}
                          </span>
                        )}
                        <a
                          href={match.job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-md md:rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm cursor-pointer min-w-[120px] sm:min-w-[140px]"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Apply Now</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : null}
            
            {/* Also Consider dropdown */}
            {match.alsoConsider && match.alsoConsider.length > 0 && (
              <div className="mt-4 sm:mt-5">
                <button
                  onClick={() => setShowAlsoConsider(!showAlsoConsider)}
                  className="flex items-center justify-between w-full text-left text-sm sm:text-base font-semibold text-gray-700 hover:text-gray-900 transition mb-3 sm:mb-4"
                >
                  <span>Also Consider ({match.alsoConsider.length})</span>
                  <ChevronDown 
                    className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${showAlsoConsider ? 'rotate-180' : ''}`}
                  />
                </button>
                
                {showAlsoConsider && (
                  <div className="space-y-3 sm:space-y-4">
                    {match.alsoConsider.map((job, index) => {
                      const recency = formatJobRecency(job.created_at);
                      return (
                        <div key={index} className="bg-gray-50 rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 md:p-5 opacity-90">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            {/* Left side: Job Title and Job Details */}
                            <div className="flex-1">
                              <div>
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <p className="text-sm sm:text-base md:text-lg font-bold text-gray-900">
                                    {job.job_title || 'Job Title Not Available'}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                                  {job.job_type && (
                                    <>
                                      <span className="capitalize">{job.job_type}</span>
                                      {(job.salary_range || job.experience_level) && (
                                        <span className="text-gray-400">•</span>
                                      )}
                                    </>
                                  )}
                                  {job.salary_range && (
                                    <>
                                      <span>{job.salary_range}</span>
                                      {job.experience_level && (
                                        <span className="text-gray-400">•</span>
                                      )}
                                    </>
                                  )}
                                  {job.experience_level && (
                                    <span>{job.experience_level} preferred</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right side: Recency and Application Link Button */}
                            <div className="flex-shrink-0 flex flex-col items-center gap-2">
                              {recency && (
                                <span className="text-xs sm:text-sm text-gray-500 font-normal">
                                  {recency}
                                </span>
                              )}
                              <a
                                href={job.job_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 rounded-md md:rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium hover:from-blue-400 hover:to-indigo-400 transition shadow-sm cursor-pointer min-w-[120px] sm:min-w-[140px]"
                              >
                                <ExternalLink className="w-4 h-4" />
                                <span>Apply Now</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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

// Use a custom comparison function to ensure re-renders when match changes
export const MatchCard = memo(MatchCardComponent, (prevProps, nextProps) => {
  // Only prevent re-render if match ID is the same AND initialIsSaved hasn't changed
  return prevProps.match.id === nextProps.match.id &&
    prevProps.isPremium === nextProps.isPremium &&
    prevProps.userEmail === nextProps.userEmail &&
    prevProps.initialIsSaved === nextProps.initialIsSaved;
});

