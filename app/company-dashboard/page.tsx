'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SimpleHeader } from '@/components/layout/SimpleHeader';
import CompanyProfileCard from '@/components/company/CompanyProfileCard';
import CandidateBriefCard from '@/components/company/CandidateBriefCard';
import CandidateTable from '@/components/company/CandidateTable';
import { mockCompany, mockCandidates } from '@/lib/mockCompanyData';
import { Loader2, Users, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function CompanyDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        router.push('/company-form');
        return;
      }

      setUserEmail(session.user.email || null);
      setLoading(false);
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <SimpleHeader userEmail={userEmail} />
      <main className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Company Dashboard</h1>
          </div>
          <p className="text-gray-600">
            Welcome back! Here are your top matched candidates based on your company's operating model.
          </p>
        </div>

        {/* Company Profile Section */}
        <section className="mb-8">
          <CompanyProfileCard company={mockCompany} />
        </section>

        {/* Matched Candidates Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-700" />
              <h2 className="text-2xl font-semibold text-gray-900">
                Top Matched Candidates
              </h2>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                {mockCandidates.length} available
              </span>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Table
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Cards
              </button>
            </div>
          </div>

          {mockCandidates.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No candidates yet
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                We're currently finding the best matches for your company. Check back soon
                to see your top candidates!
              </p>
            </Card>
          ) : viewMode === 'table' ? (
            <CandidateTable candidates={mockCandidates} />
          ) : (
            <div className="space-y-6">
              {mockCandidates.map((candidate) => (
                <CandidateBriefCard key={candidate.id} candidate={candidate} />
              ))}
            </div>
          )}
        </section>

        {/* Demo Note */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 text-center">
            <strong>Demo Mode:</strong> This dashboard showcases ProofHire's vision with mock data.
            Real candidate matching will be available soon.
          </p>
        </div>
      </main>
    </div>
  );
}
