"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { supabase, isSubscribed } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { UniversityCarousel } from "@/components/landing/StartupsCarousel";
import { StartupLogoDeck } from "@/components/landing/StartupLogoDeck";
import { NewHowItWorks } from "@/components/landing/NewHowItWorks";


import { Footer } from "@/components/layout/Footer";
import { SignInModal } from "@/components/modals/SignInModal";
import { SignUpModal } from "@/components/modals/SignUpModal";
import { ResumeUploadModal } from "@/components/modals/ResumeUploadModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { OnboardingModal } from "@/components/modals/OnboardingModal";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Mail, Bookmark, ExternalLink } from "lucide-react";

// Mock data extracted from the previous hardcoded values
// Mock data with correct structure matching MatchCard requirements
// Mock data with correct structure matching MatchCard requirements
const heroMatches = [
  {
    id: "hero-4",
    score: 0.92,
    matched_at: new Date().toISOString(),
    startup: {
      id: "s4",
      name: "Bluma",
      industry: "AI, Marketing",
      location: "San Francisco",
      website: "getbluma.com",
      team_size: "1-10",
      description: "AI short form content engine. Bluma automates your entire consumer marketing strategy with content templates that turn scripts into finished videos.",
      yc_description: "The AI short form content engine",
      batch: "F25",
      keywords: "AI, Video, Marketing",
      company_logo: "https://bookface-images.s3.amazonaws.com/small_logos/2fb4b30a87ff49eecaaa2a8e93e689ddecfde446.png",
      founders: [
        {
          id: "f4",
          name: "Alisa Wu",
          role: "Founder",
          profile_picture: "https://bookface-images.s3.amazonaws.com/avatars/2d7fc8cfec0d423a6a3d0daf9e6d01f9d938f23f.jpg",
          background: "Co-founder of Bluma. Prev UWaterloo Engineering & self-driving SWE at Zoox (Amazon).",
          email: "alisa@getbluma.com"
        }
      ],
      founder_names: "Alisa Wu",
      founder_emails: "alisa@getbluma.com"
    }
  },
  {
    id: "hero-1",
    score: 0.98,
    matched_at: new Date().toISOString(),
    startup: {
      id: "s1",
      name: "Keystone",
      industry: "AI, Developer Tools",
      location: "San Francisco",
      website: "keystone.ai",
      team_size: "1-10",
      description: "Keystone is your team's on-call AI engineer. We build autonomous agents that can navigate complex codebases.",
      yc_description: "Your team's on-call AI engineer",
      batch: "S25",
      keywords: "AI, DevTools, Agents",
      company_logo: "https://bookface-images.s3.amazonaws.com/logos/8c3915c83dfe6a246f33ae908d5156017a0cef3f.png",
      founders: [
        {
          id: "f1",
          name: "Pablo Hansen",
          role: "Founder",
          profile_picture: "https://npqjuljzpjvcqmrgpyqj.supabase.co/storage/v1/object/public/founder-pfps/keystone/keystone_pablo_hansen_bfce0db57159.jpg",
          background: "I finished my master's degree in AI at 19 and was then hire #1 at Onyx (YC W24).",
          email: "pablo@keystone.ai"
        }
      ],
      founder_names: "Pablo Hansen",
      founder_emails: "pablo@keystone.ai"
    }
  },
  {
    id: "hero-2",
    score: 0.94,
    matched_at: new Date().toISOString(),
    startup: {
      id: "s2",
      name: "Novaflow",
      industry: "AI, Healthcare",
      location: "New York",
      website: "novaflow.bio",
      team_size: "1-10",
      description: "The AI data analyst for biology labs. Novaflow automates the analysis of flow cytometry data.",
      yc_description: "The AI data analyst for biology labs",
      batch: "S25",
      keywords: "Biotech, AI, Automation",
      company_logo: "https://bookface-images.s3.amazonaws.com/logos/284bcf8fd014c43e486fa3243ceddc4a1b5a8484.png",
      founders: [
        {
          id: "f2",
          name: "Aman Agarwal",
          role: "Founder",
          profile_picture: "https://bookface-images.s3.amazonaws.com/avatars/ebc822f5be4ff922ad9648042b386fef18b0d86e.jpg",
          background: "Former computational biologist published in Nature and Cell.",
          email: "aman@novaflow.bio"
        }
      ],
      founder_names: "Aman Agarwal",
      founder_emails: "aman@novaflow.bio"
    }
  },
  {
    id: "hero-3",
    score: 0.89,
    matched_at: new Date().toISOString(),
    startup: {
      id: "s3",
      name: "Stagewise",
      industry: "AI, Developer Tools",
      location: "Remote",
      website: "stagewise.ai",
      team_size: "1-10",
      description: "AI-powered coding agent for frontend development. Stagewise understands your design system.",
      yc_description: "AI-powered coding agent for frontend development",
      batch: "S25",
      keywords: "Frontend, AI, React",
      company_logo: "https://bookface-images.s3.amazonaws.com/logos/77a0945ae8c271b92f411a28c4d7ed11be60ad29.png",
      founders: [
        {
          id: "f3",
          name: "Julian Goetze",
          role: "Founder",
          profile_picture: "https://bookface-images.s3.amazonaws.com/avatars/fd3b58ea13772f4d79e6a13b93a7f9bbb2164406.jpg",
          background: "Former engineering leader focused on developer experience and AI-native tooling.",
          email: "julian@stagewise.io"
        }
      ],
      founder_names: "Julian Goetze",
      founder_emails: "julian@stagewise.io"
    }
  },
];

