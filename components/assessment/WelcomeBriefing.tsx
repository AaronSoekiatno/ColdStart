'use client';

import React from 'react';
import {
    Play,
    Terminal,
    Settings,
    Code2,
    CheckCircle2,
    AlertCircle,
    Cpu,
    BookOpen,
    ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WelcomeBriefing() {
    return (
        <div className="h-full w-full bg-[#1e1e1e] text-[#d4d4d4] overflow-y-auto p-8 font-sans selection:bg-blue-500/30">
            <div className="max-w-4xl mx-auto space-y-12 pb-20">

                {/* Header Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-400 font-mono text-sm tracking-tight">
                        <Terminal className="h-4 w-4" />
                        <span>SESSION_INITIALIZED: Build Real-Time Notifications</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">
                        Build a Real-Time Notification System 🔔
                    </h1>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                        <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Next.js 15
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            TypeScript
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Supabase Realtime
                        </div>
                    </div>
                </div>

                {/* Mission Card */}
                <div className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-2xl p-8 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Cpu className="h-32 w-32" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                        <Play className="h-6 w-6 text-blue-500" />
                        Your Mission
                    </h2>
                    <p className="text-lg text-slate-300 leading-relaxed mb-6">
                        You're working on <strong className="text-white">InstaClone</strong>, a social media application.
                        Your task is to build a real-time notification system that updates instantly
                        across all browser tabs.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            "Dynamic unread count badge",
                            "Real-time list updates",
                            "Mark as read functionality",
                            "Multi-tab state synchronization"
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Getting Started Section */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-indigo-400" />
                        Getting Started
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-[#252526] border border-white/5 rounded-xl p-6 hover:translate-y-[-2px] transition-transform">
                            <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                                <Code2 className="h-5 w-5 text-blue-400" />
                            </div>
                            <h3 className="font-semibold text-white mb-2">Backend First</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Implement the services in <code className="text-blue-300">lib/</code> and the API endpoints.
                            </p>
                        </div>

                        <div className="bg-[#252526] border border-white/5 rounded-xl p-6 hover:translate-y-[-2px] transition-transform">
                            <div className="h-10 w-10 bg-indigo-500/10 rounded-lg flex items-center justify-center mb-4">
                                <Settings className="h-5 w-5 text-indigo-400" />
                            </div>
                            <h3 className="font-semibold text-white mb-2">Frontend Hook</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Wire up <code className="text-indigo-300">use-notifications.ts</code> with real-time logic.
                            </p>
                        </div>

                        <div className="bg-[#252526] border border-white/5 rounded-xl p-6 hover:translate-y-[-2px] transition-transform">
                            <div className="h-10 w-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                                <AlertCircle className="h-5 w-5 text-green-400" />
                            </div>
                            <h3 className="font-semibold text-white mb-2">Test & Ship</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Run <code className="text-green-300">npm test</code> to verify your work against the rubric.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Evaluation Rubric */}
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Evaluation Rubric</h2>
                        <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 text-xs font-mono">
                            100 POINTS MAX
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="flex justify-between mb-1.5">
                                    <span className="text-sm font-medium text-slate-300">Backend APIs</span>
                                    <span className="text-sm font-mono text-slate-500">40 PTS</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500/40 w-[40%]" />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="flex justify-between mb-1.5">
                                    <span className="text-sm font-medium text-slate-300">Frontend UI</span>
                                    <span className="text-sm font-mono text-slate-500">40 PTS</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500/40 w-[40%]" />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="flex justify-between mb-1.5">
                                    <span className="text-sm font-medium text-slate-300">Real-time Integration</span>
                                    <span className="text-sm font-mono text-slate-500">20 PTS</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500/40 w-[20%]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Prompt */}
                <div className="flex flex-col items-center text-center space-y-4 pt-10">
                    <p className="text-slate-500 text-sm italic">
                        Select a file from the explorer on the left to begin implementation.
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="h-px w-12 bg-slate-800" />
                        <ArrowRight className="h-4 w-4 text-slate-700" />
                        <div className="h-px w-12 bg-slate-800" />
                    </div>
                </div>

            </div>
        </div>
    );
}
