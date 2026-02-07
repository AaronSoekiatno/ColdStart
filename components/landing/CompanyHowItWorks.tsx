"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Check, UserPlus, Users, Zap, Code } from "lucide-react";

interface Step {
    number: string;
    title: string;
    description: string;
    icon: React.ReactNode;
}

export function CompanyHowItWorks() {
    const [activeStep, setActiveStep] = useState(0);
    const sectionRef = useRef<HTMLDivElement>(null);
    const scrollableRef = useRef<HTMLDivElement>(null);

    const steps: Step[] = [
        {
            number: "01",
            title: "Sync Your Roles",
            description:
                "Connect your ATS or paste a job description. We automatically generate a tailored engineering mission that tests for the exact skills you need.",
            icon: <Users className="w-6 h-6 sm:w-8 sm:h-8" />,
        },
        {
            number: "02",
            title: "GitHub Deep Dive",
            description:
                "We analyze every candidate's GitHub. AI reviews actual code (not just resume claims). Evaluates: quality, architecture, tests, documentation.",
            icon: <Code className="w-6 h-6 sm:w-8 sm:h-8" />,
        },
        {
            number: "03",
            title: "AI Vetting",
            description:
                "Candidates complete a real-world coding task. Our AI reviews usage of tools, debugging patterns, and implementation quality—filtering out the noise for you.",
            icon: <Zap className="w-6 h-6 sm:w-8 sm:h-8" />,
        },
        {
            number: "04",
            title: "Interview Top 1%",
            description:
                "Get a shortlist of pre-vetted candidates who have already proven they can do the job. Skip straight to the final round interviews.",
            icon: <UserPlus className="w-6 h-6 sm:w-8 sm:h-8" />,
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
            // Step 0: 0.35, remaining 0.65 split among 3 steps
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
                                            className={`hidden sm:block overflow-hidden transition-all duration-500 ${activeStep === index
                                                ? "max-h-32 mt-2 sm:mt-3 opacity-100"
                                                : "max-h-0 opacity-0"
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
                                        {/* Step 1: Sync Roles */}
                                        <div
                                            className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${activeStep === 0
                                                ? "opacity-100 translate-y-0"
                                                : "opacity-0 translate-y-8 pointer-events-none"
                                                }`}
                                        >
                                            <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                                                <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                                                    <Users className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                                </div>
                                                <div className="text-center px-2">
                                                    <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">
                                                        Integrate your ATS
                                                    </h3>
                                                    <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                                                        Connect Greenhouse, Lever, or Ashby with one click.
                                                    </p>
                                                </div>

                                                <div className="flex gap-4 items-center justify-center">
                                                    <div className="w-12 h-12 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center text-xs text-gray-400">ATS</div>
                                                    <div className="w-6 h-[1px] bg-gray-600"></div>
                                                    <div className="w-12 h-12 bg-blue-600/20 border border-blue-500 rounded-lg flex items-center justify-center text-blue-400">
                                                        <Check className="w-6 h-6" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 2: GitHub Deep Dive */}
                                        <div
                                            className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${activeStep === 1
                                                ? "opacity-100 translate-y-0"
                                                : "opacity-0 translate-y-8 pointer-events-none"
                                                }`}
                                        >
                                            <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                                                <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white">
                                                    <Code className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                                </div>
                                                <div className="text-center px-2">
                                                    <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">
                                                        Code Quality Analysis
                                                    </h3>
                                                    <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                                                        We analyze shipping velocity, code structure, and real engineering impact.
                                                    </p>
                                                </div>
                                                <div className="w-full max-w-[200px] sm:max-w-xs lg:max-w-md bg-gray-900 rounded-lg sm:rounded-xl border border-gray-700 p-3 sm:p-4 font-mono text-xs">
                                                    {/* Fake Repos */}
                                                    <div className="flex items-center gap-3 bg-gray-800 p-2 rounded mb-2 border border-gray-700">
                                                        <div className="w-6 h-6 bg-white/5 rounded flex items-center justify-center">
                                                            <Code className="text-gray-400 w-3 h-3" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-gray-200 text-xs truncate">ecommerce-v2</div>
                                                            <div className="text-gray-500 text-[10px]">TypeScript • 120 commits</div>
                                                        </div>
                                                        <div className="text-green-400 text-xs font-bold">A+</div>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-gray-800 p-2 rounded mb-2 border border-gray-700">
                                                        <div className="w-6 h-6 bg-white/5 rounded flex items-center justify-center">
                                                            <Code className="text-gray-400 w-3 h-3" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-gray-200 text-xs truncate">react-native-app</div>
                                                            <div className="text-gray-500 text-[10px]">Mobile • 85 commits</div>
                                                        </div>
                                                        <div className="text-green-400 text-xs font-bold">A</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 3: AI Vetting */}
                                        <div
                                            className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${activeStep === 2
                                                ? "opacity-100 translate-y-0"
                                                : "opacity-0 translate-y-8 pointer-events-none"
                                                }`}
                                        >
                                            <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                                                <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white">
                                                    <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                                </div>
                                                <div className="text-center px-2">
                                                    <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">
                                                        Automated Vetting
                                                    </h3>
                                                    <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                                                        Agencity grades their solution on scalability, performance, and best practices.
                                                    </p>
                                                </div>
                                                <div className="w-full max-w-[200px] sm:max-w-xs lg:max-w-md bg-gray-900 rounded-lg sm:rounded-xl border border-gray-700 p-3 sm:p-4 font-mono text-xs">
                                                    <div className="flex items-center gap-2 mb-2 border-b border-gray-800 pb-2">
                                                        <div className="flex-1 text-gray-400">Analysis Report</div>
                                                        <div className="text-green-400 font-bold">Passed</div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-gray-400"><span>Functionality</span> <span className="text-white">100%</span></div>
                                                        <div className="flex justify-between text-gray-400"><span>Code Quality</span> <span className="text-white">94%</span></div>
                                                        <div className="flex justify-between text-gray-400"><span>Performance</span> <span className="text-white">98%</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Step 4: Interview Top 1% */}
                                        <div
                                            className={`absolute inset-4 sm:inset-6 lg:inset-8 transition-all duration-700 ${activeStep === 3
                                                ? "opacity-100 translate-y-0"
                                                : "opacity-0 translate-y-8 pointer-events-none"
                                                }`}
                                        >
                                            <div className="flex flex-col items-center justify-center h-full space-y-3 sm:space-y-4 lg:space-y-6">
                                                <div className="w-14 h-14 sm:w-18 sm:h-18 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
                                                    <UserPlus className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                                </div>
                                                <div className="text-center px-2">
                                                    <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-1 sm:mb-2">
                                                        Ready for Interview
                                                    </h3>
                                                    <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                                                        Focus your time on the candidates who have already proven they can build.
                                                    </p>
                                                </div>

                                                {/* Top Candidate Card */}
                                                <div className="bg-gray-800 border-l-4 border-green-500 w-full max-w-sm rounded p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                                                        <div>
                                                            <div className="text-white font-medium text-sm">Alex Chen</div>
                                                            <div className="text-gray-400 text-xs">Senior Full-Stack</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-green-400 font-bold text-sm">98% Match</div>
                                                </div>
                                                <div className="bg-gray-800 border-l-4 border-green-500 w-full max-w-sm rounded p-4 flex items-center justify-between opacity-50 scale-95">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                                                        <div>
                                                            <div className="text-white font-medium text-sm">Sarah Jones</div>
                                                            <div className="text-gray-400 text-xs">Frontend Engineer</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-green-400 font-bold text-sm">95% Match</div>
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
        </section>
    );
}
