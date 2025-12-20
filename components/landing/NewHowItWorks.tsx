"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

// Typing animation component for email preview
function TypingEmailPreview({ isActive }: { isActive: boolean }) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const emailText = `Hi Aman,

I'm reaching out because I was really impressed by the work you're doing at Novaflow...`;

  useEffect(() => {
    // Reset when step becomes active
    if (isActive) {
      setCurrentIndex(0);
      setDisplayedText("");
      
      // Clear any existing interval
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }

      // Start typing animation
      typingIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= emailText.length) {
            if (typingIntervalRef.current) {
              clearInterval(typingIntervalRef.current);
            }
            return prev;
          }
          return prev + 1;
        });
      }, 30); // Typing speed: 30ms per character
    } else {
      // Reset when step becomes inactive
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      setCurrentIndex(0);
      setDisplayedText("");
    }

    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, [isActive, emailText.length]);

  // Cursor blink effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    setDisplayedText(emailText.slice(0, currentIndex));
  }, [currentIndex, emailText]);

  return (
    <div className="w-full max-w-xs sm:max-w-sm md:max-w-md bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-700">
      {currentIndex === 0 ? (
        <div className="space-y-2">
          <div className="h-2 bg-gray-600 rounded w-1/3"></div>
          <div className="h-2 bg-gray-700 rounded w-full"></div>
          <div className="h-2 bg-gray-700 rounded w-5/6"></div>
          <div className="h-2 bg-gray-700 rounded w-4/5"></div>
        </div>
      ) : (
        <div className="text-[10px] sm:text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
          {displayedText}
          <span className={`inline-block w-0.5 h-3 sm:h-4 bg-green-500 ml-0.5 align-middle ${showCursor ? 'opacity-100' : 'opacity-0'}`}></span>
        </div>
      )}
    </div>
  );
}

interface Step {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface StartupLogo {
  id: string;
  name: string;
  company_logo?: string;
}

export function NewHowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [matchingLogos, setMatchingLogos] = useState<StartupLogo[]>([]);

