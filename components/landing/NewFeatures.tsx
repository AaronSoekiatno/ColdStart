"use client";

import { Sparkles, Bot, Zap } from "lucide-react";
import { ScrollAnimate } from "@/components/shared/ScrollAnimate";

export function NewFeatures() {
  const features = [
    {
      icon: Sparkles,
      label: "Feature",
      title: "Intelligent Matching",
      description:
        "Advanced AI analyzes your skills, experience, and preferences to find perfect startup matches from our database of 2000+ YC companies.",
    },
    {
      icon: Bot,
      label: "Feature",
      title: "Hyper-Personalized Outreach",
      description:
        "Each email is custom-crafted using real company data, founder backgrounds, and your unique qualifications. No templates, no generic messages.",
    },
    {
      icon: Zap,
      label: "Feature",
      title: "Lightning Fast",
      description:
        "What takes 50+ hours of manual research and writing happens in 5 minutes. Apply to hundreds of startups while others are still on their first email.",
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <ScrollAnimate
                key={index}
                direction="up"
                delay={index * 100}
                threshold={0.2}
                rootMargin="0px"
              >
                <div className="space-y-4 bg-white rounded-2xl p-8 shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-300">
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Icon className="w-4 h-4" />
                    <span>{feature.label}</span>
                  </div>
                  <h3 className="text-2xl font-medium text-gray-900">{feature.title}</h3>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </ScrollAnimate>
            );
          })}
        </div>
      </div>
    </section>
  );
}
