"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CompanyHeroProps {
  onGetStarted: () => void;
}

export function CompanyHero({ onGetStarted }: CompanyHeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-5xl mx-auto text-center">
        {/* Main Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-ivy tracking-tight mb-4 leading-tight text-white drop-shadow-lg">
          Find Your Perfect
          <br />
          <span className="text-white">Engineering Talent</span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg lg:text-xl text-white/80 mt-6 mb-12 leading-normal drop-shadow-sm">
          AI-powered vetting finds candidates who will excel at your startup – 24/7 on autopilot
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={onGetStarted}
            size="lg"
            className="rounded-full px-8 py-6 text-base font-medium bg-white text-[#498EDC] hover:bg-white/90 transition-all duration-300 shadow-lg"
          >
            Get Started
          </Button>
          <Link href="/">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8 py-6 text-base font-medium border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:border-white/50 transition-all duration-300"
            >
              I'm a candidate
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

