"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

interface FAQItem {
    question: string;
    answer: React.ReactNode;
}

const faqs: FAQItem[] = [
    {
        question: "How much does it cost?",
        answer: (
            <div className="space-y-3 text-sm">
                <p className="font-bold text-gray-900">It is completely free for candidates.</p>
                <p>We charge companies to hire top talent, not candidates to find jobs.</p>
            </div>
        ),
    },
    {
        question: "Who is this for?",
        answer: (
            <div className="space-y-3 text-sm">
                <p className="font-semibold text-gray-900">Junior full-stack engineers who can actually build.</p>
                <p>This is a good fit if you:</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    <li>Enjoy shipping real features</li>
                    <li>Are comfortable working across frontend + backend</li>
                    <li>Want to be evaluated on how you think, not just what’s on your resume</li>
                    <li>Are interested in startups or small, fast-moving teams</li>
                </ul>
                <p className="text-gray-500 italic text-xs mt-2">If you’re looking for mass applications or guaranteed interviews, this probably isn’t for you.</p>
            </div>
        ),
    },
    {
        question: "How do I join?",
        answer: (
            <div className="space-y-3 text-sm">
                <p>You complete a single engineering mission.</p>
                <p>It’s designed to resemble real startup work:</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    <li>Full-stack implementation</li>
                    <li>Debugging and iteration</li>
                    <li>Tradeoffs and edge cases</li>
                    <li>AI tools are allowed and encouraged</li>
                </ul>
                <p>We evaluate your approach and decision-making, not just whether tests pass.</p>
            </div>
        ),
    },
    {
        question: "What happens if I don’t pass?",
        answer: (
            <div className="space-y-3 text-sm">
                <p className="font-bold">Nothing negative.</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    <li>Your work isn’t shared with companies.</li>
                    <li>You can reattempt after a cooldown period if you’d like.</li>
                </ul>
                <p>This is about maintaining a high bar, not gatekeeping people permanently.</p>
            </div>
        ),
    },
];

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="py-24 px-6 bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
                    {/* Left Column - Sticky Header */}
                    <div className="lg:col-span-5 pl-8">
                        <div className="sticky top-24">
                            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-6">
                                Frequently Asked Questions
                            </h2>
                            <p className="text-xl text-gray-500 max-w-sm">
                                Get answers to commonly asked questions about joining our network.
                            </p>
                        </div>
                    </div>

                    {/* Right Column - Accordion Items */}
                    <div className="lg:col-span-7 space-y-4">
                        {faqs.map((faq, index) => {
                            const isOpen = openIndex === index;

                            return (
                                <motion.div
                                    key={index}
                                    initial={false}
                                    animate={{
                                        backgroundColor: isOpen ? "#ffffff" : "#ffffff", // Keeping white for consistency
                                    }}
                                    className={`border rounded-3xl overflow-hidden transition-all duration-300 ${isOpen
                                        ? "border-gray-200 shadow-lg ring-1 ring-black/5"
                                        : "border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200 hover:shadow-md"
                                        }`}
                                >
                                    <button
                                        onClick={() => setOpenIndex(isOpen ? null : index)}
                                        className="w-full flex items-center justify-between p-6 md:p-8 text-left focus:outline-none group"
                                    >
                                        <span className="text-lg md:text-xl font-medium text-gray-900 pr-8">
                                            {faq.question}
                                        </span>
                                        <span className="flex-shrink-0 relative w-6 h-6 flex items-center justify-center">
                                            <motion.div
                                                animate={{ rotate: isOpen ? 45 : 0 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <Plus className={`w-6 h-6 transition-colors duration-200 ${isOpen ? "text-gray-900" : "text-gray-400 group-hover:text-gray-600"}`} />
                                            </motion.div>
                                        </span>
                                    </button>

                                    <AnimatePresence initial={false}>
                                        {isOpen && (
                                            <motion.div
                                                key="content"
                                                initial="collapsed"
                                                animate="open"
                                                exit="collapsed"
                                                variants={{
                                                    open: { opacity: 1, height: "auto" },
                                                    collapsed: { opacity: 0, height: 0 }
                                                }}
                                                transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                                            >
                                                <div className="px-6 md:px-8 pb-8 pt-0">
                                                    <div className="border-t border-gray-100 pt-6">
                                                        <div className="text-base text-gray-600 leading-relaxed max-w-2xl">
                                                            {faq.answer}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
