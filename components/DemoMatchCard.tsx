"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import { ScrollAnimate } from "@/components/ScrollAnimate";

export function DemoMatchCard() {
  // Demo data for three startups - matching real UI structure
  const demoStartups = [
    {
      name: "Keystone",
      description: "Your team's on-call AI engineer",
      batch: "Summer 2025",
      industry: "AI, Developer Tools",
      matchScore: 92,
      founders: [
        {
          name: "Pablo Hansen",
          role: "Founder",
          bio: "I finished my master's degree in AI at 19 and was then hire #1 at Onyx (YC W24) for a year before starting Keystone.",
        },
      ],
    },
    {
      name: "Novaflow",
      description: "The AI data analyst for biology labs",
      batch: "Summer 2025",
      industry: "AI, Healthcare",
      matchScore: 88,
      founders: [
        {
          name: "Aman Agarwal",
          role: "Founder",
          bio: "Former computational biologist published in Nature and Cell. I helped develop the first oral COVID-19 vaccine.",
        },
        {
          name: "Amulya Balakrishnan",
          role: "Founder",
          bio: "Former software engineer at Zoom. Studied computer science and business at USC (fight on!).",
        },
      ],
    },
    {
      name: "Stagewise",
      description: "AI-powered coding agent for frontend development",
      batch: "Summer 2025",
      industry: "AI, Developer Tools",
      matchScore: 85,
      founders: [
        {
          name: "Julian Chen",
          role: "Founder",
          bio: "Former ML engineer at Google. Built the first AI coding assistant that understands React component context.",
        },
      ],
    },
  ];

  const renderMatchCard = (startup: typeof demoStartups[0], index: number) => {
    const isCenter = index === 1;
    const scale = isCenter ? 1 : 0.85; // Center card is full size, others are slightly smaller
    const zIndex = isCenter ? 10 : index === 0 ? 8 : 9;
    const opacity = isCenter ? 1 : 0.8;

    return (
      <div
        key={index}
        className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-gray-200 p-4 md:p-6 flex-shrink-0"
        style={{
          transform: `scale(${scale})`,
          zIndex,
          opacity,
          width: '100%',
          maxWidth: '420px',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          {/* Tabs */}
          <div className="flex gap-3">
            <button className="text-xs sm:text-sm font-medium text-gray-900 border-b-2 border-blue-500 pb-1">
              Company
            </button>
            <button className="text-xs sm:text-sm font-medium text-gray-600 border-b-2 border-transparent pb-1">
              Founders
            </button>
          </div>

          {/* Contact Founder Button */}
          <button className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:from-blue-400 hover:to-indigo-400 transition">
            <Sparkles className="w-3 h-3" />
            Contact Founder
          </button>
        </div>

        {/* Company Section - Logo, Name, Description, Match Score */}
        <div className="flex items-start gap-4 mb-4">
          {/* Logo - Placeholder with company initial */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 border-2 border-gray-200 flex items-center justify-center">
              <span className="text-gray-600 text-3xl md:text-4xl font-bold">
                {startup.name.charAt(0)}
              </span>
            </div>
          </div>

          {/* Name, Description, and Match Score */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900">
                {startup.name}
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-3xl px-2.5 py-1.5 shadow-sm min-w-[100px] flex items-center justify-center">
                <p className="text-sm md:text-base font-bold text-blue-500">
                  {startup.matchScore}%{" "}
                  <span className="text-xs font-normal text-gray-600">match</span>
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              {startup.description}
            </p>
            {/* Website Button */}
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 font-medium hover:bg-gray-100 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Website</span>
              </button>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200 my-4"></div>

        {/* Active Founders Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Active Founders</h4>
            <span className="text-xs text-gray-500">Select a founder</span>
          </div>

          <div className="space-y-2">
            {startup.founders.slice(0, 1).map((founder, founderIndex) => {
              const initial = founder.name.charAt(0);

              return (
                <div
                  key={founderIndex}
                  className={`bg-white rounded-xl shadow-sm border p-3 sm:p-4 transition-all ${
                    isCenter ? 'border-blue-500 border-2 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Founder Photo - Placeholder with initial */}
                    <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-gray-200 flex items-center justify-center">
                      <span className="text-gray-600 text-2xl md:text-3xl font-semibold">
                        {initial.toUpperCase()}
                      </span>
                    </div>

                    {/* Founder Info */}
                    <div className="flex-1 min-w-0">
                      <h5 className="text-base md:text-lg font-bold text-gray-900 mb-1">
                        {founder.name}
                      </h5>
                      <p className="text-xs text-gray-500 mb-2">{founder.role}</p>
                      <p className="text-xs md:text-sm text-gray-700 leading-relaxed line-clamp-2">
                        {founder.bio}
                      </p>
                    </div>

                    {/* Radio Button */}
                    <div className="flex-shrink-0 flex items-center">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex items-center justify-center">
                        {isCenter && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <ScrollAnimate direction="up" delay={0} threshold={0.2}>
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-tight text-gray-900 mb-4">
              See Your Matches in Action
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get detailed startup profiles with founder insights, match scores, and everything you need to craft the perfect outreach
            </p>
          </div>
        </ScrollAnimate>

        <ScrollAnimate direction="up" delay={150} threshold={0.2}>
          <div className="flex items-center justify-center min-h-[500px] md:min-h-[600px] py-12 overflow-x-hidden">
            {/* Layered Cards Container - Using flexbox for proper centering */}
            <div className="relative flex items-center justify-center" style={{ width: '100%', maxWidth: '1400px' }}>
              {demoStartups.map((startup, index) => {
                // Calculate positions relative to center
                // All cards positioned from true center point
                let translateX = '0px';
                
                if (index === 0) {
                  // Left card - offset to the left from center
                  translateX = '-240px';
                } else if (index === 2) {
                  // Right card - offset to the right from center
                  translateX = '240px';
                }
                
                return (
                  <div
                    key={index}
                    className="absolute"
                    style={{
                      left: '50%',
                      transform: `translateX(calc(-50% + ${translateX}))`,
                    }}
                  >
                    {renderMatchCard(startup, index)}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollAnimate>
      </div>
    </section>
  );
}

