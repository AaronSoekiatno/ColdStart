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

import { CompanyHowItWorks } from "@/components/landing/CompanyHowItWorks";

import { CompaniesFAQ } from "@/components/landing/CompaniesFAQ";
import { UniversityCarousel } from "./StartupsCarousel";

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
          className="pointer-events-auto w-full max-w-3xl bg-[#121212]/70 backdrop-blur-2xl border border-white/10 rounded-full px-5 py-3 flex items-center shadow-2xl transition-all duration-300 relative overflow-hidden"
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
            <span className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-ivy), serif' }}>Agencity</span>
          </Link>

          {/* Navigation - Desktop only, Right Pushed */}
          <nav className="hidden md:flex ml-auto items-center gap-6 pr-6 relative z-10">
            {/* <a href="#faq" className="text-sm font-medium text-white/70 hover:text-white transition-colors">FAQ</a> */}
            <Link href="/candidates" className="text-sm font-medium text-white/70 hover:text-white transition-colors">For Candidates</Link>
            <a href="#how-it-works" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Features</a>
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
                      <DropdownMenuItem onClick={() => router.push('/company-dashboard')} className="cursor-pointer">
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
                {/* <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors">FAQ</a> */}
                <Link href="/candidates" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors">For Candidates</Link>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-xl transition-colors">Features</a>
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
      <section className="relative pt-24 pb-6 overflow-hidden">
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

        {/* Gradient Overlay for smooth blend */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-white via-white/60 to-transparent z-0 pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-6xl px-4 md:pt-6 md:pb-8">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <h1 className="mt-4 text-9xl font-semibold leading-tight tracking-tight md:text-7xl text-zinc-1600" style={{ fontFamily: 'var(--font-ivy), serif' }}>
                Hire 11x Engineers at 5x the speed
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-600 md:text-lg">
                Candidates proven by code. Make confident hiring decisions in minutes.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleGetStarted}
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/10">
                  Request early access
                </button>
                <button
                  onClick={() => router.push('/candidates')}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white/50 backdrop-blur-sm px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white hover:border-zinc-300 transition-colors">
                  Apply as a candidate
                </button>
              </div>

              <div className="mt-6 flex items-center gap-4 text-sm text-zinc-500">
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
                  <span className="text-zinc-900 font-medium">6,000+</span> vetted engineers
                </p>
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="relative md:scale-125 md:origin-top-left md:-mt-20">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-sky-400/20 to-amber-500/20 blur-2xl" />
              <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
                {/* Mini top bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 mx-3 h-5 bg-white rounded border border-zinc-200 flex items-center px-2">
                    <span className="text-[10px] text-zinc-400">agencity.com/company-dashboard</span>
                  </div>
                </div>

                <div className="flex h-[380px]">
                  {/* Mini sidebar */}
                  <div className="w-28 bg-white border-r border-zinc-100 flex flex-col py-3 px-2 gap-0.5 flex-shrink-0">
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-2">Recruiter</p>
                    {[
                      { label: 'Discover', icon: '🔍' },
                      { label: 'Candidates', active: true },
                      { label: 'Assessment' },
                      { label: 'Profile' },
                    ].map((item) => (
                      <div key={item.label} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${item.active ? 'bg-black text-white' : 'text-zinc-500'}`}>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 flex flex-col min-w-0 p-3">
                    {/* Header */}
                    <div className="mb-2">
                      <p className="text-xs font-bold text-zinc-900">Candidates</p>
                      <p className="text-[10px] text-zinc-400">View and manage your best matched engineers.</p>
                    </div>

                    {/* Search bar */}
                    <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 mb-2">
                      <svg className="w-3 h-3 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <span className="text-[10px] text-zinc-400">Search candidates...</span>
                    </div>

                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-1 px-2 py-1 text-[9px] font-semibold text-zinc-400 uppercase tracking-wide border-b border-zinc-100">
                      <div className="col-span-4">Candidate</div>
                      <div className="col-span-3">Match</div>
                      <div className="col-span-3">Proven</div>
                      <div className="col-span-2">Gaps</div>
                    </div>

                    {/* Candidate rows */}
                    {[
                      { name: 'Candidate A', school: 'MIT', match: 92, color: 'bg-emerald-100 text-emerald-700', proven: 4, gaps: 2, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=48&h=48&auto=format&fit=crop' },
                      { name: 'Candidate D', school: 'CMU', match: 90, color: 'bg-emerald-100 text-emerald-700', proven: 4, gaps: 1, avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=48&h=48&auto=format&fit=crop' },
                      { name: 'Candidate B', school: 'Stanford', match: 88, color: 'bg-blue-100 text-blue-700', proven: 3, gaps: 2, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=48&h=48&auto=format&fit=crop' },
                      { name: 'Candidate C', school: 'Berkeley', match: 85, color: 'bg-blue-100 text-blue-700', proven: 3, gaps: 1, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=48&h=48&auto=format&fit=crop' },
                    ].map((c, i) => (
                      <div key={i} className="grid grid-cols-12 gap-1 px-2 py-1.5 items-center hover:bg-zinc-50 transition-colors border-b border-zinc-50">
                        <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-zinc-100">
                            <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-zinc-900 truncate">{c.name}</p>
                            <p className="text-[9px] text-zinc-400 truncate">{c.school}</p>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${c.color}`}>{c.match}%</span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-[10px] font-semibold text-emerald-600">{c.proven} ✓</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] font-semibold text-amber-600">{c.gaps} !</span>
                        </div>
                      </div>
                    ))}

                    <div className="mt-auto pt-2 text-[9px] text-zinc-400 text-center">8 candidates matched • avg 87% fit</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos Carousel */}
      <UniversityCarousel className="mt-4 border-t border-zinc-100" />



      {/* How It Works (Company Process) */}
      <CompanyHowItWorks />










      {/* FAQ
      <section id="faq">
        <CompaniesFAQ />
      </section> */}

      {/* Access form */}
      <section id="access" className="py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-4xl md:text-5xl font-semibold text-zinc-900 tracking-tight" style={{ fontFamily: 'var(--font-ivy), serif' }}>
            Stop guessing. Start hiring with proof.
          </h2>
          <p className="text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed">
            Join early-stage founders who are building teams based on evidence, not interviews alone. See exactly what your next engineer has proven—before the first call.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleGetStarted}
              className="rounded-full bg-zinc-900 px-8 py-4 text-base font-semibold text-white hover:bg-zinc-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Request Early Access
            </button>
          </div>

          {/* Social Proof for Founders */}
          <div className="pt-6">
            <p className="text-sm text-zinc-500 mb-3">Built for early-stage teams at:</p>
            <div className="flex flex-wrap items-center justify-center gap-6 opacity-60">
              <span className="text-xs font-medium text-zinc-400">YC-backed startups</span>
              <span className="text-zinc-300">•</span>
              <span className="text-xs font-medium text-zinc-400">Seed to Series A</span>
              <span className="text-zinc-300">•</span>
              <span className="text-xs font-medium text-zinc-400">Technical founders</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Agencity</p>
              <p className="mt-1 text-sm text-zinc-500">Evidence-first hiring for early startups.</p>
            </div>
            <div className="flex gap-5 text-sm text-zinc-500">

              {/* <a href="#faq" className="hover:text-zinc-900 transition-colors">FAQ</a> */}
            </div>
          </div>
          <p className="mt-8 text-xs text-zinc-400">© <span id="year">{currentYear}</span> Agencity. All rights reserved.</p>
        </div>
      </footer>

      {/* Demo Modal - Updated */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDemoModal(false)}></div>
          <div className="relative w-full max-w-4xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-6 mb-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full border-4 border-emerald-50 overflow-hidden shadow-lg flex-shrink-0">
                  <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&h=256&auto=format&fit=crop" alt="Candidate A" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-2xl font-bold text-zinc-900">Candidate A</p>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">92% Match</span>
                  </div>
                  <p className="text-sm text-zinc-500">MIT • 4 years experience • Python, React, Go</p>
                </div>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 transition-colors flex-shrink-0">
                Close
              </button>
            </div>

            {/* Proven Claims */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Proven by Code & Evidence
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-900 mb-1">Active Python contributor (18+ months)</p>
                  <p className="text-xs text-emerald-700">GitHub: 124 commits across 6 projects, consistent activity since Jan 2023</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-900 mb-1">Strong debugger (15+ bug fixes)</p>
                  <p className="text-xs text-emerald-700">GitHub: Refactoring commits, iterative development patterns</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-900 mb-1">Production-ready code quality</p>
                  <p className="text-xs text-emerald-700">Assessment: 95% score, excellent code structure</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-900 mb-1">Full-stack experience (React + Python)</p>
                  <p className="text-xs text-emerald-700">GitHub: 3 full-stack projects with modern patterns</p>
                </div>
              </div>
            </div>

            {/* Unproven Claims */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                Explore in Interview
              </h3>
              <div className="space-y-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-amber-900 mb-1">Machine Learning experience</p>
                      <p className="text-xs text-amber-700 mb-2">Source: Self-reported on resume</p>
                      <p className="text-xs text-amber-800 italic">💬 Suggested question: "Can you walk me through a recent ML project and your role in it?"</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-amber-900 mb-1">Led a team of 3 engineers</p>
                      <p className="text-xs text-amber-700 mb-2">Source: Resume claim</p>
                      <p className="text-xs text-amber-800 italic">💬 Suggested question: "Tell me about your leadership experience. What were the key challenges?"</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Match Analysis */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Strengths (5)</p>
                  <ul className="space-y-1.5 text-sm text-zinc-700">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      <span>4+ years Python experience (matches requirement)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      <span>Fast-paced startup background</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-0.5">✓</span>
                      <span>High code quality standards</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Gaps (2)</p>
                  <ul className="space-y-1.5 text-sm text-zinc-700">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">!</span>
                      <span>No ML production experience verified</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">!</span>
                      <span>Leadership claims need exploration</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-200 text-center">
              <p className="text-xs text-zinc-400">This brief took ~6 minutes to review • Ready to schedule interview</p>
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