// Helper Component: HeroMatchCard (A visual replica of MatchCard.tsx using the data structure)
function HeroMatchCard({ match }: { match: typeof heroMatches[0] }) {
  const { startup, score } = match;
  if (!startup) return null;

  const founder = startup.founders?.[0];
  const tags = startup.keywords ? startup.keywords.split(',').map(t => t.trim()) : [];

  // Deterministic color based on name for logo placeholder
  const colors = [
    "from-indigo-500 to-purple-600",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-orange-500 to-red-500",
    "from-pink-500 to-rose-500"
  ];
  const colorIndex = startup.name.length % colors.length;
  const logoGradient = colors[colorIndex];

  return (
    <div className="relative rounded-2xl md:rounded-3xl bg-white px-4 pt-4 pb-4 sm:px-6 sm:pb-6 shadow-xl border border-gray-100 w-full overflow-hidden">
      {/* Sticky Header Container */}
      <div className="bg-white -mx-4 sm:-mx-6 px-4 pt-1 sm:px-6 mb-3 border-b border-gray-100 pb-3">
        {/* Top Header with Tabs and Contact Founder Button */}
        <div className="flex items-center justify-between gap-3">
          {/* Tabs on left */}
          <div className="flex gap-4">
            <button className="px-1 py-1 text-sm font-semibold text-gray-900 border-b-2 border-blue-600">
              Company
            </button>
            <button className="px-1 py-1 text-sm font-medium text-gray-500 hover:text-gray-900 border-b-2 border-transparent hover:border-blue-300 transition-colors">
              Apply
            </button>
          </div>
          {/* Save and Contact Founder Buttons - Right aligned */}
          <div className="flex items-center gap-2">
            <button className="hidden sm:flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Bookmark className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 text-xs sm:text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 transition-colors shadow-sm">
              <Mail className="w-3.5 h-3.5" />
              <span>Contact Founder</span>
            </button>
          </div>
        </div>
      </div>

      {/* Company Section */}
      <div className="flex flex-row items-start gap-4">
        {/* Logo */}
        <div className="flex-shrink-0">
          {startup.company_logo ? (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-gray-100 p-1 overflow-hidden">
              <Image
                src={startup.company_logo}
                alt={`${startup.name} logo`}
                width={64}
                height={64}
                className="w-full h-full object-contain"
                unoptimized
                loading="eager"
              />
            </div>
          ) : (
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${logoGradient} flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-sm`}>
              {startup.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Name, match score, description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate pr-2">
              {startup.name}
            </h2>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 shadow-sm flex-shrink-0">
              <p className="text-sm font-bold text-blue-600">
                {Math.round(score * 100)}% <span className="text-xs font-normal text-gray-500">match</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <span className="font-medium">{startup.location}</span>
            <span className="text-gray-300">•</span>
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide">{startup.batch || 'SERIES A'}</span>
          </div>

          <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
            {startup.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-50 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-md font-medium">
                {tag}
              </span>
            ))}
          </div>

          {/* Founder Snippet */}
          {founder && (
            <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 ring-2 ring-white shadow-sm">
                <Image
                  src={founder.profile_picture}
                  alt={founder.name}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                <span className="font-semibold text-gray-900">Intro from {founder.name}</span> <span className="text-gray-400">({founder.role})</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isOnboardingRoute = pathname === '/onboarding';
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isCheckingPremium, setIsCheckingPremium] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const fetchingRef = useRef(false);
  const lastFetchedEmailRef = useRef<string | null>(null);
  const checkingOnboardingRef = useRef(false);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 200], [1, 0.8]);
  const headerScale = useTransform(scrollY, [0, 200], [1, 0.95]);
  const headerWidth = useTransform(scrollY, [0, 200], ["100%", "90%"]);

  // Memoize user email to prevent unnecessary re-fetches
  const userEmail = useMemo(() => user?.email, [user?.email]);

  // Track auth state across renders to detect genuine sign-ins
  const previousUserRef = useRef<User | null>(null);
  const initialLoadCompleteRef = useRef(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      previousUserRef.current = currentUser;
      setUser(currentUser);
      initialLoadCompleteRef.current = true;
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      const prevUser = previousUserRef.current;

      // Determine if this is a new sign-in (from null to user)
      const isNewSignIn = initialLoadCompleteRef.current && prevUser === null && currentUser !== null;

      setUser(currentUser);
      previousUserRef.current = currentUser;

      if (!isNewSignIn || typeof window === 'undefined') return;

      // Only handle automatic redirects/onboarding checks for genuine new sign-ins
      const postAuthRedirect = window.sessionStorage.getItem('postAuthRedirect');
      if (postAuthRedirect) {
        window.sessionStorage.removeItem('postAuthRedirect');
        // Use router.push for client-side navigation (prevents full page reload/Edge Request)
        router.push(postAuthRedirect);
        return;
      }

      // If we're already on the onboarding route, the isOnboardingRoute useEffect will handle it
      if (isOnboardingRoute) return;

      // For non-onboarding routes, check if they need onboarding
      try {
        const response = await fetch('/api/candidate/check-onboarding', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.needsOnboarding) {
            setShowOnboarding(true);
          } else {
            router.push('/matches');
          }
        }
      } catch (e) {
        console.error('Error in onAuthStateChange onboarding check:', e);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, isOnboardingRoute]);

  // Fetch candidate info to check premium status and assessment status - only when email changes
  useEffect(() => {
    const fetchCandidateInfo = async () => {
      if (!userEmail) {
        setIsPremium(false);
        lastFetchedEmailRef.current = null;
        return;
      }

      // Prevent duplicate requests - check if we're already fetching or if we just fetched this email
      if (fetchingRef.current || lastFetchedEmailRef.current === userEmail) {
        return;
      }

      fetchingRef.current = true;
      setIsCheckingPremium(true);
      try {
        const response = await fetch('/api/candidate-info', {
          credentials: 'include',
        });
        if (response.ok) {
          const candidateInfo = await response.json();
          setIsPremium(isSubscribed(candidateInfo));
          lastFetchedEmailRef.current = userEmail;

          // Assessment is now integrated into onboarding flow, no need to check separately
        } else {
          setIsPremium(false);
        }
      } catch (error) {
        console.error('Error fetching candidate info:', error);
        setIsPremium(false);
      } finally {
        setIsCheckingPremium(false);
        fetchingRef.current = false;
      }
    };

    fetchCandidateInfo();
  }, [userEmail, isOnboardingRoute, showOnboarding]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle GitHub OAuth redirect - check for github_connected param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const githubConnected = urlParams.get('github_connected');
      const githubError = urlParams.get('github_error');

      if (githubConnected === 'true') {
        // Check if user has already completed onboarding
        const checkOnboardingAndRedirect = async () => {
          try {
            const response = await fetch('/api/candidate/check-onboarding', {
              credentials: 'include',
            });
            if (response.ok) {
              const data = await response.json();
              if (data.needsOnboarding) {
                // User needs onboarding - show the modal
                setShowOnboarding(true);
              } else {
                // User already completed onboarding - redirect to matches
                // Clean up URL params first
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, '', cleanUrl);
                // Redirect to matches
                router.push('/matches');
              }
            } else {
              // If check fails, show onboarding to be safe
              setShowOnboarding(true);
            }
          } catch (error) {
            console.error('Error checking onboarding status:', error);
            // If check fails, show onboarding to be safe
            setShowOnboarding(true);
          }
        };
        checkOnboardingAndRedirect();
      } else if (githubError) {
        // Still open modal to show error state
        setShowOnboarding(true);
      }
    }
  }, [router]);

  // Specialized effect for the /onboarding route
  useEffect(() => {
    if (isAuthLoading || !isOnboardingRoute) return;

    if (!user) {
      setShowSignUp(true);
      return;
    }

    // Check if this is a GitHub connection flow
    const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const isGitHubConnection = urlParams.get('github_connected') === 'true';

    // If GitHub just connected, let the OnboardingModal handle it based on its own Step state
    // We only trigger the automatic modal show if we're freshly landing on /onboarding
    if (!isGitHubConnection && !showOnboarding && !checkingOnboardingRef.current) {
      const runCheck = async () => {
        checkingOnboardingRef.current = true;
        try {
          const response = await fetch('/api/candidate/check-onboarding', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            if (data.needsOnboarding) {
              setShowOnboarding(true);
            } else {
              // If they're on /onboarding but already finished, send to matches
              router.push('/matches');
            }
          } else {
            setShowOnboarding(true);
          }
        } catch (error) {
          console.error('Onboarding route check failed:', error);
          setShowOnboarding(true);
        } finally {
          checkingOnboardingRef.current = false;
        }
      };
      runCheck();
    }
  }, [isOnboardingRoute, user, router, isAuthLoading, showOnboarding]);

  const handleGetStarted = async () => {
    // If not authenticated, prompt sign-up and mark that we want to go into onboarding after auth
    if (!user) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('pendingOnboarding', 'true');
      }
      setShowSignUp(true);
      return;
    }

    // Check if user has completed onboarding
    try {
      const response = await fetch('/api/candidate/check-onboarding', {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.needsOnboarding) {
        // User needs to complete onboarding first
        setShowOnboarding(true);
        return;
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }

    // Already authenticated and onboarded – redirect to matches page
    router.push('/matches');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Handle Premium button click - memoized callback
  const handlePremiumClick = useCallback(async () => {
    // Open modal immediately for better UX
    setShowPremiumModal(true);

    // Sync subscription status in background (non-blocking)
    if (userEmail && !isCheckingPremium) {
      setIsCheckingPremium(true);
      try {
        const syncResponse = await fetch('/api/stripe/sync-subscription', {
          method: 'POST',
          credentials: 'include',
        });

        if (syncResponse.ok) {
          // Refresh premium status after sync
          const response = await fetch('/api/candidate-info', {
            credentials: 'include',
            cache: 'no-store',
          });
          if (response.ok) {
            const candidateInfo = await response.json();
            setIsPremium(isSubscribed(candidateInfo));
          }
        }
      } catch (error) {
        console.error('Error syncing subscription:', error);
      } finally {
        setIsCheckingPremium(false);
      }
    }
  }, [userEmail, isCheckingPremium]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      {/* Header */}
      <motion.header
        className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          className="pointer-events-auto w-full max-w-3xl bg-[#121212]/70 backdrop-blur-2xl border border-white/10 rounded-full px-5 py-3 flex items-center justify-between shadow-2xl transition-all duration-300 relative overflow-hidden"
          layout
          style={{
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
            opacity: headerOpacity,
            scale: headerScale,
            width: headerWidth
          }}
        >
          {/* Shimmer/Reflection Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none skew-x-12" />

          {/* Logo - Left side */}
          <Link href="/" className="flex items-center gap-3 pl-2 transition-opacity hover:opacity-80 relative z-10">
            <Image src="/images/hermes.png" alt="Agencity" width={28} height={28} className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="text-lg font-bold text-white tracking-tight italic" style={{ fontFamily: 'var(--font-ivy), serif' }}>Agencity</span>
          </Link>

          {/* Navigation - Desktop only, Centered */}
          <nav className="hidden md:flex items-center gap-8 relative z-10">
            {user ? (
              <>
                <Link
                  href="/matches"
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  Your Matches
                </Link>
                <Link
                  href="/tracker"
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  Email Tracker
                </Link>
                <Link
                  href="/resumes"
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  Resumes
                </Link>
              </>
            ) : null}
          </nav>

          {/* Right side - always visible */}
          <div className="flex items-center gap-3 pr-1 relative z-10">
            {!user ? (
              <>
                {/* Desktop secondary links - hidden on mobile */}
                <div className="hidden sm:flex items-center gap-6 mr-2">
                  <Link
                    href="#how-it-works"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                  >
                    How it Works
                  </Link>

                </div>
                <Button
                  onClick={handleGetStarted}
                  className="rounded-full px-5 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-black bg-white hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
                >
                  Apply
                </Button>

                {/* Mobile Menu Toggle for logged out */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 text-white hover:bg-white/10 rounded-full transition-colors relative z-10"
                  aria-label="Toggle menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </>
            ) : (
              <>
                <div className="hidden md:flex items-center gap-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="rounded-full h-9 px-4 text-white hover:bg-white/10 hover:text-white transition-colors ring-0 focus-visible:ring-0"
                      >
                        <span className="truncate max-w-[150px]">{user.email}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 mt-2">
                      {isPremium && (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onSelect={async () => {
                            try {
                              const response = await fetch('/api/stripe/create-portal-session', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ email: user.email ?? '' }),
                              });

                              const data = await response.json();

                              if (!response.ok) {
                                throw new Error(data.error || 'Failed to create portal session');
                              }

                              if (data.url) {
                                window.location.href = data.url;
                              }
                            } catch (error: any) {
                              console.error('Error opening portal:', error);
                              toast({
                                title: "Error",
                                description: error.message || 'Failed to open subscription management',
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Manage Subscription
                        </DropdownMenuItem>
                      )}
                      {isPremium && <DropdownMenuSeparator />}
                      <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                  aria-label="Toggle menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto absolute top-[80px] w-[90%] max-w-md bg-[#000000]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl p-4 md:hidden z-50 overflow-hidden"
              style={{
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)"
              }}
            >
              {/* Decorative gradient inside menu */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-1 relative z-10">
                {user ? (
                  <>
                    <Link
                      href="/matches"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
                    >
                      Your Matches
                    </Link>
                    <Link
                      href="/tracker"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
                    >
                      Email Tracker
                    </Link>
                    <Link
                      href="/resumes"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
                    >
                      Resumes
                    </Link>
                    <div className="border-t border-white/10 my-3"></div>
                    <div className="px-4 py-2 text-xs text-white/40 uppercase tracking-widest font-semibold flex items-center justify-between">
                      <span className="truncate">{user.email}</span>
                      {isPremium && <span className="bg-white/10 px-2 py-0.5 rounded-full text-[10px] text-white/80">PREMIUM</span>}
                    </div>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-base font-medium text-red-400 hover:bg-red-400/10 hover:text-red-300 rounded-xl transition-colors"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="#how-it-works"
                      onClick={(e) => {
                        e.preventDefault();
                        setMobileMenuOpen(false);
                        document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
                    >
                      How it Works
                    </Link>

                    <div className="border-t border-white/10 my-3"></div>
                    <button
                      onClick={() => {
                        handleGetStarted();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-4 mt-2 text-base font-bold text-black bg-white hover:bg-gray-100 rounded-xl transition-all shadow-lg active:scale-[0.98]"
                    >
                      Get Started
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Main Content */}
      <main>
        {/* First Half with Sky Background */}
        <div className="relative min-h-screen pt-16 overflow-hidden bg-white">
          {/* Sky Background Image with Bottom Fade */}
          <div className="absolute top-0 left-0 right-0 h-[120vh] z-0 select-none pointer-events-none">
            <Image
              src="/images/hermes2bg.png"
              alt="Sky Background"
              fill
              className="object-cover object-top scale-110 opacity-60"
              priority
              style={{
                maskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 100%)'
              }}
            />
          </div>

          {/* Gradient Overlay for smooth blend (from CompanyLandingPage) */}
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-white via-white/60 to-transparent z-0 pointer-events-none" />

          {/* Content with relative positioning */}
          <div className="relative z-10">
            {/* Hero Section Inline */}
            <div className="mx-auto max-w-6xl px-4 pt-12 md:pt-24 pb-12 md:pb-24">
              <div className="grid items-center gap-12 md:grid-cols-2">
                <div>
                  <h1 className="text-5xl md:text-7xl font-semibold leading-tight tracking-tight text-zinc-900" style={{ fontFamily: 'var(--font-ivy), serif' }}>
                    Land jobs at top startups.
                  </h1>

                  <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">
                    Get direct intros to founders. Skip the first round interview.
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={handleGetStarted}
                      className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/10 cursor-pointer"
                    >
                      Apply Now
                    </button>
                    <button
                      onClick={() => router.push('/')}
                      className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white/50 backdrop-blur-sm px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white hover:border-zinc-300 transition-colors cursor-pointer"
                    >
                      I take hiring decisions
                    </button>
                  </div>

                  <div className="mt-8 flex items-center gap-4 text-sm text-zinc-500">
                    <div className="flex -space-x-2">
                      <div className="h-8 w-8 rounded-full border border-white overflow-hidden bg-zinc-100">
                        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=64&h=64&auto=format&fit=crop" alt="User 1" className="w-full h-full object-cover" />
                      </div>
                      <div className="h-8 w-8 rounded-full border border-white overflow-hidden bg-zinc-100">
                        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=64&h=64&auto=format&fit=crop" alt="User 2" className="w-full h-full object-cover" />
                      </div>
                      <div className="h-8 w-8 rounded-full border border-white overflow-hidden bg-zinc-100">
                        <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=64&h=64&auto=format&fit=crop" alt="User 3" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <p>
                      <span className="text-zinc-900 font-medium">2,000+</span> intros made this month
                    </p>
                  </div>
                </div>

                {/* Candidate Dashboard Preview - Replaced with Layered Hero Match Cards */}
                <div className="relative h-[450px] md:h-[650px] flex items-center justify-center md:items-center md:justify-center md:ml-12 perspective-1000">
                  <div className="relative w-full max-w-[600px] h-[500px]">
                    {/* Background Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

                    {/* Layered Cards */}
                    {heroMatches.map((match, index) => {
                      // Layering logic: reverse order for visual stacking (first item on bottom)
                      const isTop = index === 0;
                      // Increased overlap tightness
                      const offsetTop = index * 12;
                      const scale = 1 - (index * 0.05);
                      // Tighter opacity drop
                      const opacity = 1 - (index * 0.15);
                      const zIndex = 30 - index;
                      // Additional translation for the "stack" effect
                      const translateY = index * 8;

                      return (
                        <div
                          key={index}
                          className={`absolute top-0 left-0 w-full transition-all duration-500 ease-out transform ${isTop ? 'cursor-pointer hover:-translate-y-1' : ''}`}
                          style={{
                            top: `${offsetTop}px`,
                            transform: `scale(${scale}) translateY(${translateY}px)`,
                            opacity: opacity,
                            zIndex: zIndex,
                          }}
                        >
                          <HeroMatchCard match={match} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <UniversityCarousel />
          </div>
        </div>

        {/* Second Half with White Background */}
        <div className="bg-white">
          <div id="how-it-works" className="scroll-mt-32">
            <NewHowItWorks />
          </div>
          <div id="integrations" className="scroll-mt-32">
            <StartupLogoDeck />
          </div>




          {/* CTA Section */}
          <section className="py-24 px-4 text-center bg-white border-t border-zinc-100">
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-4xl md:text-5xl font-semibold text-zinc-900 tracking-tight" style={{ fontFamily: 'var(--font-ivy), serif' }}>
                Stop applying. Start getting offers.
              </h2>
              <p className="text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed">
                Skip the resume black hole. Prove your skills once and get introduced to top founders who are actively hiring.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleGetStarted}
                  className="rounded-full bg-zinc-900 px-8 py-4 text-base font-semibold text-white hover:bg-zinc-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Apply Now
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      {/* Footer (Mirrored from CompanyLandingPage) */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Agencity</p>
              <p className="mt-1 text-sm text-zinc-500">Land jobs at top startups. Express your true potential.</p>
            </div>
            <div className="flex gap-5 text-sm text-zinc-500">
              <Link href="#how-it-works" onClick={(e) => {
                e.preventDefault();
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }} className="hover:text-zinc-900 transition-colors">How it works</Link>
              <Link href="/privacy" className="hover:text-zinc-900 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-zinc-900 transition-colors">Terms</Link>
            </div>
          </div>
          <p className="mt-8 text-xs text-zinc-400">© {new Date().getFullYear()} Agencity. All rights reserved.</p>
        </div>
      </footer>

      {/* Modals */}
      <OnboardingModal
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          // Use router.push for client-side navigation (prevents full page reload/Edge Request)
          router.push('/matches');
        }}
        skipResumeUpload={false}
      />
      <SignInModal
        open={showSignIn}
        onOpenChange={setShowSignIn}
        redirectTo={isOnboardingRoute ? '/onboarding' : undefined}
      />
      <SignUpModal
        open={showSignUp}
        onOpenChange={setShowSignUp}
        redirectTo={isOnboardingRoute ? '/onboarding' : undefined}
        onSwitchToSignIn={() => {
          setShowSignUp(false);
          setShowSignIn(true);
        }}
      />
      <ResumeUploadModal
        open={showResumeUpload}
        onOpenChange={setShowResumeUpload}
      />
      <UpgradeModal
        open={showPremiumModal}
        onOpenChange={setShowPremiumModal}
        hiddenMatchCount={0}
        email={user?.email || ''}
        onDismiss={() => setShowPremiumModal(false)}
        customTitle="Our Premium Plan"
        isPremium={isPremium}
      />
    </div>
  );
}
