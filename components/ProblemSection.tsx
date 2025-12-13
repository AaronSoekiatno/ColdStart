"use client";

export function ProblemSection() {
  const problems = [
    {
      title: "Endless Hours Wasted",
      description:
        "Students spend 30+ minutes per company on research, writing emails, and get ghosted. That's 50+ hours for 100 applications.",
    },
    {
      title: "Generic Gets Ignored",
      description:
        '"Dear Hiring Manager" emails go to spam. 98% of cold applications never get a response.',
    },
    {
      title: "Opportunity Anxiety",
      description:
        "While you apply to one, the perfect role at another gets filled. FOMO is real.",
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
          {problems.map((problem, index) => (
            <div key={index} className="space-y-4 bg-white/15 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-xl">
              <h3 className="text-2xl font-medium text-gray-800">{problem.title}</h3>
              <p className="text-lg text-gray-700 leading-relaxed">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
