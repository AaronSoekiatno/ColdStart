'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  User,
  FileText,
  Code,
  Briefcase,
  LayoutDashboard,
  Github,
  Terminal,
  Download
} from 'lucide-react';
import { getScoreInterpretation } from '@/lib/github-verification/score-calculator';
import { Button } from '@/components/ui/button';

interface CandidateProfile {
  candidate: any;
  verifications: any[];
  sessions: any[];
  resumes: any[];
  matches: any[];
  assessmentScores: any[];
}

export default function CandidateFullProfilePage() {
  const router = useRouter();
  const params = useParams();
  const candidateId = params?.id as string;

  const [data, setData] = useState<CandidateProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'assessment' | 'github' | 'matches'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) return;

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      fetchFullProfile();
    }
    checkAuth();
  }, [candidateId, router]);

  async function fetchFullProfile() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/candidates/${candidateId}/full-profile`);

      if (!response.ok) {
        throw new Error('Failed to fetch candidate profile');
      }

      const profileData = await response.json();
      setData(profileData);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }

  async function triggerVerification() {
    try {
      setIsVerifying(true);
      setError(null);

      const response = await fetch('/api/admin/github/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to verify candidate');
      }

      // Refetch profile to get new verification
      await fetchFullProfile();
      setActiveTab('github'); // Switch to GitHub tab to see results
    } catch (err: any) {
      console.error('Error verifying candidate:', err);
      setError(err.message || 'Failed to verify candidate');
    } finally {
      setIsVerifying(false);
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Loading comprehensive profile...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto text-red-600" />
          <p className="mt-4 text-red-600">{error || 'Candidate not found'}</p>
          <button
            onClick={() => router.push('/admin/candidates')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to List
          </button>
        </div>
      </div>
    );
  }

  const { candidate, verifications, sessions, resumes, matches, assessmentScores } = data;
  const latestVerification = verifications[0];
  const scoreInterpretation = latestVerification
    ? getScoreInterpretation(latestVerification.overall_score)
    : null;

  // Calculate assessment stats
  const latestSession = sessions[0];
  const hasStartedAssessment = sessions.length > 0;
  const assessmentStatus = latestSession?.container_status || 'Not Started';

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/admin/candidates')}
              className="flex items-center text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Candidates
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono">ID: {candidate.id}</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">
                {candidate.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  {candidate.name}
                  {latestVerification?.overall_score >= 80 && (
                    <CheckCircle className="w-5 h-5 text-green-500" fill="currentColor" />
                  )}
                </h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-1 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    {candidate.email}
                  </div>
                  {candidate.github_username && (
                    <a
                      href={`https://github.com/${candidate.github_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Github className="w-4 h-4" />
                      @{candidate.github_username}
                    </a>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Joined {formatDate(candidate.created_at).split(',')[0]}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={fetchFullProfile}
                variant="outline"
                size="sm"
                className="text-gray-600"
              >
                Refresh Data
              </Button>
              <Button
                onClick={triggerVerification}
                disabled={isVerifying}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4 mr-2" />
                    {latestVerification ? 'Re-Verify GitHub' : 'Verify GitHub'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 mt-8 border-b border-gray-100 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'profile', label: 'Full Profile', icon: User },
              { id: 'assessment', label: 'Assessment Results', icon: Code },
              { id: 'github', label: 'GitHub Analysis', icon: Github },
              { id: 'matches', label: 'Startup Matches', icon: Briefcase },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">GitHub Signal</h3>
              {latestVerification ? (
                <div className="text-center py-4">
                  <div className="text-5xl font-bold mb-2" style={{ color: scoreInterpretation?.color === 'green' ? '#16a34a' : scoreInterpretation?.color === 'yellow' ? '#ca8a04' : '#dc2626' }}>
                    {latestVerification.overall_score}
                  </div>
                  <div className="text-lg font-medium text-gray-900 mb-1">{scoreInterpretation?.label}</div>
                  <p className="text-sm text-gray-500">{scoreInterpretation?.description}</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Github className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  No verification run yet
                </div>
              )}
            </div>

            {/* Assessment Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Assessment Status</h3>
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${assessmentStatus === 'running' ? 'bg-green-100 text-green-600' :
                  assessmentStatus === 'stopped' ? 'bg-gray-100 text-gray-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                  <Terminal className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-gray-900 capitalize">{assessmentStatus}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  {sessions.length} sessions created
                </p>
                {latestSession && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last active: {formatDate(latestSession.created_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Key Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-1">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Resumes Uploaded</span>
                  <span className="font-mono font-medium">{resumes.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Startup Matches</span>
                  <span className="font-mono font-medium">{matches.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Education</span>
                  <span className="font-medium text-right text-sm">{candidate.education_level || 'Not specified'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Experience</span>
                  <span className="font-medium">{candidate.years_of_experience || '0'} years</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-500" />
                Demographics & Info
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                  <div className="text-gray-900 font-medium">{candidate.name}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                  <div className="text-gray-900 font-medium">{candidate.email}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Location</label>
                  <div className="text-gray-900 font-medium">{candidate.location || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">University</label>
                  <div className="text-gray-900 font-medium">{candidate.university || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Major</label>
                  <div className="text-gray-900 font-medium">
                    {Array.isArray(candidate.major) ? candidate.major.join(', ') : candidate.major || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Graduation Level</label>
                  <div className="text-gray-900 font-medium capitalize">{candidate.education_level?.replace('-', ' ') || '—'}</div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Job Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Job Type</label>
                    <div className="text-gray-900 font-medium capitalize">{candidate.job_type || '—'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Roles</label>
                    <div className="flex flex-wrap gap-2">
                      {candidate.role_type?.map((role: string) => (
                        <span key={role} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {role}
                        </span>
                      )) || '—'}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-500 mb-1">Objectives</label>
                    <div className="flex flex-wrap gap-2">
                      {candidate.objectives?.map((obj: string) => (
                        <span key={obj} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                          {obj.replace('-', ' ')}
                        </span>
                      )) || '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                Resume History
              </h2>
              {resumes.length === 0 ? (
                <p className="text-gray-500 italic">No resumes uploaded.</p>
              ) : (
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {resumes.map((resume) => (
                        <tr key={resume.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {resume.file_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(resume.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {resume.is_primary && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Primary
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {resume.resume_path && (
                              <button className="text-blue-600 hover:text-blue-900 flex items-center justify-end gap-1 ml-auto">
                                <Download className="w-4 h-4" />
                                Download
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ASSESSMENT TAB */}
        {activeTab === 'assessment' && (
          <div className="space-y-6">
            {assessmentScores.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Code className="w-5 h-5 text-gray-500" />
                  Test Runs (Scored)
                </h2>
                <div className="space-y-4">
                  {assessmentScores.map((score, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-gray-900 capitalize">{score.test_type || 'Unknown Type'} Test</div>
                          <div className="text-xs text-gray-500">Session: {score.session_id}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            {score.total_score} <span className="text-sm text-gray-400 font-normal">/ {score.max_score}</span>
                          </div>
                        </div>
                      </div>

                      {score.test_results?.testResults && (
                        <div className="mt-4 space-y-2">
                          {score.test_results.testResults.map((suite: any, sIdx: number) => (
                            <div key={sIdx} className="bg-gray-50 rounded p-2 text-sm">
                              <div className="flex justify-between font-medium">
                                <span>{suite.name.split('/').pop()}</span>
                                <span className={suite.status === 'passed' ? 'text-green-600' : 'text-red-600'}>
                                  {suite.status.toUpperCase()}
                                </span>
                              </div>
                              {/* Failed specs */}
                              {suite.assertionResults.filter((r: any) => r.status === 'failed').map((assertion: any, aIdx: number) => (
                                <div key={aIdx} className="ml-2 mt-1 text-red-600 text-xs flex items-start">
                                  <XCircle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                                  {assertion.title}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-gray-500" />
                Session Logs
              </h2>
              {sessions.length === 0 ? (
                <p className="text-gray-500 italic">No assessment sessions initiated.</p>
              ) : (
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Container URL</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sessions.map((session) => (
                        <tr key={session.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-600">
                            {session.session_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(session.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${session.container_status === 'running'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}>
                              {session.container_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 truncate max-w-xs">
                            {session.container_url ? (
                              <a href={session.container_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {session.container_url}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GITHUB TAB */}
        {activeTab === 'github' && (
          <div className="space-y-6">
            {!latestVerification ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Github className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No Verification Yet</h2>
                <p className="text-gray-600 mb-6">Click the verification button above to analyze this candidate's GitHub.</p>
                <Button onClick={triggerVerification}>Run First Verification</Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Project Matches */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Project Matches</h2>
                  <div className="space-y-3">
                    {latestVerification.project_matches?.map((match: any, idx: number) => (
                      <div key={idx} className={`border rounded-lg p-4 transition-all ${match.is_verified ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
                        }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-bold text-gray-900">{match.resume_project}</div>
                            <div className="text-sm text-gray-600 mt-1 max-w-2xl">{match.resume_description}</div>

                            {match.matched_repos?.length > 0 ? (
                              <div className="mt-3 bg-white/60 p-2 rounded-md border border-gray-200 inline-block">
                                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Matched Repository</div>
                                {match.matched_repos.slice(0, 1).map((repo: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <a href={repo.repo} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center font-medium text-sm">
                                      {repo.repo_name}
                                      <ExternalLink className="w-3 h-3 ml-1" />
                                    </a>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${repo.confidence > 0.8 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                      {Math.round(repo.confidence * 100)}% Confidence
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-red-600 mt-2 flex items-center font-medium">
                                <XCircle className="w-3 h-3 mr-1" />
                                No matching repository found
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            {match.is_verified ? (
                              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                              </div>
                            ) : (
                              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                                <XCircle className="w-6 h-6 text-red-600" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline Analysis */}
                {latestVerification.experience_timeline_analysis?.gaps?.length > 0 && (
                  <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      Timeline Discrepancies
                    </h2>
                    <div className="space-y-3">
                      {latestVerification.experience_timeline_analysis.gaps.map((gap: any, idx: number) => (
                        <div key={idx} className="border border-red-100 bg-red-50 rounded-lg p-4">
                          <div className="flex md:items-center flex-col md:flex-row gap-4">
                            <div className="flex-1">
                              <div className="font-bold text-red-900">{gap.period}</div>
                              <div className="text-sm text-red-700 mt-1">Claimed: <span className="font-semibold">{gap.resume_claim}</span></div>
                              <div className="text-sm text-red-700">Actual GitHub Activity: <span className="font-semibold">{gap.github_activity}</span></div>
                            </div>
                            <div className="px-3 py-1 bg-white/50 rounded text-xs font-bold text-red-800 uppercase tracking-wider self-start md:self-center">
                              High Severity
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-gray-500" />
                Startup Matches ({matches.length})
              </h2>
              {matches.length === 0 ? (
                <p className="text-gray-500 italic">No startup matches found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matches.map((match) => (
                    <div key={match.startup_id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-900 text-lg">{match.startup?.name || 'Unknown Startup'}</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {Math.round(match.score * 100)}% Match
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{match.startup?.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {match.startup?.industry && (
                          <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">{match.startup.industry}</span>
                        )}
                        {match.startup?.location && (
                          <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">{match.startup.location}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
