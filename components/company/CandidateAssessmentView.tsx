'use client';

import { Card } from '@/components/ui/card';
import { CheckCircle2, Clock, Award, Play } from 'lucide-react';
import Image from 'next/image';

interface CandidateAssessmentViewProps {
  companyName: string;
}

export default function CandidateAssessmentView({ companyName }: CandidateAssessmentViewProps) {
  return (
    <div className="space-y-6">
      {/* Preview Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-zinc-50 to-white p-8 sm:p-12">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-3">
                Build a Real-Time Notification System
              </h1>
              <div className="flex items-center justify-center gap-3 text-zinc-500">
                <span className="text-base">20-minute coding challenge</span>
                <span className="opacity-30">•</span>
                <span className="text-base">100 points</span>
                <span className="opacity-30">•</span>
                <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                  <Image
                    src="/images/claude-logo.png"
                    alt="Claude"
                    width={14}
                    height={14}
                    className="opacity-80"
                  />
                  <span className="text-xs font-bold tracking-tight">Claude Code</span>
                </div>
              </div>
            </div>

            {/* Mission Overview */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 text-white text-xs font-bold">
                  01
                </div>
                <h3 className="text-lg font-bold text-zinc-900">Objective</h3>
              </div>
              <p className="text-zinc-600 mb-6 leading-relaxed">
                Transform <strong>InstaClone's</strong> static notification system into a high-performance,
                real-time engine that synchronizes instantly across all active sessions.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Dynamic unread count badges',
                  'Live notification dropdowns',
                  'Supabase Realtime integration',
                  'Cross-tab synchronization logic',
                  'Mark-as-read functionality',
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-lg p-3"
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    </div>
                    <span className="text-zinc-700 text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                {
                  score: 15,
                  label: 'Build & Types',
                  desc: 'TypeScript validation',
                  color: 'blue',
                },
                {
                  score: 35,
                  label: 'Core Requirements',
                  desc: 'UI, data fetching, rendering',
                  color: 'emerald',
                },
                {
                  score: 25,
                  label: 'Enhanced Features',
                  desc: 'Error handling, loading states',
                  color: 'purple',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-zinc-200 rounded-xl p-5 text-center hover:border-zinc-300 transition-colors"
                >
                  <div className="text-3xl font-black text-zinc-900 mb-1">
                    {item.score}
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest ml-1">pts</span>
                  </div>
                  <div className="h-px w-8 bg-zinc-200 mx-auto mb-2" />
                  <div className="text-sm font-bold text-zinc-700 mb-1">{item.label}</div>
                  <div className="text-xs text-zinc-500">{item.desc}</div>
                </div>
              ))}
            </div>

            {/* What to Expect */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-bold text-zinc-900 mb-4">What to Expect</h3>
              <div className="space-y-3">
                {[
                  'Cloud-based IDE with Next.js & Supabase pre-configured',
                  '7 guided files with TODO comments and clear objectives',
                  'Automated test suite with real-time feedback',
                  'Pre-seeded database for immediate development',
                  'Zero manual testing - your code is verified instantly',
                ].map((text, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    <span className="text-sm text-zinc-600">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold h-16 text-lg rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-3">
              <Play className="w-6 h-6 fill-current opacity-90" />
              Enter Workspace
            </button>

            {/* Footer Note */}
            <p className="text-center text-sm text-zinc-500 mt-6">
              You'll work in a real VS Code environment with access to documentation and AI tools
            </p>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 bg-white border border-zinc-200">
          <h4 className="font-bold text-zinc-900 mb-3">What candidates see:</h4>
          <ul className="space-y-2 text-sm text-zinc-700">
            {[
              'Clear task description with acceptance criteria',
              'Pre-scaffolded codebase with helpful comments',
              'Live preview of their application',
              'Real-time test runner with feedback',
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 bg-white border border-zinc-200">
          <h4 className="font-bold text-zinc-900 mb-3">What you'll receive:</h4>
          <ul className="space-y-2 text-sm text-zinc-700">
            {[
              'Complete code submission with full history',
              'Automated test results and coverage report',
              'Code quality analysis and metrics',
              "Candidate's written reflection on their approach",
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
