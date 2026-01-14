"use client";

import { ScrollAnimate } from "@/components/shared/ScrollAnimate";

export function AIAgentSection() {
  return (
    <section className="pt-40 pb-6 px-6">
      <div className="max-w-6xl mx-auto text-center space-y-6">
        <ScrollAnimate direction="up" delay={0} threshold={0.2}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-gray-600">
            Meet Your AI Networking Agent
          </h2>
        </ScrollAnimate>
        <ScrollAnimate direction="up" delay={150} threshold={0.2}>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
            Hermes works 24/7 to connect you with startup founders.
            Personalized. Professional. Proven.
          </p>
        </ScrollAnimate>
      </div>
    </section>
  );
}
