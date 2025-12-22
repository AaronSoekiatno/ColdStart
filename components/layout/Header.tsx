"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  const { toast } = useToast();
  const fetchingRef = useRef(false);
  const lastFetchedEmailRef = useRef<string | null>(null);

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-300 mb-4 border border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo and Title */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <Image
            src="/images/blacked.svg"
            alt="Hermes logo"
            width={32}
            height={32}
            priority
          />
          <span className="text-xl font-semibold text-gray-800">Hermes</span>
        </Link>

        {/* Desktop Navigation - Hidden on mobile */}
        <nav className="hidden lg:flex items-center gap-8 flex-1 justify-center">
          {user ? (
            <>
              <Link
                href="/matches"
                className="text-sm font-medium text-gray-800 hover:text-gray-800/80 transition-colors"
              >
                Your Matches
              </Link>
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
                onClick={handlePremiumClick}
                className="text-sm font-medium text-gray-800 hover:text-gray-800/80 transition-colors cursor-pointer"
              >
                Premium
              </button>
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
                    {user.email}
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
            </>
          ) : null}
        </nav>

        {/* Mobile Navigation - Hamburger Menu */}
        <div className="lg:hidden flex items-center gap-2">
          {user && (
            <DropdownMenu modal={false} open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full h-9 px-4 text-gray-600 hover:text-gray-700"
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-gray-200 bg-white text-gray-900 px-0 py-0 rounded-2xl overflow-hidden min-w-[220px] mr-4 shadow-lg">
                <div className="px-4 py-3 text-xs text-gray-500 border-b border-gray-200 rounded-t-2xl truncate">
                  {user.email}
                </div>
                <DropdownMenuItem
                  className="w-full px-4 py-3 text-sm font-medium text-gray-900 hover:text-gray-900 hover:bg-gray-50 focus:bg-gray-50 focus:text-gray-900 cursor-pointer border-b border-gray-100"
                  onSelect={() => {
                    setMobileMenuOpen(false);
                    router.push('/matches');
                  }}
                >
                  Your Matches
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="w-full px-4 py-3 text-sm font-medium text-gray-900 hover:text-gray-900 hover:bg-gray-50 focus:bg-gray-50 focus:text-gray-900 cursor-pointer border-b border-gray-100"
                  onSelect={() => {
                    setMobileMenuOpen(false);
                    router.push('/tracker');
                  }}
                >
                  Email Tracker
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="w-full px-4 py-3 text-sm font-medium text-gray-900 hover:text-gray-900 hover:bg-gray-50 focus:bg-gray-50 focus:text-gray-900 cursor-pointer border-b border-gray-100"
                  onSelect={() => {
                    setMobileMenuOpen(false);
                    router.push('/resumes');
                  }}
                >
                  Resumes
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="w-full px-4 py-3 text-sm font-medium text-gray-900 hover:text-gray-900 hover:bg-gray-50 focus:bg-gray-50 focus:text-gray-900 cursor-pointer border-b border-gray-100"
                  onSelect={() => {
                    setMobileMenuOpen(false);
                    handlePremiumClick();
                  }}
                >
                  Premium Plan
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-200 my-0" />
                {isPremium && (
                  <DropdownMenuItem
                    className="w-full px-4 py-3 text-sm font-medium text-gray-900 hover:text-gray-900 hover:bg-gray-50 focus:bg-gray-50 focus:text-gray-900 cursor-pointer border-b border-gray-100"
                    onSelect={async () => {
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
                  >
                    Manage Subscription
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="w-full px-4 py-3 text-sm font-medium text-gray-900 hover:text-gray-900 hover:bg-gray-50 focus:bg-gray-50 focus:text-gray-900 cursor-pointer rounded-b-2xl"
                  onSelect={async () => {
                    setMobileMenuOpen(false);
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
          )}
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
      {user && (
        <BugReportModal open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen} />
      )}
    </header>
  );
};

