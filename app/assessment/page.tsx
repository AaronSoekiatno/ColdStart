'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check, Play, Github } from 'lucide-react';
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
      const response = await fetch('/api/topcandidates/create-assessment-repo', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create assessment repository');
      }

      const data = await response.json();

      toast({
        title: "Assessment repository created!",
        description: "Your private workspace is ready.",
      });

      // Refresh status
      await fetchAssessmentStatus();
    } catch (error) {
      console.error('Error creating assessment repo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create repository';
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

  const hasRepo = assessmentStatus?.repoUrl !== null;
  const repoName = assessmentStatus?.repoUrl?.split('/').pop() || 'hermes-assessment-*';
  const cloneUrl = assessmentStatus?.repoUrl ? `${assessmentStatus.repoUrl}.git` : '';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      <Header initialUser={user} />

      <section className="flex-1 pt-16 sm:pt-20 md:pt-24 pb-8 sm:pb-12 md:pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 md:p-12">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                {hasRepo ? "Your Assessment Workspace" : "Start Your 20-Minute Assessment"}
              </h1>
              <p className="text-gray-600 text-lg">
                {hasRepo
                  ? "Your private workspace is ready. Clone the repository and start your assessment."
                  : "Start a 20-minute technical assessment to showcase your skills to potential employers"}
              </p>
            </div>

            {!hasRepo ? (
              /* Not Started State */
              <div className="space-y-6">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-3">What you'll do:</h3>
                  <ul className="space-y-2 text-gray-700 list-disc list-inside">
                    <li>Work in a private GitHub repository</li>
                    <li>Complete database tasks in your isolated workspace</li>
                    <li>Demonstrate your problem-solving skills</li>
                    <li>Showcase your technical abilities</li>
                    <li>Get guided by Minerva, your voice AI assistant</li>
                  </ul>
                </div>

                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-3">Time required:</h3>
                  <p className="text-gray-700">Approximately 20 minutes</p>
                </div>

                <Button
                  onClick={handleStartAssessment}
                  disabled={isCreatingRepo}
                  className="w-full bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all h-12 text-lg"
                >
                  {isCreatingRepo ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating workspace...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      Start Assessment
                    </>
                  )}
                </Button>
              </div>
            ) : (
              /* Has Repository - Show Instructions */
              <div className="space-y-6">
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-green-600 text-2xl">✓</div>
                    <h3 className="font-semibold text-lg text-gray-900">
                      Repository Created Successfully
                    </h3>
                  </div>
                  <p className="text-gray-700 mb-4">
                    Your private assessment workspace is ready. Follow these steps to get started:
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Steps removed as per user request */}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-4 pt-4">
                  <Button
                    onClick={() => router.push('/ide')}
                    className="w-full bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium shadow-md hover:shadow-lg transition-all h-12 text-lg"
                  >
                    💻 Open IDE
                  </Button>
                  <Button
                    onClick={() => router.push('/interview')}
                    variant="outline"
                    className="w-full text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                  >
                    🎙️ Start Interview with Minerva
                  </Button>
                  <Button
                    onClick={() => window.open(assessmentStatus?.repoUrl || '', '_blank')}
                    variant="outline"
                    className="w-full text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    Open Repository
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

