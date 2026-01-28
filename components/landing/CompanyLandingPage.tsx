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
import { motion, useScroll, useTransform } from "framer-motion";

export function CompanyLandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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
              <Button
                onClick={() => setShowSignIn(true)}
                className="rounded-full px-6 py-2 text-sm font-semibold text-black bg-white hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
              >
                Sign In
              </Button>
            ) : (
              <Button
                onClick={handleSignOut}
                variant="ghost"
                className="rounded-full h-9 px-4 text-white hover:bg-white/10 hover:text-white transition-colors ring-0 focus-visible:ring-0"
              >
                Sign Out
              </Button>
            )}
          </div>
        </motion.div>
      </motion.header>

      {/* Main Content */}
      <main>
        {/* First Half with Custom Blue Cloud Background */}
        <div className="relative min-h-screen pt-16 overflow-hidden bg-white">
          {/* Pastel Clouds - Same as main landing page */}
          <div className="absolute top-0 left-0 right-0 h-[120vh] z-0 select-none pointer-events-none">
            <Image
              src="/images/newHermes.png"
              alt="Sky Background"
              fill
              className="object-cover object-top"
              priority
              style={{
                maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
              }}
            />
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

