"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { supabase, isSubscribed } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Menu, X, User as UserIcon, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BugReportModal } from "@/components/modals/BugReportModal";

interface HeaderProps {
  initialUser?: User | null;
}

export const Header = ({ initialUser }: HeaderProps) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isCheckingPremium, setIsCheckingPremium] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [matchesDropdownOpen, setMatchesDropdownOpen] = useState(false);
  const { toast } = useToast();
  const fetchingRef = useRef(false);
  const lastFetchedEmailRef = useRef<string | null>(null);
  const pathname = usePathname();
  const matchesDropdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if we are on a dashboard-style route that should always have the rectangular header
  const isDashboardRoute = useMemo(() => {
    const dashboardBaseRoutes = ['/matches', '/tracker', '/resumes', '/generate-email', '/assessment', '/ide', '/admin', '/post-mortem'];
    return dashboardBaseRoutes.some(route => pathname?.startsWith(route));
  }, [pathname]);


  // Memoize user email to prevent unnecessary re-fetches
  const userEmail = useMemo(() => user?.email, [user?.email]);

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
    // Sync with auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle matches dropdown with delay
  const handleMatchesDropdownEnter = useCallback(() => {
    if (matchesDropdownTimerRef.current) {
      clearTimeout(matchesDropdownTimerRef.current);
      matchesDropdownTimerRef.current = null;
    }
    setMatchesDropdownOpen(true);
  }, []);

  const handleMatchesDropdownLeave = useCallback(() => {
    if (matchesDropdownTimerRef.current) {
      clearTimeout(matchesDropdownTimerRef.current);
    }
    matchesDropdownTimerRef.current = setTimeout(() => {
      setMatchesDropdownOpen(false);
    }, 300); // 300ms delay before closing
  }, []);

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

  // Show authenticated rectangular header if user is logged in OR if we're on a dashboard route
  if (user || isDashboardRoute) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 flex justify-center w-full shadow-sm h-16 pointer-events-auto">
        <div className="w-full max-w-7xl px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <Image
              src="/images/blacked.svg"
              alt="Agencity logo"
              width={32}
              height={32}
              priority
            />
            <span className="text-xl font-semibold text-gray-800">Agencity</span>
          </Link>

          {/* Desktop Navigation - Hidden on mobile */}
          {user ? (
            <nav className="hidden lg:flex items-center gap-8 flex-1 justify-center">
              <DropdownMenu modal={false} open={matchesDropdownOpen} onOpenChange={setMatchesDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="text-sm font-medium text-gray-800 hover:text-gray-800/80 transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                    onMouseEnter={handleMatchesDropdownEnter}
                    onMouseLeave={handleMatchesDropdownLeave}
                  >
                    Your Matches
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="border-gray-200 bg-white text-gray-900 px-0 py-0 rounded-xl overflow-hidden min-w-[160px] shadow-lg"
                  onMouseEnter={handleMatchesDropdownEnter}
                  onMouseLeave={handleMatchesDropdownLeave}
                >
                  <DropdownMenuItem
                    className="cursor-pointer font-medium text-gray-900 hover:text-gray-900 w-full px-4 py-2.5 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:text-gray-900 border-b border-gray-100"
                    onSelect={() => router.push('/matches')}
                  >
                    All Matches
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer font-medium text-gray-900 hover:text-gray-900 w-full px-4 py-2.5 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:text-gray-900"
                    onSelect={() => router.push('/matches/saved')}
                  >
                    Saved
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link
                href="/tracker"
                className="text-sm font-medium text-gray-800 hover:text-gray-800/80 transition-colors"
              >
                Email Tracker
              </Link>

              <Link
                href="/resumes"
                className="text-sm font-medium text-gray-800 hover:text-gray-800/80 transition-colors"
              >
                Resumes
              </Link>

              <button
                onClick={() => setIsFeedbackOpen(true)}
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5" strokeWidth={2.3} />
                <span>Feedback</span>
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="rounded-full h-9 w-9 p-0 text-gray-800 hover:text-gray-700 cursor-pointer flex items-center justify-center bg-gray-100 hover:bg-gray-200 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0 active:scale-100 border-0"
                  >
                    <UserIcon className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-gray-200 bg-white text-gray-900 px-0 py-0 rounded-2xl overflow-hidden min-w-[200px] shadow-lg">
                  <div className="px-4 py-2 text-sm text-gray-800 border-b border-gray-200 rounded-t-2xl">
                    {user?.email || 'Loading...'}
                  </div>
                  {isPremium && (
                    <DropdownMenuItem
                      className="cursor-pointer font-medium text-black hover:text-black w-full px-4 py-2 text-center hover:bg-gray-50 focus:bg-gray-50 focus:text-black border-b border-gray-200"
                      onSelect={async () => {
                        try {
                          const response = await fetch('/api/stripe/create-portal-session', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ email: user?.email ?? '' }),
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
                  <DropdownMenuItem
                    className="cursor-pointer font-medium text-black hover:text-black w-full px-4 py-2 text-center hover:bg-gray-50 focus:bg-gray-50 focus:text-black rounded-b-2xl"
                    onSelect={async () => {
                      await supabase.auth.signOut();
                      setUser(null);
                      toast({
                        title: "Signed out",
                        description: "You have been signed out successfully.",
                      });
                      // Redirect to landing page after sign out
                      router.push("/");
                    }}
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          ) : (
            <div className="hidden lg:flex items-center gap-4">
              <div className="h-8 w-24 bg-gray-100 animate-pulse rounded-md" />
              <div className="h-9 w-9 bg-gray-100 animate-pulse rounded-full" />
            </div>
          )}

          {/* Mobile Navigation - Hamburger Menu */}
          <div className="lg:hidden flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-full h-9 w-9 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="pointer-events-auto absolute top-[70px] w-[90%] max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 lg:hidden z-50 overflow-hidden"
                >
                  <div className="space-y-1">
                    <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 mb-2 truncate">
                      {user?.email || 'Loading...'}
                    </div>
                    <Link
                      href="/matches"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      All Matches
                    </Link>
                    <Link
                      href="/matches/saved"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      Saved Matches
                    </Link>
                    <Link
                      href="/tracker"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      Email Tracker
                    </Link>
                    <Link
                      href="/resumes"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      Resumes
                    </Link>
                    <div className="border-t border-gray-100 my-2"></div>
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
                              body: JSON.stringify({ email: user?.email ?? '' }),
                            });
                            const data = await response.json();
                            if (data.url) window.location.href = data.url;
                          } catch (error) {
                            console.error('Error opening portal:', error);
                          }
                        }}
                        className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                      >
                        Manage Subscription
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsFeedbackOpen(true);
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      Send Feedback
                    </button>
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await supabase.auth.signOut();
                        setUser(null);
                        router.push("/");
                      }}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Premium Modal */}
        <UpgradeModal
          open={showPremiumModal}
          onOpenChange={setShowPremiumModal}
          hiddenMatchCount={0}
          email={user?.email || ''}
          onDismiss={() => setShowPremiumModal(false)}
          customTitle="Our Premium Plan"
          isPremium={isPremium}
        />
        <BugReportModal open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />
      </header>
    );
  }

  // Unauthenticated Header (Landing Page)
  return (
    <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-7xl bg-white/80 backdrop-blur-2xl border border-gray-200 rounded-full px-6 py-2.5 flex items-center justify-between shadow-lg transition-all duration-300 relative">
        {/* Logo and Title */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <Image
            src="/images/blacked.svg"
            alt="Agencity logo"
            width={32}
            height={32}
            priority
          />
          <span className="text-xl font-semibold text-gray-800">Agencity</span>
        </Link>

        {/* Desktop Navigation for Landing Page */}
        <nav className="hidden lg:flex items-center gap-8">
          <Link href="/#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">How it works</Link>
          <Link href="/#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Sign in</Link>
          <Link href="/login" className="bg-black text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-gray-800 transition-all">Get Started</Link>
        </nav>

        {/* Mobile menu logic would go here if needed for landing page */}
      </div>
    </header>
  );
};

