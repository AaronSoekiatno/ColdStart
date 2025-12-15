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

I'm reaching out because I saw Novaflow is revolutionizing bioinformatics for biology labs...`;

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
    <div className="w-full max-w-md bg-gray-800 rounded-xl p-4 border border-gray-700">
      {currentIndex === 0 ? (
        <div className="space-y-2">
          <div className="h-2 bg-gray-600 rounded w-1/3"></div>
          <div className="h-2 bg-gray-700 rounded w-full"></div>
          <div className="h-2 bg-gray-700 rounded w-5/6"></div>
          <div className="h-2 bg-gray-700 rounded w-4/5"></div>
        </div>
      ) : (
        <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
          {displayedText}
          <span className={`inline-block w-0.5 h-4 bg-green-500 ml-0.5 align-middle ${showCursor ? 'opacity-100' : 'opacity-0'}`}></span>
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

export function NewHowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const steps: Step[] = [
    {
      number: "01",
      title: "Connect Profile",
      description:
        "Upload your resume and connect your LinkedIn. We analyze your experience, skills, and preferences to understand what makes you unique.",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const sectionRect = sectionRef.current.getBoundingClientRect();
      const sectionTop = sectionRect.top;
      const sectionHeight = sectionRect.height;
      const viewportHeight = window.innerHeight;
      
      // Calculate scroll progress through the section
      // Start tracking when section enters viewport
      const scrollProgress = Math.max(0, (viewportHeight - sectionTop) / (sectionHeight));
      
      // Map scroll progress to step index
      const stepProgress = scrollProgress * steps.length;
      const newActiveStep = Math.min(Math.floor(stepProgress), steps.length - 1);
      
      if (newActiveStep >= 0 && newActiveStep !== activeStep) {
        setActiveStep(newActiveStep);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeStep, steps.length]);

  return (
    <section ref={sectionRef} className="relative bg-white">
      {/* Section Header */}
      <div className="pt-24 pb-12 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-tight text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            From upload to interview in four simple steps
          </p>
        </div>
      </div>

      {/* Scroll-driven Content - Increased height for scroll distance */}
      <div className="relative" style={{ height: `${steps.length * 100}vh` }}>
        {/* Sticky Container */}
        <div className="sticky top-0 h-screen flex items-center">
          <div className="w-full max-w-6xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start">
              
              {/* Left Side - Step Navigation */}
              <div className="lg:w-1/3 space-y-1">
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
                    className={`w-full text-left px-4 py-4 rounded-xl transition-all duration-500 group ${
                      activeStep === index
                        ? "bg-white shadow-lg border border-gray-200"
                        : "hover:bg-white/50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-sm font-medium transition-colors duration-300 ${
                          activeStep === index ? "text-blue-500" : "text-gray-400"
                        }`}
                      >
                {step.number}
                      </span>
                      <span
                        className={`text-lg font-medium transition-colors duration-300 ${
                          activeStep === index ? "text-gray-900" : "text-gray-500"
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    
                    {/* Expanded description when active */}
                    <div
                      className={`overflow-hidden transition-all duration-500 ${
                        activeStep === index ? "max-h-32 mt-3 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <p className="text-gray-600 text-sm leading-relaxed pl-10">
                        {step.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Right Side - Visual Preview */}
              <div className="lg:w-2/3 relative min-h-[400px] lg:min-h-[500px]">
                {/* Preview Container with dark theme like Framer */}
                <div className="relative w-full h-full rounded-2xl bg-[#1a1a1a] border border-gray-800 overflow-hidden shadow-2xl">
                  {/* Window Controls */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>

                  {/* Content Area */}
                  <div className="relative p-8 min-h-[350px] lg:min-h-[450px]">
                    {/* Step 1: Connect Profile */}
                    <div
                      className={`absolute inset-8 transition-all duration-700 ${
                        activeStep === 0
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-8 pointer-events-none"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-6">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                          {steps[0].icon}
                        </div>
                        <div className="text-center">
                          <h3 className="text-2xl font-semibold text-white mb-2">Upload Resume</h3>
                          <p className="text-gray-400 max-w-sm">
                            Drop your resume and let our AI extract your skills, experience, and preferences
                          </p>
                        </div>
                        {/* Mock upload zone */}
                        <div className="w-full max-w-md border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
                          <div className="text-gray-500">
                            <svg className="w-10 h-10 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="text-sm text-gray-500">resume.pdf</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Find Matches */}
                    <div
                      className={`absolute inset-8 transition-all duration-700 ${
                        activeStep === 1
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-8 pointer-events-none"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-6">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white">
                          {steps[1].icon}
                        </div>
                        <div className="text-center">
                          <h3 className="text-2xl font-semibold text-white mb-2">AI Matching</h3>
                          <p className="text-gray-400 max-w-sm">
                            Scanning 2000+ YC startups to find your perfect matches
                          </p>
                        </div>
                        {/* Mock match cards */}
                        <div className="grid grid-cols-3 gap-3 max-w-md">
                          {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div
                              key={i}
                              className="w-16 h-16 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center"
                              style={{
                                animation: `pulse 2s ease-in-out ${i * 0.2}s infinite`,
                              }}
                            >
                              <div className="w-8 h-8 rounded-md bg-gray-700"></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Personalize Email */}
                    <div
                      className={`absolute inset-8 transition-all duration-700 ${
                        activeStep === 2
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-8 pointer-events-none"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-6">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
                          {steps[2].icon}
                        </div>
                        <div className="text-center">
                          <h3 className="text-2xl font-semibold text-white mb-2">Personalized Outreach</h3>
                          <p className="text-gray-400 max-w-sm">
                            AI crafts unique emails using founder data and your background
                          </p>
                        </div>
                        {/* Animated typing email preview */}
                        <TypingEmailPreview isActive={activeStep === 2} />
                      </div>
                    </div>

                    {/* Step 4: Land Interview */}
                    <div
                      className={`absolute inset-8 transition-all duration-700 ${
                        activeStep === 3
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-8 pointer-events-none"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full space-y-6">
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
                          {steps[3].icon}
                        </div>
                        <div className="text-center">
                          <h3 className="text-2xl font-semibold text-white mb-2">Interview Secured</h3>
                          <p className="text-gray-400 max-w-sm">
                            Watch the responses roll in while you focus on preparation
                          </p>
                        </div>
                        {/* Success indicator */}
                        <div className="flex items-center gap-4 px-6 py-4 bg-green-500/20 border border-green-500/30 rounded-xl">
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <p className="text-green-400 font-medium">Interview Invitation</p>
                            <p className="text-green-500/70 text-sm">Founder just replied!</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step Progress Indicator */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        activeStep === index
                          ? "w-8 bg-blue-500"
                          : "w-2 bg-gray-300"
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
      <div className="h-24 bg-white"></div>

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
