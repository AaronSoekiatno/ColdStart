"use client";

import Image from "next/image";
import { ExternalLink, Sparkles } from "lucide-react";
import { ScrollAnimate } from "@/components/ScrollAnimate";

export function DemoMatchCard() {
  // Demo data for three startups
  const demoStartups = [
    {
      name: "Keystone",
      description: "Your team's on-call AI engineer",
      batch: "Summer 2025",
      industry: "AI, Developer Tools",
      matchScore: 92,
      logoColor: "from-blue-500 to-cyan-600",
      logoLetter: "K",
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
      logoColor: "from-purple-500 to-indigo-600",
      logoLetter: "N",
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
      logoColor: "from-green-500 to-emerald-600",
      logoLetter: "S",
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
    const scale = isCenter ? 1 : 0.8; // Center card is full size, others are smaller
    const zIndex = isCenter ? 10 : index === 0 ? 8 : 9; // Center on top, then right, then left
    const opacity = isCenter ? 1 : 0.75; // Side cards slightly transparent
    
    return (
      <div
        key={index}
        className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 md:p-6 flex-shrink-0"
        style={{
          transform: `scale(${scale})`,
          zIndex,
          opacity,
          width: '100%',
          maxWidth: '380px',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-4 border-b border-gray-200">
          {/* Tabs */}
          <div className="flex gap-3">
            <button className="text-xs font-medium text-gray-900 border-b-2 border-blue-500 pb-1">
              Company
            </button>
            <button className="text-xs font-medium text-gray-600 border-b-2 border-transparent pb-1">
              Founders
            </button>
          </div>
          
          {/* Generate Email Button */}
          <button className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
            <Sparkles className="w-3 h-3" />
            Generate Email
          </button>
        </div>

        {/* Company Section */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-4">
          {/* Match Score */}
          <div className="flex-shrink-0">
            <div className="bg-gray-50 border border-gray-200 rounded-3xl px-3 py-2 shadow-sm w-[110px] flex items-center justify-center">
              <p className="text-xl font-bold text-blue-500">
                {startup.matchScore}% <span className="text-sm font-normal text-gray-600">match</span>
              </p>
            </div>
          </div>

          {/* Industry and Batch badges */}
          <div className="flex flex-wrap gap-1.5">
            {startup.industry && (
              <span className="inline-block bg-blue-50 border border-blue-500 rounded-2xl px-2 py-0.5 text-xs text-gray-900 font-medium">
                {startup.industry}
              </span>
            )}
            {startup.batch && (
              <span className="inline-block bg-gray-50 border border-gray-300 rounded-2xl px-2 py-0.5 text-xs text-gray-900 font-medium">
                {startup.batch}
              </span>
            )}
          </div>
        </div>

        {/* Logo and Company Info */}
        <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 mb-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br ${startup.logoColor} flex items-center justify-center`}>
              <span className="text-white text-xl font-bold">{startup.logoLetter}</span>
            </div>
          </div>

          {/* Name, Description */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1">
              {startup.name}
            </h3>
            <p className="text-sm text-gray-600">
              {startup.description}
            </p>
          </div>
        </div>

        {/* Active Founders Section */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Active Founders</h4>
            <span className="text-xs text-gray-500">Select a founder</span>
          </div>

          <div className="space-y-2">
            {startup.founders.slice(0, 1).map((founder, founderIndex) => (
              <div
                key={founderIndex}
                className="bg-gray-50 rounded-lg p-3 border border-gray-200"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">
                      {founder.name.charAt(0)}
                    </span>
                  </div>

                  {/* Founder Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h5 className="font-semibold text-sm text-gray-900">{founder.name}</h5>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{founder.role}</p>
                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{founder.bio}</p>
                  </div>

                  {/* Radio Button */}
                  <div className="flex-shrink-0">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex items-center justify-center">
                      {isCenter && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-24 px-6 bg-gray-50">
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

