'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  email: string;
  github_username: string;
  github_connected_at: string;
  created_at: string;
  has_verification: boolean;
  latest_score: number | null;
  verification_status: string | null;
  verified_at: string | null;
}

export default function AdminCandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      fetchCandidates();
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    // Filter candidates based on search query
    if (!searchQuery.trim()) {
      setFilteredCandidates(candidates);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCandidates(
        candidates.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.email.toLowerCase().includes(query) ||
            c.github_username.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, candidates]);

  async function fetchCandidates() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/github/candidates');

      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }

      const data = await response.json();
      setCandidates(data.candidates || []);
      setFilteredCandidates(data.candidates || []);
    } catch (err: any) {
      console.error('Error fetching candidates:', err);
      setError(err.message || 'Failed to load candidates');
    } finally {
      setIsLoading(false);
    }
  }

  function getScoreColor(score: number | null): string {
    if (score === null) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  function getScoreBadgeColor(score: number | null): string {
    if (score === null) return 'bg-gray-100 text-gray-700';
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Loading candidates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto text-red-600" />
          <p className="mt-4 text-red-600">{error}</p>
          <button
            onClick={fetchCandidates}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            GitHub Verification Admin
          </h1>
          <p className="mt-2 text-gray-600">
            Verify candidate resumes against GitHub activity
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or GitHub username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Candidates</div>
            <div className="text-2xl font-bold text-gray-900">
              {candidates.length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Verified</div>
            <div className="text-2xl font-bold text-green-600">
              {candidates.filter((c) => c.has_verification).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Not Verified</div>
            <div className="text-2xl font-bold text-yellow-600">
              {candidates.filter((c) => !c.has_verification).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Avg Score</div>
            <div className="text-2xl font-bold text-gray-900">
              {candidates.filter((c) => c.latest_score !== null).length > 0
                ? Math.round(
                    candidates
                      .filter((c) => c.latest_score !== null)
                      .reduce((sum, c) => sum + (c.latest_score || 0), 0) /
                      candidates.filter((c) => c.latest_score !== null).length
                  )
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    GitHub
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Verified
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      No candidates found
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        router.push(`/admin/candidates/${candidate.id}`)
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {candidate.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {candidate.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`https://github.com/${candidate.github_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          @{candidate.github_username}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {candidate.has_verification ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3 mr-1" />
                            Not Verified
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {candidate.latest_score !== null ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreBadgeColor(
                              candidate.latest_score
                            )}`}
                          >
                            {candidate.latest_score}/100
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(candidate.verified_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/candidates/${candidate.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
