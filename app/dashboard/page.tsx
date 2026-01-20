'use client';

import { useState, useEffect, useRef } from 'react';

interface CandidateData {
  candidate: {
    id: string;
    name: string;
    email: string;
    created_at: string;
  };
  sessions: any[];
  assessmentScores: any[];
  commits: any[];
  metrics: {
    totalSessions: number;
    avgTestRuns: string;
    avgScore: string;
    avgTimeMinutes: string;
    passRate: string;
    aiLeverageScore: number;
    validationScore: number;
    scoreProgression?: Array<{ timestamp: string; score: number }>;
  };
}

interface MultipleResults {
  multiple: true;
  candidates: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

interface Suggestion {
  id: string;
  name: string;
  email: string;
  display: string;
}

export default function DashboardPage() {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CandidateData | null>(null);
  const [multipleResults, setMultipleResults] = useState<MultipleResults | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchValue.length >= 2) {
        try {
          const response = await fetch(`/api/dashboard/autocomplete?q=${encodeURIComponent(searchValue)}`);
          const result = await response.json();
          setSuggestions(result.suggestions || []);
          setShowSuggestions(true);
        } catch (err) {
          console.error('Autocomplete error:', err);
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (candidateId?: string) => {
    const searchId = candidateId || searchValue.trim();

    if (!searchId) {
      setError('Please enter a search value');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    setMultipleResults(null);
    setShowSuggestions(false);

    try {
      const params = new URLSearchParams();
      if (candidateId) {
        params.set('candidateId', candidateId);
      } else {
        params.set('name', searchId);
      }

      const response = await fetch(`/api/dashboard/candidate?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to fetch data');
        return;
      }

      if ('multiple' in result && result.multiple) {
        setMultipleResults(result);
      } else {
        setData(result);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    setSearchValue(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
    handleSearch(suggestion.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const selectCandidate = (candidateId: string) => {
    setSearchValue('');
    setMultipleResults(null);
    handleSearch(candidateId);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-black mb-8">
          Assessment Dashboard
        </h1>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-black mb-4">Search Candidate</h2>
          <div className="relative">
            <label className="block text-sm font-medium text-black mb-2">
              Search by name or email
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setSelectedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Start typing a name or email..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-base"
                />

                {/* Autocomplete Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
                  >
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.id}
                        onClick={() => selectSuggestion(suggestion)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0 ${
                          index === selectedIndex ? 'bg-gray-100' : ''
                        }`}
                      >
                        <div className="font-medium text-black">{suggestion.name}</div>
                        <div className="text-sm text-gray-600">{suggestion.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Multiple Results */}
        {multipleResults && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-black mb-4">
              Multiple Candidates Found ({multipleResults.candidates.length})
            </h2>
            <div className="space-y-2">
              {multipleResults.candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => selectCandidate(candidate.id)}
                  className="w-full text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-blue-500 transition-colors"
                >
                  <div className="font-medium text-black">{candidate.name}</div>
                  <div className="text-sm text-gray-600">{candidate.email}</div>
                  <div className="text-xs text-gray-400 font-mono">{candidate.id}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Candidate Data */}
        {data && (
          <>
            {/* Candidate Info */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-black mb-4">Candidate Information</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-black">{data.candidate.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-black">{data.candidate.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Candidate ID</dt>
                  <dd className="mt-1 text-sm text-black font-mono">{data.candidate.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Registered</dt>
                  <dd className="mt-1 text-sm text-black">
                    {new Date(data.candidate.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Behavioral Metrics */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-black mb-4">Behavioral Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <MetricCard
                  title="Total Sessions"
                  value={data.metrics.totalSessions.toString()}
                  color="blue"
                />
                <MetricCard
                  title="Avg Test Runs"
                  value={data.metrics.avgTestRuns}
                  subtitle="Target: 2-4"
                  color={parseFloat(data.metrics.avgTestRuns) >= 2 && parseFloat(data.metrics.avgTestRuns) <= 4 ? 'green' : 'yellow'}
                />
                <MetricCard
                  title="Avg Score"
                  value={data.metrics.avgScore}
                  subtitle="Out of 100"
                  color={parseFloat(data.metrics.avgScore) >= 80 ? 'green' : parseFloat(data.metrics.avgScore) >= 60 ? 'yellow' : 'red'}
                />
                <MetricCard
                  title="Pass Rate"
                  value={`${data.metrics.passRate}%`}
                  subtitle="Score ≥ 80"
                  color={parseFloat(data.metrics.passRate) >= 60 ? 'green' : 'yellow'}
                />
              </div>

              <div className="grid grid-cols-2 gap-6 mt-6">
                <ScoreCard
                  title="AI Leverage Score"
                  score={data.metrics.aiLeverageScore}
                  description="How effectively they use AI (based on iteration pattern)"
                />
                <ScoreCard
                  title="Validation Score"
                  score={data.metrics.validationScore}
                  description="How well they validate and test their code"
                />
              </div>
            </div>

            {/* Sessions Table */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-black mb-4">
                Sessions ({data.sessions.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">
                        Session ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">
                        Test Runs
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">
                        Last Score
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">
                        Started
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.sessions.map((session) => (
                      <tr key={session.session_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-black">
                          {session.session_id.substring(0, 8)}...
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge status={session.container_status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-black">
                          {session.test_run_count || 0}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <ScoreBadge score={session.last_test_score} />
                        </td>
                        <td className="px-4 py-3 text-sm text-black">
                          {session.container_started_at && session.container_stopped_at
                            ? `${Math.round((new Date(session.container_stopped_at).getTime() - new Date(session.container_started_at).getTime()) / 1000 / 60)} min`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {session.container_started_at
                            ? new Date(session.container_started_at).toLocaleString()
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Score Progression */}
            {data.metrics.scoreProgression && data.metrics.scoreProgression.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold text-black mb-4">Score Progression</h2>
                <div className="space-y-2">
                  {data.metrics.scoreProgression.map((item, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <span className="text-sm text-gray-600 w-40">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div
                          className={`h-4 rounded-full ${
                            item.score >= 80 ? 'bg-green-500' : item.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-black w-12">{item.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Commits */}
            {data.commits.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-black mb-4">
                  Recent Commits ({data.commits.length})
                </h2>
                <div className="space-y-3">
                  {data.commits.slice(0, 10).map((commit) => (
                    <div key={commit.id} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="text-sm font-medium text-black">
                        {commit.commit_message || 'No message'}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(commit.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  color: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className={`rounded-lg border-2 p-4 ${colors[color]}`}>
      <div className="text-sm font-medium opacity-80">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {subtitle && <div className="text-xs mt-1 opacity-70">{subtitle}</div>}
    </div>
  );
}

function ScoreCard({
  title,
  score,
  description,
}: {
  title: string;
  score: number;
  description: string;
}) {
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-black">{title}</h3>
        <span className="text-2xl font-bold text-black">{score}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full ${getColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-gray-600">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-100 text-green-800',
    stopped: 'bg-gray-100 text-gray-800',
    provisioning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-gray-400">-</span>;
  }

  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';

  return <span className={`font-medium ${color}`}>{score}</span>;
}
