"use client";

import { Button } from "@/components/ui/button";

interface NewHeroProps {
  onGetStarted: () => void;
  onCompanyClick?: () => void;
}

export function NewHero({ onGetStarted, onCompanyClick }: NewHeroProps) {
  const handleCompanyClick = () => {
    // Navigate to companies page (now the main page)
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <section className="relative w-full flex items-start justify-center px-6 pt-20 pb-2">
      <div className="max-w-5xl mx-auto text-center">
        {/* Main Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-ivy tracking-tight mb-6 leading-tight text-white drop-shadow-lg">
          Land Jobs at Top Startups
        </h1>

        <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-8 font-medium drop-shadow-md">
          Get direct intros to founders based on what you know not who you know
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
          <Button
            onClick={onGetStarted}
            size="lg"
            className="rounded-full px-8 py-6 text-base font-bold bg-white text-[#498EDC] hover:bg-white/90 transition-all duration-300 shadow-xl hover:shadow-2xl cursor-pointer"
          >
            Apply Now!
          </Button>
          <Button
            onClick={handleCompanyClick}
            variant="outline"
            size="lg"
            className="rounded-full px-8 py-6 text-base font-medium border-2 border-white bg-white/20 backdrop-blur-md text-white hover:bg-white/30 hover:border-white transition-all duration-300 shadow-lg cursor-pointer"
          >
            I represent a company
          </Button>
        </div>


      </div>
    </section>
  );
}
