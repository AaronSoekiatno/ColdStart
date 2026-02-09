"use client";

import Image from "next/image";

interface University {
  name: string;
  logoUrl: string;
}

interface UniversityCarouselProps {
  title?: string;
  className?: string;
}

export const UniversityCarousel = ({ title = "TRUSTED BY STUDENTS AT", className = "" }: UniversityCarouselProps) => {
  const universities: University[] = [
    { name: "UC Berkeley", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b4/Berkeley_College_of_Letters_%26_Science_logo.svg" },
    { name: "UCLA", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6c/University_of_California%2C_Los_Angeles_logo.svg" },
    { name: "UC San Diego", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cc/University_of_California%2C_San_Diego_logo.svg" },
    { name: "University of Waterloo", logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/University_of_Waterloo_seal.svg/1200px-University_of_Waterloo_seal.svg.png" },
    { name: "UC Irvine", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8f/University_of_California%2C_Irvine_logo.svg" },
    { name: "Carnegie Mellon University", logoUrl: "https://logos-world.net/wp-content/uploads/2023/08/Carnegie-Mellon-University-Logo.png" },
    { name: "University of Illinois Urbana-Champaign", logoUrl: "https://assets.foleon.com/eu-central-1/de-uploads-7e3kk3/49120/university-wordmark-full-color-rgb.11f4586744e5.png?ext=webp" },
    { name: "Harvard", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Harvard_University_logo.svg/1200px-Harvard_University_logo.svg.png?20240103220517" },
    { name: "MIT", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/MIT_logo.svg/500px-MIT_logo.svg.png?20250128192424" },
    { name: "Purdue", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Purdue_Boilermakers_logo.svg/500px-Purdue_Boilermakers_logo.svg.png?20200422051240" },
    { name: "Cal Tech", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Caltech_Logo.svg/330px-Caltech_Logo.svg.png?20190819082906" },
  ];

  return (
    <section className={`pt-8 pb-10 overflow-hidden w-full relative group bg-white ${className}`}>
      <div className="mx-auto max-w-6xl px-4">
        <h3 className="text-xs uppercase tracking-widest text-zinc-400 mb-8 text-center sm:text-left">
          {title}
        </h3>
      </div>

      <div className="relative w-full overflow-hidden grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
        <div
          className="flex w-max animate-scroll group-hover:[animation-play-state:paused] items-center"
          style={{ animationDuration: '60s' }}
        >
          {/* Three sets of universities for seamless looping with 33% scroll keyframe */}
          {[...Array(3)].map((_, setIndex) => (
            <div key={`set-${setIndex}`} className="flex items-center">
              {universities.map((university, index) => (
                <div
                  key={`uni-${setIndex}-${index}`}
                  className="flex-shrink-0 mr-12 sm:mr-24 md:mr-32 px-2 py-2 flex items-center justify-center relative"
                >
                  <img
                    src={university.logoUrl}
                    alt={university.name}
                    className={university.name === "Carnegie Mellon University"
                      ? "h-10 md:h-12 w-auto object-contain"
                      : "h-7 md:h-8 w-auto object-contain"}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
