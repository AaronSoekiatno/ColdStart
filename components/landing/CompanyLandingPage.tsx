"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { CompanyHero } from "@/components/landing/CompanyHero";
import { CompanyAIVettingSection } from "@/components/landing/CompanyAIVettingSection";
import { Footer } from "@/components/layout/Footer";
import { SignInModal } from "@/components/modals/SignInModal";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CompanyLandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
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
    // For companies, open contact form or email
    window.location.href = 'mailto:aidan.nt76@gmail.com?subject=Company%20Partnership%20Inquiry';
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

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

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {!user ? (
              <Button
                onClick={() => setShowSignIn(true)}
                className={`rounded-full px-4 sm:px-6 py-2 text-sm sm:text-base text-white font-medium drop-shadow-md bg-white/10 hover:bg-white/20 border border-white/30 transition-all duration-300 ${isScrolled ? 'hidden sm:flex' : 'flex'
                  }`}
              >
                Sign In
              </Button>
            ) : (
              <Button
                onClick={handleSignOut}
                variant="ghost"
                className="rounded-full h-9 px-4 text-white drop-shadow-md text-sm"
              >
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* First Half with Custom Blue Cloud Background */}
        <div className="relative bg-gradient-to-b from-[#498EDC] via-[#6BA3E3] via-[#8DB8EA] to-white min-h-screen pt-16">
          {/* Pastel Clouds - Same as main landing page */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Cloud 1 */}
            <svg
              className="absolute top-20 left-10 opacity-40 blur-sm"
              width="200"
              height="120"
              viewBox="0 0 200 120"
            >
              <defs>
                <radialGradient id="cloud1-company" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#E8F4FD" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#D1E9F8" stopOpacity="0.4" />
                </radialGradient>
              </defs>
              <ellipse cx="50" cy="60" rx="40" ry="30" fill="url(#cloud1-company)" />
              <ellipse cx="80" cy="50" rx="35" ry="25" fill="url(#cloud1-company)" />
              <ellipse cx="110" cy="60" rx="40" ry="30" fill="url(#cloud1-company)" />
            </svg>
            {/* Cloud 2 */}
            <svg
              className="absolute top-40 right-20 opacity-35 blur-[2px]"
              width="250"
              height="140"
              viewBox="0 0 250 140"
            >
              <defs>
                <radialGradient id="cloud2-company" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#F0F8FF" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#D6E9F5" stopOpacity="0.3" />
                </radialGradient>
              </defs>
              <ellipse cx="60" cy="70" rx="50" ry="35" fill="url(#cloud2-company)" />
              <ellipse cx="100" cy="60" rx="45" ry="30" fill="url(#cloud2-company)" />
              <ellipse cx="140" cy="70" rx="50" ry="35" fill="url(#cloud2-company)" />
            </svg>
            {/* Cloud 3 */}
            <svg
              className="absolute top-60 left-1/3 opacity-38 blur-sm"
              width="180"
              height="100"
              viewBox="0 0 180 100"
            >
              <defs>
                <radialGradient id="cloud3-company" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#E8F4FD" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#CEE4F2" stopOpacity="0.35" />
                </radialGradient>
              </defs>
              <ellipse cx="45" cy="50" rx="35" ry="25" fill="url(#cloud3-company)" />
              <ellipse cx="70" cy="42" rx="30" ry="20" fill="url(#cloud3-company)" />
              <ellipse cx="95" cy="50" rx="35" ry="25" fill="url(#cloud3-company)" />
            </svg>
          </div>

          {/* Content with relative positioning */}
          <div className="relative z-10">
            <CompanyHero onGetStarted={handleGetStarted} />
          </div>
        </div>

        {/* Second Half with White Background */}
        <div className="bg-white">
          <CompanyAIVettingSection />
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      <SignInModal
        open={showSignIn}
        onOpenChange={setShowSignIn}
      />
    </div>
  );
}

