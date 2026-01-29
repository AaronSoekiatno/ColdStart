"use client";

import { Check, Info } from "lucide-react";
import { ScrollAnimate } from "@/components/shared/ScrollAnimate";

interface CompanyPricingProps {
    onGetStarted?: () => void;
}

export function CompanyPricing({ onGetStarted }: CompanyPricingProps) {
    const tiers = [
        {
            name: "Explorer",
            price: "Free",
            description: "For curious founders exploring the talent pool.",
            whoItIsFor: "Curious founders",
            features: [
                "Browse anonymized candidate profiles",
                "See assessment summaries",
                "No friction to try",
            ],
            notIncluded: [
                "No warm introductions",
                "No direct founder-to-candidate connection",
            ],
            purpose: "Build trust and explore",
            highlight: false,
            style: "minimal"
        },
        {
            name: "Active Hiring",
            price: "Success Fee Only",
            description: "Direct connection to the top 1% of engineering talent.",
            whoItIsFor: "Early-stage founders hiring now",
            features: [
                "Request warm intros",
                "Direct founder-to-candidate connection",
                "Access to assessment artifacts",
                "Pay only on hire",
            ],
            purpose: "Default tier for active teams",
            highlight: true,
            badge: "Recommended",
            style: "premium"
        },
        {
            name: "Enterprise",
            price: "Custom",
            description: "Built for high-volume hiring and custom requirements.",
            whoItIsFor: "Post-Series A startups",
            features: [
                "Dedicated account manager",
                "Custom sourcing pipelines",
                "Priority support & SLAs",
                "Private talent matching",
            ],
            purpose: "Scale your engineering team",
            highlight: false,
            style: "minimal"
        },
    ];

    return (
        <section className="py-24 px-6 bg-white relative overflow-hidden border-t border-gray-100" id="pricing">
            <div className="max-w-4xl mx-auto relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                        Pricing
                    </h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Choose the plan that fits your current hiring velocity.
                    </p>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                    {tiers.map((tier, index) => (
                        <div
                            key={index}
                            className={`h-full flex flex-col rounded-2xl p-6 transition-all duration-500 border relative ${tier.style === "premium"
                                ? "bg-white text-gray-900 border-blue-500 shadow-2xl shadow-blue-500/10 scale-105 z-10"
                                : "bg-white text-gray-900 border-gray-100 hover:border-gray-200 shadow-sm"
                                }`}
                        >
                            {/* ... Content ... */}
                            {tier.badge && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-lg z-20">
                                    <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                                        {tier.badge}
                                    </span>
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-xl font-semibold mb-1 text-gray-900">
                                    {tier.name}
                                </h3>
                                <div className="flex items-baseline gap-1 mb-3">
                                    <span className={`text-2xl font-bold ${tier.style === "premium" ? "text-blue-600" : "text-gray-900"}`}>
                                        {tier.price}
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed text-gray-500">
                                    {tier.description}
                                </p>
                            </div>

                            <div className="space-y-4 mb-8 flex-grow">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-gray-400">
                                        Who it's for
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">{tier.whoItIsFor}</p>
                                </div>

                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-gray-400">
                                        Features
                                    </div>
                                    <ul className="space-y-2.5">
                                        {tier.features.map((feature, fIndex) => (
                                            <li key={fIndex} className="flex gap-2.5 text-xs">
                                                <Check className={`w-4 h-4 flex-shrink-0 ${tier.style === "premium" ? "text-blue-600" : "text-gray-400"}`} />
                                                <span className="text-gray-600">{feature}</span>
                                            </li>
                                        ))}
                                        {tier.notIncluded?.map((feature, fnIndex) => (
                                            <li key={fnIndex} className="flex gap-2.5 text-xs opacity-30">
                                                <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                                                    <div className="w-1.5 h-[1px] bg-current" />
                                                </div>
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="mb-8">
                                <button
                                    onClick={() => onGetStarted ? onGetStarted() : window.location.href = 'mailto:aidan.nt76@gmail.com?subject=Company%20Partnership%20Inquiry'}
                                    className={`w-full py-2.5 rounded-full text-xs font-semibold transition-all duration-300 ${tier.style === "premium"
                                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
                                        : "bg-gray-900 text-white hover:bg-black"
                                        }`}
                                >
                                    {tier.name === "Enterprise" ? "Contact Support" : "Get Started"}
                                </button>
                            </div>

                            <div className={`mt-auto pt-4 border-t ${tier.style === "premium" ? "border-blue-50" : "border-gray-50"}`}>
                                <div className="flex items-center gap-2 text-[10px] opacity-60 text-gray-500">
                                    <Info className="w-3 h-3 text-blue-500" />
                                    <span>{tier.purpose}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>

    );
}
