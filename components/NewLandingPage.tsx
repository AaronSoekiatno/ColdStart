"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { NewHero } from "@/components/NewHero";
import { ProblemSection } from "@/components/ProblemSection";
import { TrustBadge } from "@/components/TrustBadge";
import { StartupsCarousel } from "@/components/StartupsCarousel";
import { AIAgentSection } from "@/components/AIAgentSection";
import { NewFeatures } from "@/components/NewFeatures";
import { FounderDataSection } from "@/components/FounderDataSection";
import { NewHowItWorks } from "@/components/NewHowItWorks";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { SignInModal } from "@/components/SignInModal";
import { SignUpModal } from "@/components/SignUpModal";
import { WaitlistModal } from "@/components/WaitlistModal";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NewLandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = () => {
    // Open waitlist modal instead of sign up
    setShowWaitlist(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo - Hidden when scrolled */}
          <Link href="/" className={`flex items-center gap-3 transition-opacity duration-300 ${
            isScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}>
            <Image src="/images/hermes.png" alt="Hermes" width={32} height={32} />
            <span className="text-xl font-semibold text-white drop-shadow-md">Hermes</span>
          </Link>

          {/* Navigation - Hidden when scrolled */}
          <nav className={`flex items-center gap-4 transition-opacity duration-300 ${
            isScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="rounded-full h-9 px-4 text-white drop-shadow-md"
                    >
                      {user.email}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSignOut}>
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
          </nav>

          {/* Join Waitlist Button - Only visible when scrolled */}
          <Button
            onClick={handleGetStarted}
            className={`rounded-full px-6 py-2 text-white font-medium drop-shadow-md transition-all duration-300 transform ${
              isScrolled ? 'opacity-100 pointer-events-auto bg-[#498EDC] hover:bg-[#3a7bc4] hover:scale-105 hover:shadow-lg' : 'opacity-0 pointer-events-none'
            }`}
          >
            Join the Waitlist
          </Button>
        </div>
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
            <StartupsCarousel />
            <ProblemSection />
          </div>
        </div>

        {/* Second Half with White Background */}
        <div className="bg-white">
          <AIAgentSection />
          <NewFeatures />
          <FounderDataSection />
          <NewHowItWorks />
          <FinalCTA onGetStarted={handleGetStarted} />
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals */}
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
      <WaitlistModal
        open={showWaitlist}
        onOpenChange={setShowWaitlist}
      />
    </div>
  );
}
