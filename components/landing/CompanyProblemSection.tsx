"use client";

import { ScrollAnimate } from "@/components/shared/ScrollAnimate";

export function CompanyProblemSection() {
  const problems = [
    {
      title: "Endless Resume Review",
      description:
        "You spend hours reviewing resumes that don't match. Technical skills look great on paper but fail in practice. That's weeks of your time wasted.",
    },
    {
      title: "Resume Claims vs Reality",
      description:
        "Candidates list skills they don't actually have. You only discover this after interviews, wasting everyone's time.",
    },
    {
      title: "Finding Culture Fit",
      description:
        "Technical skills are easy to assess, but startup culture fit? You're flying blind until they're already hired.",
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
          {problems.map((problem, index) => (
            <ScrollAnimate
              key={index}
              direction="up"
              delay={index * 100}
              threshold={0.2}
              rootMargin="0px"
            >
              <div className="space-y-4 bg-white/15 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-xl transition-all duration-300 ease-in-out hover:-translate-y-2 hover:shadow-2xl">
                <h3 className="text-2xl font-medium text-gray-800">{problem.title}</h3>
                <p className="text-lg text-gray-700 leading-relaxed">
                  {problem.description}
                </p>
              </div>
            </ScrollAnimate>
          ))}
        </div>
      </div>
    </section>
  );
}

