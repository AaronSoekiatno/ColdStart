"use client";

import { ScrollAnimate } from "@/components/ScrollAnimate";

export function FounderDataSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          <ScrollAnimate direction="up" delay={0} threshold={0.2}>
          <h2 className="text-4xl md:text-5xl font-normal tracking-tight leading-tight text-gray-900">
            Real Founder Data & Smart Follow-Ups
          </h2>
          </ScrollAnimate>
          <ScrollAnimate direction="up" delay={150} threshold={0.2}>
          <p className="text-xl text-gray-600 leading-relaxed">
            99 verified YC founders with real emails and LinkedIn. No scraped
            junk—actual decision makers. Automatically tracks responses for
            contextual follow-ups so no opportunity slips through.
          </p>
          </ScrollAnimate>
        </div>

        {/* Optional: Testimonial-style quote */}
        <ScrollAnimate direction="up" delay={300} threshold={0.2} className="mt-12">
          <div className="p-8 border border-gray-300 rounded-2xl bg-white shadow-md">
          <p className="text-lg text-gray-600 leading-relaxed italic">
            "I love turning complex problems into simple, beautiful, and
            user-friendly experiences. With a strong focus on UX/UI, I design
            products that not only look great but also feel effortless to use."
          </p>
        </div>
        </ScrollAnimate>
      </div>
    </section>
  );
}
