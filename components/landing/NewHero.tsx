"use client";

import { Button } from "@/components/ui/button";

interface NewHeroProps {
  onGetStarted: () => void;
  onCompanyClick?: () => void;
}

export function NewHero({ onGetStarted, onCompanyClick }: NewHeroProps) {
  const handleCompanyClick = () => {
    // Navigate to companies page
    if (typeof window !== 'undefined') {
      window.location.href = '/companies';
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-5xl mx-auto text-center">
        {/* Main Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-ivy tracking-tight mb-4 leading-tight text-white drop-shadow-lg">
          Land Jobs at Top Startups
          <br />
          <span className="text-white">while you sleep</span>
        </h1>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
          <Button
            onClick={onGetStarted}
            size="lg"
            className="rounded-full px-8 py-6 text-base font-medium bg-white text-[#498EDC] hover:bg-white/90 transition-all duration-300 shadow-xl hover:shadow-2xl"
          >
            Get Started
          </Button>
          <Button
            onClick={handleCompanyClick}
            variant="outline"
            size="lg"
            className="rounded-full px-8 py-6 text-base font-medium border-2 border-white bg-white/20 backdrop-blur-md text-white hover:bg-white/30 hover:border-white transition-all duration-300 shadow-lg"
          >
            I represent a company
          </Button>
        </div>

        {/* Value Proposition */}
        <div className="mt-24 relative">
          {/* Foreground Text */}
          <div className="relative z-10 space-y-2">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal tracking-tight leading-tight text-white drop-shadow-md">
              Your AI agent networks
              <br />
              with 2000+ YC founders
            </h2>
            <p className="text-xl md:text-2xl text-white mt-4 drop-shadow-sm">
              Personalized outreach. Land Interviews. Get Actual Offers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
