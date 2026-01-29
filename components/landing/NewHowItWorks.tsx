"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

interface Step {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface StartupWithFounders {
  id: string;
  name: string;
  founders_pfp: string[];
  founder_names: string[];
}

export function NewHowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const [foundersData, setFoundersData] = useState<StartupWithFounders[]>([]);

  // Fetch founder profile pictures for "Warm Introductions" preview
  useEffect(() => {
    async function fetchFounders() {
      try {
        const response = await fetch("/api/startups/founders-pfp");
        if (response.ok) {
          const data = await response.json();
          // Shuffle and take first 4 startups with founders
          const shuffled = (data.startups || []).sort(() => 0.5 - Math.random());
          setFoundersData(shuffled.slice(0, 4));
        }
      } catch (err) {
        console.error("Error fetching founder profile pictures:", err);
      }
    }
    fetchFounders();
  }, []);

  const steps: Step[] = [
    {
      number: "01",
      title: "Connect Profile",
      description:
        "Upload your resume and connect your LinkedIn. We analyze your experience, skills, and preferences to understand what makes you unique.",
      icon: (
        <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      number: "02",
      title: "Work Trial",
      description:
        "Complete a 20-minute tailored engineering mission. It's designed to mirror real startup work—full-stack implementation, debugging, and tradeoffs—evaluating you on how you think",
      icon: (
        <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      number: "03",
      title: "Get Introduced to Founders",
      description:
        "We introduce you directly to founders and companies that are actively hiring. No more cold applications—get warm intros to decision makers at top startups.",
      icon: (
        <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      number: "04",
      title: "Land Interview",
      description:
        "Sit back while your AI agent sends emails, tracks responses, and follows up. Get interview invitations while you sleep.",
      icon: (
        <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current || !scrollableRef.current) return;

      const scrollableRect = scrollableRef.current.getBoundingClientRect();
      const scrollableTop = scrollableRect.top;
      const scrollableHeight = scrollableRect.height;
      const viewportHeight = window.innerHeight;

      // The scrollable distance is the height minus one viewport
      const scrollableDistance = scrollableHeight - viewportHeight;

      if (scrollableDistance <= 0) {
        if (activeStep !== 0) setActiveStep(0);
        return;
      }

      const rawProgress = (viewportHeight - scrollableTop) / scrollableDistance;
      const scrollProgress = Math.max(0, Math.min(1, rawProgress));

      let newActiveStep = 0;
      // Adjust distribution for 4 steps
      // Step 0: 0.35, remaining 0.65 split among 3 steps (~0.216 each)
      if (scrollProgress >= 0.35) {
        const remainingProgress = (scrollProgress - 0.35) / 0.65;
        newActiveStep = 1 + Math.floor(remainingProgress * 3);
      }

      newActiveStep = Math.max(0, Math.min(newActiveStep, steps.length - 1));

      if (newActiveStep !== activeStep) {
        setActiveStep(newActiveStep);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeStep, steps.length]);

  return (
    <section ref={sectionRef} className="relative bg-white" id="how-it-works">
      {/* Scroll-driven Content */}
      <div ref={scrollableRef} className="relative pt-4 sm:pt-8" style={{ height: `${steps.length * 90}vh` }}>
        {/* Sticky Container */}
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-16 items-start h-full lg:h-auto pt-16 sm:pt-20 lg:pt-0">

              {/* Left Side - Step Navigation */}
              <div className="w-full lg:w-1/3 space-y-0.5 sm:space-y-1 flex-shrink-0">
                {steps.map((step, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveStep(index);
                      if (sectionRef.current) {
                        const sectionTop = sectionRef.current.offsetTop;
                        const stepHeight = sectionRef.current.offsetHeight / steps.length;
                        window.scrollTo({
                          top: sectionTop + stepHeight * index,
                          behavior: "smooth",
                        });
                      }
                    }}
                    className={`w-full text-left px-3 sm:px-4 py-2 sm:py-3 lg:py-4 rounded-lg sm:rounded-xl transition-all duration-500 group ${activeStep === index
                      ? "bg-white shadow-lg border border-gray-200"
                      : "hover:bg-white/50"
                      }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                      <span
                        className={`text-xs sm:text-sm font-medium transition-colors duration-300 ${activeStep === index ? "text-blue-500" : "text-gray-400"
                          }`}
                      >
                        {step.number}
                      </span>
                      <span
                        className={`text-sm sm:text-base lg:text-lg font-medium transition-colors duration-300 ${activeStep === index ? "text-gray-900" : "text-gray-500"
                          }`}
                      >
                        {step.title}
                      </span>
                    </div>

                    <div
                      className={`hidden sm:block overflow-hidden transition-all duration-500 ${activeStep === index ? "max-h-32 mt-2 sm:mt-3 opacity-100" : "max-h-0 opacity-0"
                        }`}
                    >
                      <p className="text-gray-600 text-xs sm:text-sm leading-relaxed pl-6 sm:pl-8 lg:pl-10">
                        {step.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Right Side - Visual Preview */}
              <div className="w-full lg:w-2/3 relative flex-1 min-h-0">
                <div className="relative w-full h-full min-h-[280px] sm:min-h-[350px] lg:min-h-[500px] rounded-xl sm:rounded-2xl bg-[#1a1a1a] border border-gray-800 overflow-hidden shadow-2xl">
                  {/* Window Controls */}
                  <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-800">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500/80"></div>
                  </div>

                  <div className="relative p-4 sm:p-6 lg:p-8 min-h-[240px] sm:min-h-[300px] lg:min-h-[450px]">
                    {/* Step 1: Connect Profile */}
                    <div
                      className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${activeStep === 0
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-8 pointer-events-none"
                        }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                        <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                          {steps[0].icon}
                        </div>
                        <div className="text-center px-2">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">Upload Resume</h3>
                          <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                            Drop your resume and let our AI extract your skills, experience, and preferences
                          </p>
                        </div>
                        <div className="w-full max-w-[200px] sm:max-w-xs lg:max-w-md border-2 border-dashed border-gray-600 rounded-lg sm:rounded-xl p-4 sm:p-6 lg:p-8 text-center hover:border-blue-500 transition-colors mx-auto">
                          <div className="text-gray-500">
                            <svg className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 mx-auto mb-2 sm:mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="text-xs sm:text-sm text-gray-500">resume.pdf</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Verify Skill Level */}
                    <div
                      className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${activeStep === 1
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-8 pointer-events-none"
                        }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                        <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white">
                          {steps[1].icon}
                        </div>
                        <div className="text-center px-2">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">Assessment Mode</h3>
                          <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                            Real-world engineering missions in a live environment
                          </p>
                        </div>
                        {/* Assessment Visual */}
                        <div className="w-full max-w-[200px] sm:max-w-xs lg:max-w-md bg-gray-900 rounded-lg sm:rounded-xl border border-gray-700 p-3 sm:p-4 font-mono text-xs">
                          <div className="flex items-center gap-2 mb-2 border-b border-gray-800 pb-2">
                            <span className="text-green-400">●</span>
                            <span className="text-gray-400">mission_01.ts</span>
                          </div>
                          <div className="space-y-1 text-gray-400">
                            <div className="flex"><span className="text-purple-400 w-6">1</span><span className="text-blue-400">export</span> <span className="text-purple-400">async</span> <span className="text-blue-400">function</span> <span className="text-yellow-400">validateUser</span>() {'{'}</div>
                            <div className="flex"><span className="text-gray-600 w-6">2</span>  <span className="text-gray-500">// TODO: Implement validation logic</span></div>
                            <div className="flex"><span className="text-gray-600 w-6">3</span>  <span className="text-purple-400">const</span> user = <span className="text-purple-400">await</span> db.<span className="text-blue-300">find</span>(id);</div>
                            <div className="flex"><span className="text-gray-600 w-6">4</span>  <span className="text-blue-400">return</span> user.<span className="text-blue-300">isValid</span>();</div>
                            <div className="flex"><span className="text-gray-600 w-6">5</span>{'}'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Get Introduced to Founders */}
                    <div
                      className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${activeStep === 2
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-8 pointer-events-none"
                        }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                        <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
                          {steps[2].icon}
                        </div>
                        <div className="text-center px-2">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">Warm Introductions</h3>
                          <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                            Get introduced directly to founders at companies that are actively hiring
                          </p>
                        </div>
                        {/* Founder/Company cards preview */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-xs lg:max-w-md mx-auto">
                          {foundersData.length > 0 ? (
                            foundersData.map((startup, index) => {
                              const firstPfp = startup.founders_pfp?.[0];
                              const firstName = startup.founder_names?.[0] || startup.name;
                              const initial = firstName.charAt(0).toUpperCase();

                              return (
                                <div
                                  key={startup.id}
                                  className="bg-gray-800 border border-gray-700 rounded-lg p-3 sm:p-4 flex flex-col items-center space-y-2 hover:border-green-500/50 transition-all duration-300"
                                >
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center relative">
                                    {firstPfp ? (
                                      <Image
                                        src={`/api/image-proxy?url=${encodeURIComponent(firstPfp)}`}
                                        alt={firstName}
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover"
                                        unoptimized
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const fallback = target.parentElement?.querySelector('.pfp-fallback') as HTMLElement;
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div className="pfp-fallback absolute inset-0 flex items-center justify-center" style={{ display: firstPfp ? 'none' : 'flex' }}>
                                      <span className="text-white text-xs sm:text-sm font-semibold">{initial}</span>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-gray-300 text-[10px] sm:text-xs font-medium truncate w-full max-w-[80px]">
                                      {firstName.split(' ')[0]}
                                    </div>
                                    <div className="text-gray-500 text-[9px] sm:text-[10px]">
                                      {startup.name.split(' ')[0]}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            // Fallback placeholders while loading
                            [1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className="bg-gray-800 border border-gray-700 rounded-lg p-3 sm:p-4 flex flex-col items-center space-y-2"
                              >
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                                  <div className="w-full h-full bg-gray-700 rounded-full animate-pulse"></div>
                                </div>
                                <div className="text-center">
                                  <div className="text-gray-500 text-[10px] sm:text-xs font-medium h-3 w-12 bg-gray-700 rounded animate-pulse"></div>
                                  <div className="text-gray-600 text-[9px] sm:text-[10px] h-2 w-10 bg-gray-700 rounded animate-pulse mt-1"></div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 4: Land Interview */}
                    <div
                      className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${activeStep === 3
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-8 pointer-events-none"
                        }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                        <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
                          {steps[3].icon}
                        </div>
                        <div className="text-center px-2">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">Interview Secured</h3>
                          <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                            Set the date on your calendar and let the AI handle the rest.
                          </p>
                        </div>
                        {/* Mini Calendar - Block Style - responsive */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2 lg:gap-3 max-w-[180px] sm:max-w-xs lg:max-w-md mx-auto">
                          {[12, 13, 14, 15, 16, 17, 18].map((date) => (
                            <div
                              key={date}
                              className={`w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 rounded sm:rounded-md lg:rounded-lg border flex items-center justify-center transition-all duration-300 ${date === 15
                                ? 'bg-green-500 border-green-500 text-white font-semibold shadow-lg shadow-green-500/50 hover:-translate-y-1'
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-600'
                                }`}
                            >
                              <span className="text-[10px] sm:text-xs lg:text-sm">{date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step Progress Indicator */}
                <div className="absolute -bottom-6 sm:-bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 sm:gap-2">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1 sm:h-1.5 rounded-full transition-all duration-500 ${activeStep === index
                        ? "w-6 sm:w-8 bg-blue-500"
                        : "w-1.5 sm:w-2 bg-gray-300"
                        }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Padding */}
      <div className="h-16 sm:h-24 bg-white"></div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
