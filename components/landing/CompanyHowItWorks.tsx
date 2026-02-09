"use client";

import { motion } from "framer-motion";
import { MessageSquare, Search, ShieldCheck, UserCheck, Check, Globe, Github, Trophy, Users, GraduationCap, X, Linkedin, Twitter, FileText } from "lucide-react";

export function CompanyHowItWorks() {
    return (
        <section className="bg-white py-24 sm:py-32" id="how-it-works">
            <div className="mx-auto max-w-5xl px-6 lg:px-8">
                {/* Header */}
                <div className="mx-auto max-w-2xl text-center mb-16 sm:mb-24">
                    <h2 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl" style={{ fontFamily: 'Ivy Journal, serif' }}>
                        Meet Hermes...
                    </h2>
                    <p className="mt-4 text-3xl sm:text-4xl font-medium tracking-tight text-gray-900">
                        The AI Recruiter that lives in Slack.
                    </p>
                    <p className="mt-6 text-lg leading-8 text-gray-600">
                        We replaced the entire top-of-funnel with an agent that acts like your best technical sourcer—except it works 24/7.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
                    {/* Feature 1: Slack Integration */}
                    <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl bg-gray-50 border border-gray-200 p-8 sm:p-12">
                        <div className="flex flex-col lg:flex-row items-center gap-12">
                            <div className="lg:w-1/2 space-y-6">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-sm font-medium text-gray-900 shadow-sm">
                                    <MessageSquare className="h-4 w-4" /> <span>Step 1</span>
                                </div>
                                <h3 className="text-3xl font-bold tracking-tight text-gray-900">Tell us what you need</h3>
                                <p className="text-lg text-gray-600 leading-relaxed">
                                    Don't switch context. Just describe the role in your engineering Slack channel. We triage the request, draft technical requirements, and sync with your existing hiring workflows automatically.
                                </p>
                                <ul className="space-y-3 text-gray-600">
                                    <li className="flex gap-3">
                                        <Check className="h-6 w-5 flex-none text-gray-900" />
                                        <span>Start vague: "I need a prompt engineer."</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <Check className="h-6 w-5 flex-none text-gray-900" />
                                        <span>Hermes asks smart follow-up questions.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <Check className="h-6 w-5 flex-none text-gray-900" />
                                        <span>Syncs with Ashby/Greenhouse instantly.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="lg:w-1/2 w-full">
                                {/* Slack Visual */}
                                <div className="relative w-full rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden transform rotate-1 transition-transform hover:rotate-0 duration-500">
                                    <div className="bg-white p-3 border-b border-gray-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 font-bold">#</span>
                                            <span className="text-sm font-bold text-gray-900">engineering-hiring</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide hidden sm:inline-block">Connected to</span>
                                            <div className="flex -space-x-1.5 hover:space-x-0.5 transition-all">
                                                <div className="w-6 h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm z-20">
                                                    <img src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg" alt="Slack" className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="w-6 h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm z-10">
                                                    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBPEEg6Vq00fflRftF5kct7-zu7miuRgUMLA&s" alt="Ashby" className="w-3.5 h-3.5 object-contain" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-4 bg-white">
                                        <div className="flex gap-3 items-start">
                                            <div className="w-8 h-8 rounded bg-gray-200 flex-shrink-0 mt-1"></div>
                                            <div className="flex-1">
                                                <div className="flex items-baseline gap-2 mb-0.5">
                                                    <span className="font-bold text-sm text-gray-900">CTO</span>
                                                    <span className="text-[10px] text-gray-400">10:42 AM</span>
                                                </div>
                                                <div className="text-sm text-gray-800">
                                                    <span className="text-gray-900 font-medium">@Hermes</span> we need a prompt engineer for the new legal agent sprint.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 items-start">
                                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                                                <span className="text-gray-600 font-bold text-xs">H</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-baseline gap-2 mb-0.5">
                                                    <span className="font-bold text-sm text-gray-900">Hermes</span>
                                                    <span className="px-1.5 py-0.5 bg-gray-100 text-[9px] font-bold text-gray-500 rounded uppercase tracking-wide">APP</span>
                                                </div>
                                                <div className="text-sm text-gray-800">
                                                    On it! 🫡 Is this for the core platform or experimental branch? Also, looking for LangChain wizards or closer to raw CUDA optimization?
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Feature 2: Deep Search */}
                    <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 p-8 shadow-sm flex flex-col h-full">
                        <div className="mb-6">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-sm font-medium text-gray-900 shadow-sm mb-4">
                                <Search className="h-4 w-4" /> <span>Step 2</span>
                            </div>
                            <h3 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">We search deep</h3>
                            <p className="text-gray-600">
                                We go beyond the resume. We look at GitHub commits, technical research, Twitter signals, and deep university club involvement.
                            </p>
                        </div>

                        <div className="flex-1 relative min-h-[300px] flex items-center justify-center mt-4">
                            {/* Network Visual */}
                            <div className="relative w-full h-full flex items-center justify-center">
                                {/* Lines */}
                                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                    {/* University */}
                                    <motion.line x1="50%" y1="50%" x2="15%" y2="20%" stroke="#E5E7EB" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }} />
                                    {/* Code */}
                                    <motion.line x1="50%" y1="50%" x2="85%" y2="20%" stroke="#E5E7EB" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.2, repeat: Infinity, repeatDelay: 2 }} />
                                    {/* LinkedIn */}
                                    <motion.line x1="50%" y1="50%" x2="90%" y2="50%" stroke="#E5E7EB" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.4, repeat: Infinity, repeatDelay: 2 }} />
                                    {/* Referrals */}
                                    <motion.line x1="50%" y1="50%" x2="85%" y2="80%" stroke="#E5E7EB" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.6, repeat: Infinity, repeatDelay: 2 }} />
                                    {/* Hackathons */}
                                    <motion.line x1="50%" y1="50%" x2="15%" y2="80%" stroke="#E5E7EB" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.8, repeat: Infinity, repeatDelay: 2 }} />
                                    {/* Twitter */}
                                    <motion.line x1="50%" y1="50%" x2="10%" y2="50%" stroke="#E5E7EB" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 1.0, repeat: Infinity, repeatDelay: 2 }} />
                                    {/* Research */}
                                    <motion.line x1="50%" y1="50%" x2="50%" y2="10%" stroke="#E5E7EB" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 1.2, repeat: Infinity, repeatDelay: 2 }} />
                                </svg>

                                {/* Center PFP */}
                                <motion.div
                                    className="relative z-10 w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gray-100"
                                    animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    <img
                                        src="/images/Gemini_Generated_Image_ms7tmms7tmms7tmm.png"
                                        alt="Aidan Nguyen-Tran"
                                        className="w-full h-full object-cover"
                                    />
                                </motion.div>

                                {/* Orbiting Icons */}
                                <motion.div className="absolute left-[10%] top-[12%] flex flex-col items-center gap-1" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}>
                                    <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-lg text-gray-900"><GraduationCap className="w-4 h-4" /></div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">University</span>
                                </motion.div>

                                <motion.div className="absolute right-[10%] top-[12%] flex flex-col items-center gap-1" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, delay: 0.3, repeat: Infinity, ease: "easeInOut" }}>
                                    <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-lg text-gray-900"><Github className="w-4 h-4" /></div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Code</span>
                                </motion.div>

                                <motion.div className="absolute right-[2%] top-[45%] flex flex-col items-center gap-1" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, delay: 0.6, repeat: Infinity, ease: "easeInOut" }}>
                                    <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-lg text-gray-900"><Linkedin className="w-4 h-4" /></div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">LinkedIn</span>
                                </motion.div>

                                <motion.div className="absolute right-[10%] bottom-[12%] flex flex-col items-center gap-1" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, delay: 0.9, repeat: Infinity, ease: "easeInOut" }}>
                                    <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-lg text-gray-900"><Users className="w-4 h-4" /></div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Referrals</span>
                                </motion.div>

                                <motion.div className="absolute left-[10%] bottom-[12%] flex flex-col items-center gap-1" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, delay: 1.2, repeat: Infinity, ease: "easeInOut" }}>
                                    <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-lg text-gray-900"><Trophy className="w-4 h-4" /></div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Hackathons</span>
                                </motion.div>

                                <motion.div className="absolute left-[2%] top-[45%] flex flex-col items-center gap-1" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, delay: 1.5, repeat: Infinity, ease: "easeInOut" }}>
                                    <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-lg text-gray-900"><Twitter className="w-4 h-4" /></div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Twitter</span>
                                </motion.div>

                                <motion.div className="absolute top-[0%] left-[45%] flex flex-col items-center gap-1" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, delay: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                                    <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-lg text-gray-900"><FileText className="w-4 h-4" /></div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Research</span>
                                </motion.div>
                            </div>
                        </div>
                    </div>

                    {/* Feature 3: Truthful Insights */}
                    <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 p-8 shadow-sm">
                        <div className="mb-8">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-sm font-medium text-gray-900 shadow-sm mb-4">
                                <ShieldCheck className="h-4 w-4" /> <span>Step 3</span>
                            </div>
                            <h3 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">Truthful Insights</h3>
                            <p className="text-gray-600">
                                No fake match scores. We show Known Facts (verifiable), Observed Signals, and Unknowns you need to verify.
                            </p>
                        </div>
                        {/* Candidate Card */}
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transform transition-all hover:scale-[1.02] duration-300">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <img
                                        src="/images/Gemini_Generated_Image_ms7tmms7tmms7tmm.png"
                                        alt="Aidan Nguyen-Tran"
                                        className="w-10 h-10 rounded-full object-cover shadow-sm"
                                    />
                                    <div>
                                        <div className="font-semibold text-sm text-gray-900">Aidan Nguyen-Tran</div>
                                        <div className="text-xs text-gray-500">Candidate #4291</div>
                                    </div>
                                </div>
                                <div className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full uppercase tracking-wide">High Potential</div>
                            </div>
                            <div className="p-4 space-y-3">
                                <div>
                                    <h4 className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                        <Check className="w-3 h-3 text-gray-900" /> Known Facts
                                    </h4>
                                    <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">
                                        • CMU CS Class of 2024<br />
                                        • President of AI Society
                                    </div>
                                </div>
                                <div>
                                    <h4 className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                                        <Search className="w-3 h-3 text-gray-900" /> Observed Signals
                                    </h4>
                                    <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">
                                        • Built 'LegalLens' at HackMIT<br />
                                        • 2 open source PRs to LangChain
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Feature 4: Decision (Span 2) */}
                    <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl bg-gray-900 text-white p-8 sm:p-12">
                        <div className="absolute top-0 right-0 p-32 bg-gray-800/30 blur-3xl rounded-full pointer-events-none"></div>
                        <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10">
                            <div className="lg:w-1/2 space-y-6">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-inset ring-white/20">
                                    <UserCheck className="h-4 w-4" /> <span>Step 4</span>
                                </div>
                                <h3 className="text-3xl font-bold tracking-tight">You decide who to talk to</h3>
                                <p className="text-lg text-gray-300 leading-relaxed">
                                    We surface candidates worth a conversation. You make the call. Your feedback improves future results—what you liked, what you passed on, and why.
                                </p>
                                <div className="flex flex-wrap gap-4 mt-4">
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                                        <Check className="w-4 h-4 text-white" /> Instant Interview Scheduling
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                                        <X className="w-4 h-4 text-white" /> One-click Pass
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-1/2 w-full flex justify-center">
                                {/* Decision Visual */}
                                <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5 text-gray-900 transform rotate-1 hover:rotate-0 transition-all duration-500">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex gap-3">
                                            <img
                                                src="/images/Gemini_Generated_Image_ms7tmms7tmms7tmm.png"
                                                alt="Aidan Nguyen-Tran"
                                                className="w-12 h-12 rounded-full object-cover"
                                            />
                                            <div>
                                                <div className="font-bold text-gray-900">Aidan Nguyen-Tran</div>
                                                <div className="text-xs text-gray-500">The "Builder"</div>
                                            </div>
                                        </div>
                                        <div className="text-2xl">🌱</div>
                                    </div>
                                    <div className="text-sm text-gray-600 mb-6 leading-relaxed">
                                        Has the exact LangChain experience you need. Code quality is top 10% of cohort.
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-medium transition-colors">
                                            Pass
                                        </button>
                                        <button className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-black text-white hover:bg-gray-800 text-sm font-medium transition-colors shadow-lg">
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            Interview
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
