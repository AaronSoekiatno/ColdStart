"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { CompanyHero } from "@/components/landing/CompanyHero";
import { CompanyHowItWorks } from "@/components/landing/CompanyHowItWorks";
import { CompanyPricing } from "@/components/landing/CompanyPricing";
import { CompaniesFAQ } from "@/components/landing/CompaniesFAQ";
import { Footer } from "@/components/layout/Footer";
import { SignInModal } from "@/components/modals/SignInModal";
import { SignUpModal } from "@/components/modals/SignUpModal";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UniversityCarousel } from "@/components/landing/StartupsCarousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { motion, useScroll, useTransform } from "framer-motion";

export function CompanyLandingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 200], [1, 0.8]);
  const headerScale = useTransform(scrollY, [0, 200], [1, 0.95]);
  const headerWidth = useTransform(scrollY, [0, 200], ["100%", "90%"]);

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
    if (!user) {
      setShowSignUp(true);
      return;
    }
    // If already logged in, redirect to company form
    router.push('/company-form');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

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

          {/* Right side */}
          <div className="flex items-center gap-3 pr-1 relative z-10">
            {!user ? (
              <>
                <Link
                  href="#pricing"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="hidden md:inline-block text-sm font-medium text-white/70 hover:text-white transition-colors mr-4"
                >
                  Pricing
                </Link>
                <Link
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="hidden md:inline-block text-sm font-medium text-white/70 hover:text-white transition-colors mr-4"
                >
                  FAQ
                </Link>
                <Button
                  onClick={() => setShowSignIn(true)}
                  className="rounded-full px-6 py-2 text-sm font-semibold text-black bg-white hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
                >
                  Sign In
                </Button>
              </>
            ) : (
              <>
                <div className="hidden md:flex items-center gap-4">
                  <Link
                    href="#features"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                  >
                    Features
                  </Link>
                  <Link
                    href="#pricing"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                  >
                    Pricing
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
                  <div className="w-px h-4 bg-white/20 mx-1"></div>
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
              <div className="px-4 py-2 text-xs text-white/50 truncate">{user.email}</div>
              <div className="border-t border-white/10 my-2"></div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="block w-full text-left px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white rounded-xl transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="block w-full text-left px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white rounded-xl transition-colors"
              >
                Pricing
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="block w-full text-left px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white rounded-xl transition-colors"
              >
                FAQ
              </button>
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

      <main>
        {/* Sky Background Section */}
        <div className="relative min-h-screen pt-16 overflow-hidden bg-white">
          {/* Sky Background Image with Bottom Fade */}
          <div className="absolute top-0 left-0 right-0 h-[120vh] z-0 select-none pointer-events-none">
            <Image
              src="/images/hermes2bg.png"
              alt="Sky Background"
              fill
              className="object-cover object-top scale-110 blur-[2px]"
              priority
              style={{
                maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
              }}
            />
          </div>

          {/* White Fade Overlay for smooth transition */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none z-0" />

          {/* Content */}
          <div className="relative z-10">
            <CompanyHero onGetStarted={handleGetStarted} />
            <UniversityCarousel title="Hire from top talent" />
          </div>
        </div>

        <div id="features" className="scroll-mt-32">
          <CompanyHowItWorks />
        </div>


        <CompanyPricing onGetStarted={handleGetStarted} />

        <div id="faq" className="scroll-mt-32">
          <CompaniesFAQ />
        </div>
      </main>

      <Footer />

      <SignInModal
        open={showSignIn}
        onOpenChange={setShowSignIn}
        redirectTo="/company-form"
      />
      <SignUpModal
        open={showSignUp}
        onOpenChange={setShowSignUp}
        redirectTo="/company-form"
        onSwitchToSignIn={() => {
          setShowSignUp(false);
          setShowSignIn(true);
        }}
      />
    </div>
  );
}