  // Fetch startup logos for AI Matching preview
  useEffect(() => {
    async function fetchLogos() {
      try {
        const response = await fetch("/api/startups/logos");
        if (response.ok) {
          const data = await response.json();
          // Take just 6 random logos for the preview
          const shuffled = (data.startups || []).sort(() => 0.5 - Math.random());
          setMatchingLogos(shuffled.slice(0, 6));
        }
      } catch (err) {
        console.error("Error fetching logos for matching preview:", err);
      }
    }
    fetchLogos();
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
      title: "Intelligent Matching",
      description:
        "Our AI scans 2000+ YC startups to find perfect matches based on your background, their hiring needs, and company culture fit.",
      icon: (
        <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      number: "03",
      title: "Personalize Email",
      description:
        "We craft highly personalized outreach emails using real founder data, company insights, and your specific qualifications.",
      icon: (
        <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
      
      // The scrollable distance is the height minus one viewport (since sticky container takes up 1 viewport)
      // This is how much we need to scroll to go through all steps
      const scrollableDistance = scrollableHeight - viewportHeight;
      
      if (scrollableDistance <= 0) {
        // If scrollable area is smaller than viewport, just show step 0
        if (activeStep !== 0) setActiveStep(0);
        return;
      }
      
      // Calculate progress: 
      // 0 when scrollable top reaches viewport top (step 0 starts)
      // 1 when scrollable bottom reaches viewport bottom (step 3 ends)
      const rawProgress = (viewportHeight - scrollableTop) / scrollableDistance;
      const scrollProgress = Math.max(0, Math.min(1, rawProgress));
      
      // Map scroll progress to step index with step 0 getting 45% of scroll distance
      // Step 0: 0 to 0.45 (45%), remaining 55% split among steps 1-3 (~18.33% each)
      // Step 1: 0.45 to 0.633, Step 2: 0.633 to 0.817, Step 3: 0.817 to 1.0
      let newActiveStep = 0;
      if (scrollProgress >= 0.45) {
        // After step 0, divide remaining 55% among 3 steps (~18.33% each)
        const remainingProgress = (scrollProgress - 0.45) / 0.55; // Normalize to 0-1 for remaining steps
        newActiveStep = 1 + Math.floor(remainingProgress * 3);
        newActiveStep = Math.min(newActiveStep, steps.length - 1);
      }
      
      // Clamp to valid step range
      newActiveStep = Math.max(0, Math.min(newActiveStep, steps.length - 1));
      
      if (newActiveStep !== activeStep) {
        setActiveStep(newActiveStep);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeStep, steps.length]);

  return (
    <section ref={sectionRef} className="relative bg-white">
      {/* Scroll-driven Content - Increased height for scroll distance */}
      <div ref={scrollableRef} className="relative pt-4 sm:pt-8" style={{ height: `${steps.length * 100}vh` }}>
        {/* Sticky Container */}
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
            {/* Mobile: Stack vertically, Desktop: Side by side */}
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-16 items-start h-full lg:h-auto pt-16 sm:pt-20 lg:pt-0">
              
              {/* Left Side - Step Navigation */}
              <div className="w-full lg:w-1/3 space-y-0.5 sm:space-y-1 flex-shrink-0">
                {steps.map((step, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveStep(index);
                      // Scroll to corresponding position
                      if (sectionRef.current) {
                        const sectionTop = sectionRef.current.offsetTop;
                        const stepHeight = sectionRef.current.offsetHeight / steps.length;
                        window.scrollTo({
                          top: sectionTop + stepHeight * index,
                          behavior: "smooth",
                        });
                      }
                    }}
                    className={`w-full text-left px-3 sm:px-4 py-2 sm:py-3 lg:py-4 rounded-lg sm:rounded-xl transition-all duration-500 group ${
                      activeStep === index
                        ? "bg-white shadow-lg border border-gray-200"
                        : "hover:bg-white/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                      <span
                        className={`text-xs sm:text-sm font-medium transition-colors duration-300 ${
                          activeStep === index ? "text-blue-500" : "text-gray-400"
                        }`}
                      >
                        {step.number}
                      </span>
                      <span
                        className={`text-sm sm:text-base lg:text-lg font-medium transition-colors duration-300 ${
                          activeStep === index ? "text-gray-900" : "text-gray-500"
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    
                    {/* Expanded description when active - hidden on mobile to save space */}
                    <div
                      className={`hidden sm:block overflow-hidden transition-all duration-500 ${
                        activeStep === index ? "max-h-32 mt-2 sm:mt-3 opacity-100" : "max-h-0 opacity-0"
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
                {/* Preview Container with dark theme like Framer */}
                <div className="relative w-full h-full min-h-[280px] sm:min-h-[350px] lg:min-h-[500px] rounded-xl sm:rounded-2xl bg-[#1a1a1a] border border-gray-800 overflow-hidden shadow-2xl">
                  {/* Window Controls */}
                  <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-800">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500/80"></div>
                  </div>

                  {/* Content Area */}
                  <div className="relative p-4 sm:p-6 lg:p-8 min-h-[240px] sm:min-h-[300px] lg:min-h-[450px]">
                    {/* Step 1: Connect Profile */}
                    <div
                      className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${
                        activeStep === 0
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
                        {/* Mock upload zone */}
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

                    {/* Step 2: Find Matches */}
                    <div
                      className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${
                        activeStep === 1
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-8 pointer-events-none"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                        <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white">
                          {steps[1].icon}
                        </div>
                        <div className="text-center px-2">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">AI Matching</h3>
                          <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                            Scanning 2000+ YC startups to find your perfect matches
                          </p>
                        </div>
                        {/* Startup logo cards - responsive grid */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-[180px] sm:max-w-xs lg:max-w-md mx-auto">
                          {matchingLogos.length > 0 ? (
                            matchingLogos.map((startup) => (
                              <div
                                key={startup.id}
                                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-md sm:rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/20 hover:border-purple-500/50 cursor-pointer"
                              >
                                {startup.company_logo ? (
                                  <Image
                                    src={startup.company_logo}
                                    alt={startup.name}
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                    title={startup.name}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const fallback = parent.querySelector('.logo-fallback') as HTMLElement;
                                        if (fallback) fallback.style.display = "flex";
                                      }
                                    }}
                                  />
                                ) : null}
                                <div className="logo-fallback w-full h-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center" style={{ display: startup.company_logo ? 'none' : 'flex' }}>
                                  <span className="text-gray-700 text-xs sm:text-sm font-semibold">
                                    {startup.name.split(' ')[0].charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            // Fallback placeholders while loading
                            [1, 2, 3, 4, 5, 6].map((i) => (
                              <div
                                key={i}
                                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-md sm:rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-purple-500/50"
                                style={{
                                  animation: `pulse 2s ease-in-out ${i * 0.2}s infinite`,
                                }}
                              >
                                <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 rounded-md bg-gray-700"></div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Personalize Email */}
                    <div
                      className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${
                        activeStep === 2
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-8 pointer-events-none"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                        <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
                          {steps[2].icon}
                        </div>
                        <div className="text-center px-2">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">Personalized Outreach</h3>
                          <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                            AI crafts unique emails using founder data and your background
                          </p>
                        </div>
                        {/* Animated typing email preview */}
                        <TypingEmailPreview isActive={activeStep === 2} />
                      </div>
                    </div>

                    {/* Step 4: Land Interview */}
                    <div
                      className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${
                        activeStep === 3
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
                              className={`w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 rounded sm:rounded-md lg:rounded-lg border flex items-center justify-center transition-all duration-300 ${
                                date === 15
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
                      className={`h-1 sm:h-1.5 rounded-full transition-all duration-500 ${
                        activeStep === index
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
