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
        question: "How is this different from HackerRank, CodeSignal, etc.?",
        answer: (
            <div className="space-y-3 text-sm">
                <p>Those tools help you administer assessments.</p>
                <p className="font-bold text-gray-900">We deliver outcomes.</p>
                <p>You don’t:</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    <li>Design a test</li>
                    <li>Review raw submissions</li>
                    <li>Interpret abstract scores</li>
                </ul>
                <p>You get a short list of candidates who’ve already passed a production-grade bar.</p>
            </div>
        ),
    },
    {
        question: "What exactly are you evaluating?",
        answer: (
            <div className="space-y-3 text-sm">
                <p>We focus on five core dimensions:</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    <li>Problem decomposition</li>
                    <li>Practical code quality</li>
                    <li>Product intuition</li>
                    <li>Debugging and iteration</li>
                    <li>Follow-through and communication</li>
                </ul>
                <p>This maps directly to how junior engineers succeed or fail on real teams.</p>
            </div>
        ),
    },
    {
        question: "Can candidates cheat or use AI?",
        answer: (
            <div className="space-y-3 text-sm">
                <p className="font-semibold text-gray-900">Candidates are allowed to use AI.</p>
                <p>That’s intentional.</p>
                <p>We measure:</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    <li>How they integrate AI into their workflow</li>
                    <li>Whether they catch and correct mistakes</li>
                    <li>Whether they understand what they’re shipping</li>
                </ul>
                <p>This gives a stronger signal than banning tools.</p>
            </div>
        ),
    },
];

export function CompaniesFAQ() {
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
                                Common questions about hiring through our network.
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
