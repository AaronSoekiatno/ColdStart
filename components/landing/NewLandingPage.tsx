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
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

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
        setTimeout(() => {
          window.location.href = postAuthRedirect;
        }, 100);
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
                  <Link
                    href="#faq"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                  >
                    FAQ
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
                    <Link
                      href="#faq"
                      onClick={(e) => {
                        e.preventDefault();
                        setMobileMenuOpen(false);
                        document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
                    >
                      FAQ
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
