"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isSubscribed } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { NewHero } from "@/components/landing/NewHero";
import { TrustBadge } from "@/components/shared/TrustBadge";
import { UniversityCarousel } from "@/components/landing/StartupsCarousel";
import { AIAgentSection } from "@/components/landing/AIAgentSection";
import { StartupLogoDeck } from "@/components/landing/StartupLogoDeck";
import { DemoMatchCard } from "@/components/features/matches/DemoMatchCard";
import { NewHowItWorks } from "@/components/landing/NewHowItWorks";
import { PricingSection } from "@/components/landing/PricingSection";
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

export function NewLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Memoize user email to prevent unnecessary re-fetches
  const userEmail = useMemo(() => user?.email, [user?.email]);

  useEffect(() => {
    // Helper to check if user needs onboarding and open appropriate modal
    const checkOnboardingStatus = async (session: { user: User | null } | null, isNewSignIn: boolean = false) => {
      if (!session?.user) return;
      if (typeof window === "undefined") return;

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
      if (isNewSignIn) {
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

  // Fetch candidate info to check premium status - only when email changes
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
  }, [userEmail]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent transition-all duration-300">
        <div className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          {/* Logo - Left side */}
          <Link href="/" className={`flex items-center gap-2 sm:gap-3 transition-opacity duration-300 ${isScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
            <Image src="/images/hermes.png" alt="Hermes" width={28} height={28} className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="text-lg sm:text-xl font-semibold text-white drop-shadow-md">Hermes</span>
          </Link>

          {/* Navigation - Desktop only, Centered, Hidden when scrolled */}
          <nav className={`hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-4 transition-opacity duration-300 ${isScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}>
            {user ? (
              <>
                <Link
                  href="/matches"
                  className="text-sm text-white hover:text-white/80 transition-colors drop-shadow-md"
                >
                  Your Matches
                </Link>
                <Link
                  href="/tracker"
                  className="text-sm text-white hover:text-white/80 transition-colors drop-shadow-md"
                >
                  Email Tracker
                </Link>
                <Link
                  href="/resumes"
                  className="text-sm text-white hover:text-white/80 transition-colors drop-shadow-md"
                >
                  Resumes
                </Link>
                <button
                  onClick={handlePremiumClick}
                  className="text-sm text-white hover:text-white/80 transition-colors drop-shadow-md cursor-pointer"
                >
                  Premium
                </button>
              </>
            ) : null}
          </nav>

          {/* Right side - Always on the right */}
          <div className="flex items-center gap-2 sm:gap-3">
            {!user ? (
              <>
                {/* Sign In Button - Hidden when scrolled on mobile */}
                <Button
                  onClick={() => setShowSignIn(true)}
                  className={`rounded-full px-4 sm:px-6 py-2 text-sm sm:text-base text-white font-medium drop-shadow-md bg-white/10 hover:bg-white/20 border border-white/30 transition-all duration-300 ${isScrolled ? 'hidden sm:flex' : 'flex'
                    }`}
                >
                  Sign In
                </Button>
              </>
            ) : (
              <>
                {/* Desktop: Email Dropdown - Hidden when scrolled */}
                <div className={`hidden md:block transition-opacity duration-300 ${isScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="rounded-full h-9 px-4 text-white drop-shadow-md text-sm max-w-[200px] truncate"
                      >
                        {user.email}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={handlePremiumClick}
                      >
                        Premium Plan
                      </DropdownMenuItem>
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

                              // Redirect to Stripe Customer Portal
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
                      <DropdownMenuItem onClick={handleSignOut}>
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* View Matches Button - Only visible when scrolled */}
                <Button
                  onClick={handleGetStarted}
                  className={`rounded-full px-4 sm:px-6 py-2 text-sm sm:text-base text-white font-medium drop-shadow-md transition-all duration-300 transform ${isScrolled ? 'opacity-100 pointer-events-auto bg-[#498EDC] hover:bg-[#3a7bc4] hover:scale-105 hover:shadow-lg' : 'opacity-0 pointer-events-none hidden'
                    }`}
                >
                  View Matches
                </Button>
              </>
            )}

            {/* Mobile: Hamburger Menu Button - Always on the right for logged in users */}
            {user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`md:hidden p-2 text-white transition-opacity duration-300 ${isScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
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
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {user && mobileMenuOpen && !isScrolled && (
          <div className="md:hidden bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg">
            <div className="px-4 py-3 space-y-1">
              <Link
                href="/matches"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Your Matches
              </Link>
              <Link
                href="/tracker"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Email Tracker
              </Link>
              <Link
                href="/resumes"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Resumes
              </Link>
              <button
                onClick={() => {
                  handlePremiumClick();
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Premium
              </button>
              <div className="border-t border-gray-200 my-2"></div>
              <div className="px-3 py-2 text-xs text-gray-500 truncate">{user.email}</div>
              {isPremium && (
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
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
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Manage Subscription
                </button>
              )}
              <button
                onClick={() => {
                  handleSignOut();
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        {/* First Half with Custom Blue Cloud Background */}
        <div className="relative bg-gradient-to-b from-[#498EDC] via-[#6BA3E3] via-[#8DB8EA] to-white min-h-screen pt-16">
          {/* Pastel Clouds */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Cloud 1 - Soft pastel with gradient */}
            <svg
              className="absolute top-20 left-10 opacity-40 blur-sm"
              width="200"
              height="120"
              viewBox="0 0 200 120"
            >
              <defs>
                <radialGradient id="cloud1" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#E8F4FD" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#D1E9F8" stopOpacity="0.4" />
                </radialGradient>
              </defs>
              <ellipse cx="50" cy="60" rx="40" ry="30" fill="url(#cloud1)" />
              <ellipse cx="80" cy="50" rx="35" ry="25" fill="url(#cloud1)" />
              <ellipse cx="110" cy="60" rx="40" ry="30" fill="url(#cloud1)" />
            </svg>
            {/* Cloud 2 - Larger, softer */}
            <svg
              className="absolute top-40 right-20 opacity-35 blur-[2px]"
              width="250"
              height="140"
              viewBox="0 0 250 140"
            >
              <defs>
                <radialGradient id="cloud2" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#F0F8FF" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#D6E9F5" stopOpacity="0.3" />
                </radialGradient>
              </defs>
              <ellipse cx="60" cy="70" rx="50" ry="35" fill="url(#cloud2)" />
              <ellipse cx="100" cy="60" rx="45" ry="30" fill="url(#cloud2)" />
              <ellipse cx="140" cy="70" rx="50" ry="35" fill="url(#cloud2)" />
            </svg>
            {/* Cloud 3 - Medium soft */}
            <svg
              className="absolute top-60 left-1/3 opacity-38 blur-sm"
              width="180"
              height="100"
              viewBox="0 0 180 100"
            >
              <defs>
                <radialGradient id="cloud3" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#E8F4FD" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#CEE4F2" stopOpacity="0.35" />
                </radialGradient>
              </defs>
              <ellipse cx="45" cy="50" rx="35" ry="25" fill="url(#cloud3)" />
              <ellipse cx="70" cy="42" rx="30" ry="20" fill="url(#cloud3)" />
              <ellipse cx="95" cy="50" rx="35" ry="25" fill="url(#cloud3)" />
            </svg>
            {/* Cloud 4 - Subtle lavender tint */}
            <svg
              className="absolute top-96 right-1/4 opacity-32 blur-[2px]"
              width="220"
              height="130"
              viewBox="0 0 220 130"
            >
              <defs>
                <radialGradient id="cloud4" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#F5F9FF" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#E1EDF8" stopOpacity="0.3" />
                </radialGradient>
              </defs>
              <ellipse cx="55" cy="65" rx="45" ry="32" fill="url(#cloud4)" />
              <ellipse cx="90" cy="55" rx="40" ry="28" fill="url(#cloud4)" />
              <ellipse cx="125" cy="65" rx="45" ry="32" fill="url(#cloud4)" />
            </svg>
            {/* Cloud 5 - Lower, very soft */}
            <svg
              className="absolute top-[500px] left-20 opacity-30 blur-sm"
              width="200"
              height="120"
              viewBox="0 0 200 120"
            >
              <defs>
                <radialGradient id="cloud5" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#F8FBFF" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#E8F4FD" stopOpacity="0.25" />
                </radialGradient>
              </defs>
              <ellipse cx="50" cy="60" rx="40" ry="30" fill="url(#cloud5)" />
              <ellipse cx="80" cy="50" rx="35" ry="25" fill="url(#cloud5)" />
              <ellipse cx="110" cy="60" rx="40" ry="30" fill="url(#cloud5)" />
            </svg>
            {/* Cloud 6 - Additional subtle cloud */}
            <svg
              className="absolute top-[300px] right-10 opacity-28 blur-[3px]"
              width="160"
              height="90"
              viewBox="0 0 160 90"
            >
              <defs>
                <radialGradient id="cloud6" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#F0F8FF" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#DCE9F5" stopOpacity="0.3" />
                </radialGradient>
              </defs>
              <ellipse cx="40" cy="45" rx="32" ry="22" fill="url(#cloud6)" />
              <ellipse cx="65" cy="38" rx="28" ry="18" fill="url(#cloud6)" />
              <ellipse cx="88" cy="45" rx="32" ry="22" fill="url(#cloud6)" />
            </svg>
          </div>

          {/* Content with relative positioning */}
          <div className="relative z-10">
            <NewHero onGetStarted={handleGetStarted} />
            <TrustBadge />
            <UniversityCarousel />
          </div>
        </div>

        {/* Second Half with White Background */}
        <div className="bg-white">
          <AIAgentSection />
          <NewHowItWorks />
          <StartupLogoDeck />
          <DemoMatchCard />
          <PricingSection userEmail={user?.email} onGetStarted={handleGetStarted} />
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
          // After onboarding, redirect to matches
          window.location.href = "/matches";
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
