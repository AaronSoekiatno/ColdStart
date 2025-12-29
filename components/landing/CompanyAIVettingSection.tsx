"use client";

import { ScrollAnimate } from "@/components/shared/ScrollAnimate";
import { Code, Zap, Users, Target } from "lucide-react";

export function CompanyAIVettingSection() {
  const steps = [
    {
      number: "01",
      title: "GitHub Deep Dive",
      description: "We analyze every candidate's GitHub. AI reviews actual code (not just resume claims). Evaluates: quality, architecture, tests, documentation.",
      icon: Code,
      color: "from-blue-500 to-blue-600",
    },
    {
      number: "02",
      title: "Shipping Velocity Analysis",
      description: "How fast do they ship? Do they finish projects? Do they maintain code? We measure real productivity signals.",
      icon: Zap,
      color: "from-purple-500 to-purple-600",
    },
    {
      number: "03",
      title: "Culture Fit Assessment",
      description: "Startup experience signals. Self-directed work patterns. Communication quality. We identify candidates who thrive in fast-paced environments.",
      icon: Users,
      color: "from-green-500 to-green-600",
    },
    {
      number: "04",
      title: "Match Scoring",
      description: "AI compares to your specific role. Generates detailed report. Explains reasoning transparently. Every candidate comes with clear justification.",
      icon: Target,
      color: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <section className="py-24 px-6 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <ScrollAnimate direction="up" delay={0} threshold={0.2}>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight leading-tight text-gray-900 mb-4">
              How Our AI Vetting Works
            </h2>
          </ScrollAnimate>
          <ScrollAnimate direction="up" delay={150} threshold={0.2}>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
              We go beyond resumes. Our AI analyzes actual code, productivity patterns, and culture fit to find candidates who will truly excel at your startup.
            </p>
          </ScrollAnimate>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <ScrollAnimate
                key={index}
                direction="up"
                delay={index * 100}
                threshold={0.2}
              >
                <div className="relative bg-white rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-1">
                  {/* Step Number Badge */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-lg`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 block mb-1">
                        Step {step.number}
                      </span>
                      <h3 className="text-2xl font-semibold text-gray-900">
                        {step.title}
                      </h3>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-lg text-gray-600 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Decorative Arrow (on desktop, between steps) */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute -bottom-4 -right-4 w-8 h-8 text-gray-300">
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        className="w-full h-full transform rotate-45"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </ScrollAnimate>
            );
          })}
        </div>

        {/* Bottom CTA for Companies */}
        <ScrollAnimate direction="up" delay={400} threshold={0.2}>
          <div className="mt-16 text-center">
            <div className="inline-block bg-blue-50 rounded-2xl p-8 md:p-12 border border-blue-100 max-w-3xl">
              <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
                Ready to Hire Better Candidates?
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                Get access to pre-vetted candidates matched to your specific role requirements.
              </p>
              <a
                href="mailto:aidan.nt76@gmail.com?subject=Company%20Partnership%20Inquiry"
                className="inline-block px-8 py-4 bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </ScrollAnimate>
      </div>
    </section>
  );
}

