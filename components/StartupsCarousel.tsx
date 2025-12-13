"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

interface University {
  name: string;
  logoUrl: string;
}

export const UniversityCarousel = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const universities: University[] = [
    { name: "UC Berkeley", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b4/Berkeley_College_of_Letters_%26_Science_logo.svg" },
    { name: "UCLA", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6c/University_of_California%2C_Los_Angeles_logo.svg" },
    { name: "UC San Diego", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cc/University_of_California%2C_San_Diego_logo.svg" },
    { name: "UC Santa Barbara", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d4/UC_Santa_Barbara_logo.svg" },
    { name: "UC Irvine", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8f/University_of_California%2C_Irvine_logo.svg" },
    { name: "UC Riverside", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/21/UC_Riverside_Highlanders_logo.svg" },
    { name: "San Diego State University", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/59/San_Diego_State_University_primary_logo.svg" },
    { name: "Harvard", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Harvard_University_logo.svg/1200px-Harvard_University_logo.svg.png?20240103220517" },
    { name: "MIT", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/MIT_logo.svg/500px-MIT_logo.svg.png?20250128192424" },
    { name: "Purdue", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Purdue_Boilermakers_logo.svg/500px-Purdue_Boilermakers_logo.svg.png?20200422051240" },
    { name: "Cal Tech", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Caltech_Logo.svg/330px-Caltech_Logo.svg.png?20190819082906" },
  ];

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let scrollPosition = 0;
    let isPaused = false;
    const scrollSpeed = 0.5; // pixels per frame
    let animationFrameId: number;

    const scroll = () => {
      if (!isPaused) {
        scrollPosition += scrollSpeed;
        const firstSetWidth = scrollContainer.scrollWidth / 2;
        
        // When we've scrolled past the first set, reset to 0 seamlessly
        if (scrollPosition >= firstSetWidth) {
          scrollPosition = scrollPosition - firstSetWidth;
        }
        
        scrollContainer.style.transform = `translateX(-${scrollPosition}px)`;
      }
      animationFrameId = requestAnimationFrame(scroll);
    };

    const handleMouseEnter = () => {
      isPaused = true;
    };

    const handleMouseLeave = () => {
      isPaused = false;
    };

    scrollContainer.addEventListener('mouseenter', handleMouseEnter);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);
    
    animationFrameId = requestAnimationFrame(scroll);

    return () => {
      cancelAnimationFrame(animationFrameId);
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <section className="py-10 sm:py-12 md:py-16 overflow-hidden w-full relative">
      <div className="w-full">
        <h3 className="text-center text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8 px-4 sm:px-6 md:px-8">
          Trusted by UC & National Universities
        </h3>
        
        <div className="relative w-full overflow-hidden">
          <div 
            ref={scrollRef}
            className="flex"
            style={{ willChange: 'transform' }}
          >
            {/* First set of universities */}
            {universities.map((university, index) => (
              <div
                key={`first-${index}`}
                className="flex-shrink-0 mx-2 sm:mx-4 md:mx-6 px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
              >
                <Image
                  src={university.logoUrl}
                  alt={university.name}
                  width={160}
                  height={160}
                  className="h-12 sm:h-14 md:h-16 w-auto object-contain"
                  unoptimized
                />
              </div>
            ))}
            {/* Duplicate set for seamless infinite loop */}
            {universities.map((university, index) => (
              <div
                key={`second-${index}`}
                className="flex-shrink-0 mx-2 sm:mx-4 md:mx-6 px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm flex items-center justify-center"
              >
                <Image
                  src={university.logoUrl}
                  alt={university.name}
                  width={160}
                  height={160}
                  className="h-12 sm:h-14 md:h-16 w-auto object-contain"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
