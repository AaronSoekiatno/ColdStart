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
          The Marketplace for
          <br />
          <span className="text-white">Top Startup Talent</span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg lg:text-xl text-white/80 mt-6 mb-12 leading-normal drop-shadow-sm">
          Connecting ambitious candidates with innovative startups through AI-powered matching
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
      </div>
    </section>
  );
}
