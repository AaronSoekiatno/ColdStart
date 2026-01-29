"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { supabase, isSubscribed } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { NewHero } from "@/components/landing/NewHero";
import { TrustBadge } from "@/components/shared/TrustBadge";
import { UniversityCarousel } from "@/components/landing/StartupsCarousel";
import { StartupLogoDeck } from "@/components/landing/StartupLogoDeck";
import { DemoMatchCard } from "@/components/features/matches/DemoMatchCard";
import { AIAgentSection } from "@/components/landing/AIAgentSection";
import { NewHowItWorks } from "@/components/landing/NewHowItWorks";

import { FAQSection } from "@/components/landing/FAQSection";
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
import { motion, useScroll, useTransform } from "framer-motion";

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
  const fetchingRef = useRef(false);
  const lastFetchedEmailRef = useRef<string | null>(null);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 200], [1, 0.8]);
  const headerScale = useTransform(scrollY, [0, 200], [1, 0.95]);
  const headerWidth = useTransform(scrollY, [0, 200], ["100%", "90%"]);

  // Memoize user email to prevent unnecessary re-fetches
  const userEmail = useMemo(() => user?.email, [user?.email]);

  useEffect(() => {
    // Helper to check if user needs onboarding and open appropriate modal
    const checkOnboardingStatus = async (session: { user: User | null } | null, isNewSignIn: boolean = false) => {
      if (!session?.user) return;
      if (typeof window === "undefined") return;

      // Check if this is a GitHub connection flow - if so, don't interfere
      const urlParams = new URLSearchParams(window.location.search);
      const isGitHubConnection = urlParams.get('github_connected') === 'true';

      if (isGitHubConnection) {
        // Let the GitHub redirect handler (separate useEffect) handle this
        return;
      }

      // On onboarding route, always show onboarding modal (don't check status)
      if (isOnboardingRoute) {
        setShowSignIn(false);
        setShowOnboarding(true);
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
          setShowSignIn(false);
          setShowOnboarding(true);
          return;
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      }

      // If user just signed in and onboarding is complete, redirect to matches
      // (but not if on onboarding route)
      if (isNewSignIn && !isOnboardingRoute) {
        setShowSignIn(false);
        window.location.href = "/matches";
      }
    };

    let previousUser: User | null = null;
    let initialLoadComplete = false;

    // Check initial session (handles returning from OAuth redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      previousUser = session?.user ?? null;
      setUser(previousUser);
      initialLoadComplete = true;
    });

    // Listen for auth changes (handles in-app email/password sign-in)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;

      // Only treat as new sign-in if initial load is complete and user changed from null to non-null
      const isNewSignIn = initialLoadComplete && !previousUser && currentUser !== null;

      setUser(currentUser);

      // Check for post-auth redirect (for email sign-in)
      if (isNewSignIn && typeof window !== 'undefined') {
        const postAuthRedirect = window.sessionStorage.getItem('postAuthRedirect');
        if (postAuthRedirect) {
          window.sessionStorage.removeItem('postAuthRedirect');
          // Actually perform the redirect using window.location for reliability
          setTimeout(() => {
            window.location.href = postAuthRedirect;
          }, 100);
          return; // Exit early to prevent other redirects
        }
      }

      checkOnboardingStatus(session, isNewSignIn);

      previousUser = currentUser;
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
        // Open onboarding modal when GitHub connection is successful
        setShowOnboarding(true);
        // The OnboardingModal will handle the step navigation internally
      } else if (githubError) {
        // Still open modal to show error state
        setShowOnboarding(true);
      }
    }
  }, []);

  // Force show onboarding modal on onboarding route for authenticated users
  useEffect(() => {
    if (isOnboardingRoute && user) {
      // Check if this is a GitHub connection flow - if so, don't interfere
      const urlParams = new URLSearchParams(window.location.search);
      const isGitHubConnection = urlParams.get('github_connected') === 'true';

      if (!isGitHubConnection) {
        // Force show onboarding modal on onboarding route
        setShowOnboarding(true);
      }
    }
  }, [isOnboardingRoute, user]);

  const handleGetStarted = () => {
    // If not authenticated, prompt sign-up (onboarding will happen after sign-up)
    if (!user) {
      setShowSignUp(true);
      return;
    }

    // Already authenticated – redirect to matches page
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
            <Image src="/images/hermes.png" alt="Hermes" width={28} height={28} className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="text-lg font-bold text-white tracking-tight">Hermes</span>
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
                <Link
                  href="#how-it-works"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors mr-4"
                >
                  How it Works
                </Link>
                <Link
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors mr-4"
                >
                  FAQ
                </Link>
                <Button
                  onClick={handleGetStarted}
                  className="rounded-full px-6 py-2 text-sm font-semibold text-black bg-white hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
                >
                  Apply
                </Button>
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

        {/* Mobile Menu Dropdown */}
        {user && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto absolute top-[80px] w-[90%] max-w-md bg-[#121212]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 md:hidden"
          >
            <div className="space-y-1">
              <Link
                href="/matches"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
              >
                Your Matches
              </Link>
              <Link
                href="/tracker"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
              >
                Email Tracker
              </Link>
              <Link
                href="/resumes"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
              >
                Resumes
              </Link>

              <div className="border-t border-white/10 my-2"></div>
              <div className="px-4 py-2 text-xs text-white/50 truncate">{user.email}</div>
              <button
                onClick={() => {
                  handleSignOut();
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-400/10 hover:text-red-300 rounded-xl transition-colors"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
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
              className="object-cover object-top scale-110"
              priority
              style={{
                maskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 50%, transparent 100%)'
              }}
            />
          </div>

          {/* Content with relative positioning */}
          <div className="relative z-10">
            <NewHero onGetStarted={handleGetStarted} />
            <TrustBadge />
            <UniversityCarousel />
            <div id="features" className="scroll-mt-32">
              <AIAgentSection />
            </div>
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

          <div id="faq" className="scroll-mt-32">
            <FAQSection />
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      <OnboardingModal
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          // Redirect to matches if the modal itself doesn't handle it
          // (Though for enhanced flow the modal usually redirects)
          window.location.href = '/matches';
        }}
        skipResumeUpload={false}
      />
      <SignInModal
        open={showSignIn}
        onOpenChange={setShowSignIn}
      />
      <SignUpModal
        open={showSignUp}
        onOpenChange={setShowSignUp}
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
