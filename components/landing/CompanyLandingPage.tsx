"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSubscribed } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { SignInModal } from "@/components/modals/SignInModal";
import { SignUpModal } from "@/components/modals/SignUpModal";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { useScroll, useTransform, motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function CompanyLandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // Header Scroll Effects
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 200], [1, 0.8]);
  const headerScale = useTransform(scrollY, [0, 200], [1, 0.95]);
  const headerWidth = useTransform(scrollY, [0, 200], ["100%", "90%"]);

  // Year for footer
  const currentYear = new Date().getFullYear();

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
    <div className="min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">

      {/* Floating Header (Ported from Hermes) */}
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
            <span className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: 'Ivy Journal, serif' }}>ProofHire</span>
          </Link>

          {/* Navigation - Desktop only, Centered */}
          <nav className="hidden md:flex items-center gap-6 relative z-10">
            <a href="#how" className="text-sm font-medium text-white/70 hover:text-white transition-colors">How it works</a>
            <a href="#what" className="text-sm font-medium text-white/70 hover:text-white transition-colors">What you get</a>
            <a href="#security" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Security</a>
            <a href="#faq" className="text-sm font-medium text-white/70 hover:text-white transition-colors">FAQ</a>
          </nav>

          {/* Right side - always visible */}
          <div className="flex items-center gap-3 pr-1 relative z-10">
            {!user ? (
              <>
                <Button
                  onClick={handleGetStarted}
                  className="rounded-full px-5 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-black bg-white hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
                >
                  Request Access
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
                      <DropdownMenuItem onClick={() => router.push('/company-form')} className="cursor-pointer">
                        Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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
              <div className="space-y-1 relative z-10">
                <a href="#how" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors">How it works</a>
                <a href="#what" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors">What you get</a>
                <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors">Security</a>
                <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors">FAQ</a>
                <div className="border-t border-white/10 my-3"></div>
                {user ? (
                  <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-3 text-base font-medium text-red-400 hover:bg-red-400/10 hover:text-red-300 rounded-xl transition-colors">Sign Out</button>
                ) : (
                  <button onClick={() => { handleGetStarted(); setMobileMenuOpen(false); }} className="w-full px-4 py-4 mt-2 text-base font-bold text-black bg-white hover:bg-gray-100 rounded-xl transition-all shadow-lg">Request Access</button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Hero Section with Sky Background */}
      <section className="relative pt-32 pb-20 overflow-hidden">
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

        <div className="relative z-10 mx-auto max-w-6xl px-4 md:pt-20 md:pb-16">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-5xl text-zinc-900" style={{ fontFamily: 'Ivy Journal, serif' }}>
                Hire engineers with <span className="text-indigo-600">proof</span> — not resumes.
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 md:text-lg">
                ProofHire runs a company-calibrated work sample and generates a shareable Proof Brief:
                what's proven, what isn't, and what to ask next—so you can move fast without guessing.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleGetStarted}
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/10">
                  Request early access
                </button>
                <button
                  onClick={() => setShowDemoModal(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white/50 backdrop-blur-sm px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white hover:border-zinc-300 transition-colors">
                  See a sample proof brief
                </button>
              </div>

              <div className="mt-6 flex items-center gap-4 text-sm text-zinc-500">
                <div className="flex -space-x-2">
                  <div className="h-8 w-8 rounded-full border border-white bg-zinc-100"></div>
                  <div className="h-8 w-8 rounded-full border border-white bg-zinc-100"></div>
                  <div className="h-8 w-8 rounded-full border border-white bg-zinc-100"></div>
                </div>
                <p>
                  <span className="text-zinc-900 font-medium">6,000+</span> engineers waiting.
                  Invite candidates when you're ready.
                </p>
              </div>
            </div>

            {/* Proof Brief card */}
            <div className="relative">
              <div
                className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-sky-400/20 to-fuchsia-500/20 blur-2xl">
              </div>
              <div className="relative rounded-3xl border border-zinc-200 bg-white/80 p-6 backdrop-blur shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Candidate Proof Brief (example)</h3>
                    <p className="mt-1 text-xs text-zinc-500">Evidence-backed summary for fast founder review</p>
                  </div>
                  <span
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-500">Shareable
                    link</span>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">Correctness</p>
                      <p className="text-xs text-zinc-500">Tests + logs verify required behavior</p>
                    </div>
                    <span
                      className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Proved</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">Testing habits</p>
                      <p className="text-xs text-zinc-500">Coverage + case quality extracted</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Partially
                      proved</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">Code quality</p>
                      <p className="text-xs text-zinc-500">Diff review + complexity signals</p>
                    </div>
                    <span
                      className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Proved</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">Communication</p>
                      <p className="text-xs text-zinc-500">Turn unproved areas into interview prompts</p>
                    </div>
                    <span
                      className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-500">Unproved</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-xs text-zinc-400">Typical founder review time: ~5–8 minutes</p>
                  <button
                    onClick={() => setShowDemoModal(true)}
                    className="text-sm font-semibold text-indigo-600 underline decoration-indigo-200 underline-offset-4 hover:decoration-indigo-500 transition-colors">
                    Open full brief
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos Carousel */}
      <section className="mt-16 border-t border-zinc-100 pt-12 pb-8 overflow-hidden w-full relative group bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-8">Trusted by students at</p>
        </div>
        <div
          className="relative w-full overflow-hidden grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
          <div className="flex w-max animate-scroll group-hover:[animation-play-state:paused]">
            {/* First set of universities */}
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex">
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/b/b4/Berkeley_College_of_Letters_%26_Science_logo.svg"
                    alt="UC Berkeley" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/6/6c/University_of_California%2C_Los_Angeles_logo.svg"
                    alt="UCLA" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/c/cc/University_of_California%2C_San_Diego_logo.svg"
                    alt="UC San Diego" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/University_of_Waterloo_seal.svg/1200px-University_of_Waterloo_seal.svg.png"
                    alt="University of Waterloo" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/8/8f/University_of_California%2C_Irvine_logo.svg"
                    alt="UC Irvine" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img src="https://logos-world.net/wp-content/uploads/2023/08/Carnegie-Mellon-University-Logo.png"
                    alt="Carnegie Mellon University" className="h-12 md:h-16 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img
                    src="https://assets.foleon.com/eu-central-1/de-uploads-7e3kk3/49120/university-wordmark-full-color-rgb.11f4586744e5.png?ext=webp"
                    alt="University of Illinois" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Harvard_University_logo.svg/1200px-Harvard_University_logo.svg.png"
                    alt="Harvard" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/MIT_logo.svg/500px-MIT_logo.svg.png"
                    alt="MIT" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Purdue_Boilermakers_logo.svg/500px-Purdue_Boilermakers_logo.svg.png"
                    alt="Purdue" className="h-8 md:h-10 w-auto object-contain" />
                </div>
                <div className="flex-shrink-0 mx-6 px-8 py-4 flex items-center justify-center">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Caltech_Logo.svg/330px-Caltech_Logo.svg.png"
                    alt="Cal Tech" className="h-8 md:h-10 w-auto object-contain" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl text-zinc-900" style={{ fontFamily: 'Ivy Journal, serif' }}>The hiring stack wasn't built for startups.
            </h2>
            <p className="mt-3 text-zinc-600 leading-relaxed">
              When your team is small, one weak hire creates drag everywhere: code quality, velocity, on-call, and
              morale.
              ProofHire replaces narrative screening with work evidence you can trust.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
              <p className="font-medium text-zinc-900">Resumes are narrative</p>
              <p className="mt-1 text-sm text-zinc-500">They don't show debugging, tradeoffs, or how someone ships.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
              <p className="font-medium text-zinc-900">Interviews are noisy</p>
              <p className="mt-1 text-sm text-zinc-500">Different interviewers, different outcomes. Hard to calibrate.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
              <p className="font-medium text-zinc-900">Take-homes are hard to compare</p>
              <p className="mt-1 text-sm text-zinc-500">Review takes forever and decisions still feel subjective.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-3xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-8 md:p-10 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl text-zinc-900" style={{ fontFamily: 'Ivy Journal, serif' }}>ProofHire turns hiring into evidence.</h2>
          <p className="mt-3 max-w-3xl text-zinc-600 leading-relaxed">
            Candidates complete a realistic simulation. We capture artifacts (diffs, tests, logs, writeups) and
            generate a clean Proof Brief:
            what's proven, what isn't, and what to verify live.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">Work sample, not trivia</p>
              <p className="mt-2 text-sm text-zinc-500">Bugfixes, feature slices, refactors—tasks that resemble startup
                work.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">Fail-closed evaluation</p>
              <p className="mt-2 text-sm text-zinc-500">No guessing. Claims are Proved/Unproved with links to evidence.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-zinc-900">Founder-calibrated rubric</p>
              <p className="mt-2 text-sm text-zinc-500">You choose what matters: speed vs rigor, testing bar, autonomy.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/10">
              Request early access
            </button>
            <button
              onClick={() => setShowDemoModal(true)}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 transition-colors">
              View sample brief
            </button>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Step 1</p>
              <p className="mt-2 font-semibold text-zinc-900">Calibrate (10 minutes)</p>
              <p className="mt-2 text-sm text-zinc-500">Answer a few questions about pace, quality bar, and what "good"
                means here.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Step 2</p>
              <p className="mt-2 font-semibold text-zinc-900">Candidates run the simulation</p>
              <p className="mt-2 text-sm text-zinc-500">Secure sandbox. Deterministic grading. Artifacts captured
                automatically.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Step 3</p>
              <p className="mt-2 font-semibold text-zinc-900">You review the Proof Brief</p>
              <p className="mt-2 text-sm text-zinc-500">Evidence links + risk flags + interview prompts. Easy to share
                with co-founders.</p>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section id="what" className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl text-zinc-900" style={{ fontFamily: 'Ivy Journal, serif' }}>Everything you wish you had during
              interviews.</h2>
            <p className="mt-3 text-zinc-600 leading-relaxed">
              ProofHire produces a packet you can actually make decisions with—consistent across candidates, grounded
              in artifacts.
            </p>
            <ul className="mt-6 space-y-3 text-zinc-700">
              <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">A shareable <span
                className="font-semibold text-zinc-900">Proof Brief</span> per candidate</li>
              <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">Evidence: diffs, test runs, logs, coverage,
                writeups</li>
              <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">Company-calibrated scoring across
                dimensions you choose</li>
              <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"><span className="font-semibold text-zinc-900">Interview
                prompts</span> generated from what's unproved</li>
              <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">Consistent comparison even with different
                interviewers</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-zinc-400">Founder outcome</p>
            <h3 className="mt-3 text-xl font-semibold text-zinc-900">Spend less time debating. More time building.</h3>
            <p className="mt-3 text-zinc-600 leading-relaxed">
              For early teams, speed matters—but so does correctness. ProofHire helps you move fast with a documented
              standard and clear evidence.
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="font-medium text-zinc-900">Faster shortlist</p>
                <p className="mt-1 text-sm text-zinc-500">Review a brief in minutes instead of replaying an hour-long
                  interview.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="font-medium text-zinc-900">Less interviewer variance</p>
                <p className="mt-1 text-sm text-zinc-500">A consistent rubric and evidence packet across candidates.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="font-medium text-zinc-900">Clear next questions</p>
                <p className="mt-1 text-sm text-zinc-500">Unproved areas become structured prompts for a focused live
                  interview.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column: Startups vs Candidates */}
      <section id="talent" className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-lg shadow-zinc-200/50">
            <h3 className="text-xl font-semibold text-zinc-900">For Startups</h3>
            <p className="mt-2 text-zinc-600">Move fast without lowering the bar.</p>
            <ul className="mt-5 space-y-2 text-sm text-zinc-600">
              <li className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">Standardize evaluation without acting
                like BigCo</li>
              <li className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">Reduce interview load and co-founder
                debate</li>
              <li className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">Keep hiring decisions grounded in
                job-relevant evidence</li>
            </ul>
            <button
              onClick={handleGetStarted}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/20">
              Request early access
            </button>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
            <h3 className="text-xl font-semibold text-zinc-900">For Candidates</h3>
            <p className="mt-2 text-zinc-600">Get hired for what you can do.</p>
            <ul className="mt-5 space-y-2 text-sm text-zinc-600">
              <li className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">Show real work, not keyword
                storytelling</li>
              <li className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">Reuse your Proof Profile across
                multiple startups</li>
              <li className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">Join a network with 6,000+ engineers
                already waiting</li>
            </ul>
            <button
              onClick={handleGetStarted}
              className="mt-6 inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 transition-colors">
              Join the talent network
            </button>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-3xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-8 md:p-10 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl text-zinc-900" style={{ fontFamily: 'Ivy Journal, serif' }}>Secure by default. Built to be auditable.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="font-semibold text-zinc-900">Isolated execution</p>
              <p className="mt-2 text-sm text-zinc-500">Sandboxed runs with resource limits and controlled environment for
                consistency.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="font-semibold text-zinc-900">Evidence trail</p>
              <p className="mt-2 text-sm text-zinc-500">Every result points back to artifacts (diffs, tests, logs) so
                reviews are defensible.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="font-semibold text-zinc-900">Configurable collection</p>
              <p className="mt-2 text-sm text-zinc-500">Control what you collect and retain. Start without repo access.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="font-semibold text-zinc-900">Job-relevant signals</p>
              <p className="mt-2 text-sm text-zinc-500">Focus on demonstrated work and artifacts—no reliance on resume
                credentials.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl text-zinc-900" style={{ fontFamily: 'Ivy Journal, serif' }}>FAQ</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="font-semibold text-zinc-900">Is this a take-home?</p>
            <p className="mt-2 text-sm text-zinc-500">It's a structured work sample designed to be bounded, comparable,
              and easy to review.</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="font-semibold text-zinc-900">Can candidates use AI tools?</p>
            <p className="mt-2 text-sm text-zinc-500">Configurable per company. We're built to evaluate outcomes and
              engineering judgment.</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="font-semibold text-zinc-900">How long does setup take?</p>
            <p className="mt-2 text-sm text-zinc-500">Minutes to calibrate. You can invite candidates immediately.</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="font-semibold text-zinc-900">Do we need to share our private repo?</p>
            <p className="mt-2 text-sm text-zinc-500">Not to start. Early access can run on standardized simulations.</p>
          </div>
        </div>
      </section>

      {/* Access form */}
      <section id="access" className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 md:p-10 shadow-inner">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl text-zinc-900" style={{ fontFamily: 'Ivy Journal, serif' }}>Your next hire should come with evidence.
              </h2>
              <p className="mt-3 text-zinc-600 leading-relaxed">
                Request early access for your startup, or join the talent network to get matched with teams that hire
                based on real work.
              </p>
              <p className="mt-4 text-sm text-zinc-500">
                Tip: If you're hiring now, include your role + timeline—responses are prioritized.
              </p>
            </div>

            <form className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50"
              onSubmit={(e) => { e.preventDefault(); alert('Thanks! We will be in touch soon.'); }}>
              <label className="block text-sm font-medium text-zinc-700">Work email</label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                placeholder="you@startup.com" type="email" required />

              <label className="mt-4 block text-sm font-medium text-zinc-700">I'm here as</label>
              <select
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm">
                <option>Founder / Hiring manager</option>
                <option>Candidate</option>
              </select>

              <label className="mt-4 block text-sm font-medium text-zinc-700">Hiring need (optional)</label>
              <input
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                placeholder="Backend engineer, hiring this month" />

              <button
                className="mt-5 w-full rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/10">
                Join early access
              </button>

              <p className="mt-3 text-xs text-zinc-400">
                By submitting, you agree to be contacted about early access. No spam.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold text-zinc-900">ProofHire</p>
              <p className="mt-1 text-sm text-zinc-500">Evidence-first hiring for early startups.</p>
            </div>
            <div className="flex gap-5 text-sm text-zinc-500">
              <a href="#how" className="hover:text-zinc-900 transition-colors">How it works</a>
              <a href="#security" className="hover:text-zinc-900 transition-colors">Security</a>
              <a href="#faq" className="hover:text-zinc-900 transition-colors">FAQ</a>
            </div>
          </div>
          <p className="mt-8 text-xs text-zinc-400">© <span id="year">{currentYear}</span> ProofHire. All rights reserved.</p>
        </div>
      </footer>

      {/* Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDemoModal(false)}></div>
          <div className="relative w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Sample Proof Brief</p>
                <p className="mt-1 text-sm text-zinc-500">This is what founders receive after a candidate completes a
                  simulation.</p>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 transition-colors">
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs uppercase tracking-widest text-zinc-400">Proved</p>
                <p className="mt-2 font-semibold text-zinc-900">Implemented required behavior</p>
                <p className="mt-2 text-sm text-zinc-600">Evidence: test logs + diff link + passing suite.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs uppercase tracking-widest text-zinc-400">Proved</p>
                <p className="mt-2 font-semibold text-zinc-900">Readable, maintainable changes</p>
                <p className="mt-2 text-sm text-zinc-600">Evidence: small commits, low complexity delta, clear naming.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs uppercase tracking-widest text-zinc-400">Unproved</p>
                <p className="mt-2 font-semibold text-zinc-900">API design under ambiguity</p>
                <p className="mt-2 text-sm text-zinc-600">Interview prompts: tradeoffs, constraints, edge cases.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs uppercase tracking-widest text-zinc-400">Unproved</p>
                <p className="mt-2 font-semibold text-zinc-900">Production readiness habits</p>
                <p className="mt-2 text-sm text-zinc-600">Interview prompts: monitoring, rollback, failure modes.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-sm font-semibold text-zinc-900">Suggested next interview (30 minutes)</p>
              <ol className="mt-2 list-decimal pl-5 text-sm text-zinc-600 space-y-1">
                <li>Walk through one design decision and alternatives.</li>
                <li>Ask for edge cases and failure modes they'd monitor.</li>
                <li>Have them improve one test for better coverage/meaning.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

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
