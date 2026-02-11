'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Users, Mail, MapPin, GraduationCap, Briefcase, Calendar, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface MatchedConnection {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  company?: string;
  position?: string;
  profile_url?: string;
  connected_date?: string;
  match_confidence: number;
  match_method: string;
  matched_candidate?: {
    id: string;
    name: string;
    email: string;
    skills?: string;
    location?: string;
    university?: string;
    years_of_experience?: string;
  };
}

function ResultsPageContent() {
  const searchParams = useSearchParams();
  const importId = searchParams?.get('importId') || null;
  const jobId = searchParams?.get('jobId') || null;

  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<MatchedConnection[]>([]);
  const [totalConnections, setTotalConnections] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await fetch('/api/linkedin/connections?matched=true');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch results');
        }

        setConnections(data.connections || []);
        setTotalConnections(data.totalCount || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [importId, jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Loading your matches...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
            <Link href="/linkedin-import">
              <Button>Try Again</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 1.0) {
      return <Badge className="bg-green-500">Email Match</Badge>;
    } else if (confidence >= 0.8) {
      return <Badge className="bg-blue-500">Name + Company</Badge>;
    } else {
      return <Badge className="bg-yellow-500">Name + School</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Success Header */}
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              <div>
                <CardTitle className="text-2xl text-green-900 dark:text-green-200">
                  Network Imported Successfully! 🎉
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-300">
                  Found {totalConnections} {totalConnections === 1 ? 'match' : 'matches'} in your LinkedIn network
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Matches List */}
        {totalConnections === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                No matches found
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                None of your LinkedIn connections are currently in our candidate database.
              </p>
              <Link href="/linkedin-import">
                <Button>Import More Connections</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Your Matches ({totalConnections})
              </h2>
              <Link href="/candidates">
                <Button>Browse All Candidates</Button>
              </Link>
            </div>

            {connections.map((connection) => (
              <Card key={connection.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                          {connection.first_name} {connection.last_name}
                        </h3>
                        {getConfidenceBadge(connection.match_confidence)}
                      </div>
                      {connection.position && connection.company && (
                        <p className="text-slate-600 dark:text-slate-400">
                          {connection.position} at {connection.company}
                        </p>
                      )}
                    </div>
                    {connection.profile_url && (
                      <a
                        href={connection.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Button variant="outline" size="sm" className="gap-2">
                          <ExternalLink className="w-4 h-4" />
                          LinkedIn
                        </Button>
                      </a>
                    )}
                  </div>

                  {/* Connection Info */}
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {connection.connected_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Connected {new Date(connection.connected_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {connection.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{connection.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Matched Candidate Info */}
                  {connection.matched_candidate && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                        Candidate Profile:
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        {connection.matched_candidate.university && (
                          <div className="flex items-start gap-2">
                            <GraduationCap className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-slate-500 dark:text-slate-400 text-xs">Education</div>
                              <div className="text-slate-900 dark:text-white">
                                {connection.matched_candidate.university}
                              </div>
                            </div>
                          </div>
                        )}
                        {connection.matched_candidate.years_of_experience && (
                          <div className="flex items-start gap-2">
                            <Briefcase className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-slate-500 dark:text-slate-400 text-xs">Experience</div>
                              <div className="text-slate-900 dark:text-white">
                                {connection.matched_candidate.years_of_experience} years
                              </div>
                            </div>
                          </div>
                        )}
                        {connection.matched_candidate.location && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-slate-500 dark:text-slate-400 text-xs">Location</div>
                              <div className="text-slate-900 dark:text-white">
                                {connection.matched_candidate.location}
                              </div>
                            </div>
                          </div>
                        )}
                        {connection.matched_candidate.skills && (
                          <div className="flex items-start gap-2 md:col-span-2">
                            <div>
                              <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">Skills</div>
                              <div className="flex flex-wrap gap-1">
                                {connection.matched_candidate.skills.split(',').slice(0, 5).map((skill, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {skill.trim()}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <Link href={`/candidates/${connection.matched_candidate.id}`}>
                          <Button variant="default" size="sm">View Full Profile</Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <ResultsPageContent />
    </Suspense>
  );
}
