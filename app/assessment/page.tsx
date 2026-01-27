'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Loader2, Play, CheckCircle2, Instagram } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';

interface AssessmentStatus {
  status: 'not_started' | 'in_progress' | 'completed';
  repoUrl: string | null;
  startedAt: string | null;
  createdAt: string | null;
}

export default function AssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCompleted = searchParams?.get('completed') === 'true';
  const [user, setUser] = useState<User | null>(null);
  const [assessmentStatus, setAssessmentStatus] = useState<AssessmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch assessment status
  const fetchAssessmentStatus = async () => {
    try {
      const response = await fetch('/api/topcandidates/assessment-status', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAssessmentStatus(data);
      }
    } catch (error) {
      console.error('Error fetching assessment status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/?signup=true&redirect=/assessment');
        return;
      }
      setUser(currentUser);
      await fetchAssessmentStatus();
    };
    checkAuth();
  }, [router]);

  const handleStartAssessment = async () => {
    setIsCreatingRepo(true);
    try {
      // Call interview start which handles:
      // 1. Session creation
      // 2. Repository creation/setup
      // 3. Fly.io container provisioning
      const response = await fetch('/api/interview/start', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start assessment session');
      }

      const data = await response.json();

      toast({
        title: "Assessment started!",
        description: "Your secure workspace is being provisioned.",
      });

      // Redirect to IDE page which handles provisioning status display
      router.push('/ide');
    } catch (error) {
      console.error('Error starting assessment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start assessment';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreatingRepo(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
        <Header initialUser={user} />
        <section className="flex-1 flex items-center justify-center px-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-300" />
        </section>
      </div>
    );
  }

  // Show completion message if assessment was just completed
  if (isCompleted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
        <Header initialUser={user} />
        <section className="flex-1 pt-16 sm:pt-20 md:pt-24 pb-8 sm:pb-12 md:pb-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 md:p-12">
              {/* Success Icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                  <CheckCircle2 className="h-20 w-20 text-green-500 relative" />
                </div>
              </div>

              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                  Assessment Complete!
                </h1>
                <p className="text-gray-600 text-lg">
                  Thank you for completing your technical assessment with Hermes.
                </p>
              </div>

              {/* What's Next */}
              <div className="space-y-6">
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-3">What happens next:</h3>
                  <ul className="space-y-2 text-gray-700 list-disc list-inside">
                    <li>Our team will review your assessment</li>
                    <li>You'll receive feedback via email</li>
                    <li>Top candidates will be matched with employers</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
                  <p className="text-gray-700">
                    Questions? Contact us at{' '}
                    <a href="mailto:support@joinhermes.co" className="text-blue-600 hover:underline">
                      support@joinhermes.co
                    </a>
                  </p>
                </div>

                <Button
                  onClick={() => router.push('/')}
                  className="w-full bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all h-12 text-lg"
                >
                  Return to Home
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      <Header initialUser={user} />

      <section className="flex-1 pt-16 sm:pt-20 md:pt-24 pb-8 sm:pb-12 md:pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 md:p-12">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                Build a Real-Time Notification System
              </h1>
              <div className="flex items-center justify-center gap-2 text-slate-500 text-lg">
                <span>20-minute coding challenge</span>
                <span className="opacity-30">•</span>
                <span>100 points</span>
                <span className="opacity-30">•</span>
                <div className="flex items-center gap-1.5 bg-slate-100/50 px-2 py-0.5 rounded-md border border-slate-200">
                  <Image src="/images/claude-logo.png" alt="Claude" width={14} height={14} className="opacity-80" />
                  <span className="text-xs font-bold tracking-tight">Claude Code</span>
                </div>
              </div>
            </div>

            {/* Start Assessment */}
            <div className="space-y-6">
              {/* Mission Overview */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-8 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16" />
                <h3 className="font-bold text-xl text-slate-800 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">01</span>
                    Objective
                  </div>
                  <Instagram className="w-5 h-5 text-slate-300" />
                </h3>
                <p className="text-slate-500 mb-8 max-w-2xl leading-relaxed">
                  Transform <strong>InstaClone's</strong> static notification system into a high-performance, real-time engine that synchronizes instantly across all active sessions.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    "Dynamic unread count badges",
                    "Live notification dropdowns",
                    "Supabase Realtime integration",
                    "Cross-tab synchronization logic",
                    "Mark-as-read functionality"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm shadow-slate-200/20">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-blue-600" />
                      </div>
                      <span className="text-slate-700 text-sm font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring Breakdown */}
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    score: 40,
                    label: "Backend Logic",
                    desc: "API architecture & database queries",
                    icon: <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3"><div className="w-5 h-5 border-2 border-slate-800 rounded-sm" /></div>
                  },
                  {
                    score: 40,
                    label: "Frontend UI",
                    desc: "React components & state flow",
                    icon: <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3"><div className="w-5 h-2 border-2 border-slate-800 rounded-sm" /></div>
                  },
                  {
                    score: 20,
                    label: "Real-time Sync",
                    desc: "Broadcasts & channel subscription",
                    icon: <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3"><div className="w-2 h-5 bg-slate-800 rounded-full" /></div>
                  }
                ].map((item, idx) => (
                  <div key={idx} className="relative group overflow-hidden bg-white border border-slate-100 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-slate-100/50 hover:border-slate-200">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                      <span className="text-6xl font-black italic select-none">{item.score}</span>
                    </div>
                    <div className="relative z-10 flex flex-col items-center text-center">
                      <div className="text-3xl font-black text-slate-800 mb-2">{item.score} <span className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">pts</span></div>
                      <div className="h-px w-8 bg-slate-100 mb-4" />
                      <div className="text-sm font-bold text-slate-700 mb-1">{item.label}</div>
                      <div className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[140px]">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* What to Expect */}
              <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                  What to Expect
                </h3>
                <div className="space-y-4">
                  {[
                    "Cloud-based IDE with Next.js & Supabase pre-configured",
                    "7 guided files with TODO comments and clear objectives",
                    "Automated test suite with real-time feedback",
                    "Pre-seeded database for immediate development",
                    "Zero manual testing - your code is verified instantly"
                  ].map((text, idx) => (
                    <div key={idx} className="flex items-center gap-4 group">
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors" />
                      <span className="text-slate-600 text-sm group-hover:text-slate-900 transition-colors">{text}</span>
                    </div>
                  ))}
                </div>
              </div>



              <Button
                onClick={handleStartAssessment}
                disabled={isCreatingRepo}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold h-16 text-lg rounded-2xl transition-all shadow-xl shadow-slate-200/40 active:scale-[0.98]"
              >
                {isCreatingRepo ? (
                  <>
                    <Loader2 className="mr-3 h-6 w-6 animate-spin text-white/50" />
                    Initializing Environment...
                  </>
                ) : (
                  <>
                    <Play className="mr-3 h-6 w-6 fill-current opacity-90" />
                    Enter Workspace
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

