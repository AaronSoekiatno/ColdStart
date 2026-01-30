'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Users,
  GraduationCap,
  Globe,
  MapPin,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Database
} from 'lucide-react';

interface SegmentCounts {
  segmentA: number;
  segmentB: number;
  segmentC: number;
  segmentD: number;
  segmentE: number;
}

interface DataQualityMetrics {
  missingLocation: number;
  missingUniversity: number;
  missingGraduationDate: number;
  totalCandidates: number;
}

interface SegmentData {
  counts: SegmentCounts;
  segments: {
    segmentA: any[];
    segmentB: any[];
    segmentC: any[];
    segmentD: any[];
    segmentE: any[];
  };
  dataQuality: DataQualityMetrics;
  total: number;
}

export default function SegmentationDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<SegmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      fetchSegmentData();
    }
    checkAuth();
  }, [router]);

  async function fetchSegmentData() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/segments', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) throw new Error('Failed to fetch segment data');

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Error fetching segments:', err);
      setError(err.message || 'Failed to load segment data');
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSegment(segmentKey: string) {
    setExpandedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentKey)) {
        newSet.delete(segmentKey);
      } else {
        newSet.add(segmentKey);
      }
      return newSet;
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Analyzing candidates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-600" />
          <p className="mt-4 text-red-600">{error}</p>
          <button
            onClick={fetchSegmentData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const segments = [
    {
      key: 'segmentA',
      title: 'Segment A: Premium US Talent',
      description: 'US-based + Top 20 CS school + Available now',
      icon: TrendingUp,
      color: 'bg-purple-100 text-purple-600',
      borderColor: 'border-purple-300',
      count: data?.counts.segmentA || 0,
      expectedRange: '20-50',
      candidates: data?.segments.segmentA || [],
    },
    {
      key: 'segmentB',
      title: 'Segment B: US Ready Talent',
      description: 'US-based + Any school + Available now',
      icon: MapPin,
      color: 'bg-blue-100 text-blue-600',
      borderColor: 'border-blue-300',
      count: data?.counts.segmentB || 0,
      expectedRange: '50-100',
      candidates: data?.segments.segmentB || [],
    },
    {
      key: 'segmentC',
      title: 'Segment C: Elite International',
      description: 'International + Elite school + US work auth',
      icon: Globe,
      color: 'bg-green-100 text-green-600',
      borderColor: 'border-green-300',
      count: data?.counts.segmentC || 0,
      expectedRange: '50-100',
      candidates: data?.segments.segmentC || [],
    },
    {
      key: 'segmentD',
      title: 'Segment D: International Pool',
      description: 'International + Any school + No work auth',
      icon: GraduationCap,
      color: 'bg-yellow-100 text-yellow-600',
      borderColor: 'border-yellow-300',
      count: data?.counts.segmentD || 0,
      expectedRange: '200-300',
      candidates: data?.segments.segmentD || [],
    },
    {
      key: 'segmentE',
      title: 'Segment E: Other Candidates',
      description: 'All other candidates',
      icon: Users,
      color: 'bg-gray-100 text-gray-600',
      borderColor: 'border-gray-300',
      count: data?.counts.segmentE || 0,
      expectedRange: 'Variable',
      candidates: data?.segments.segmentE || [],
    },
  ];

  const dataQuality = data?.dataQuality;
  const hasDataQualityIssues = dataQuality && (
    dataQuality.missingLocation > 0 ||
    dataQuality.missingUniversity > 0 ||
    dataQuality.missingGraduationDate > 0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Candidate Segmentation
              </h1>
              <p className="mt-2 text-gray-600">
                Analyze candidate distribution across 5 key segments
              </p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Back to Admin
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Candidates</div>
              <div className="text-2xl font-bold text-gray-900">
                {data?.total || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Premium US (A)</div>
              <div className="text-2xl font-bold text-purple-600">
                {data?.counts.segmentA || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">US Ready (B)</div>
              <div className="text-2xl font-bold text-blue-600">
                {data?.counts.segmentB || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Data Quality Metrics */}
        {hasDataQualityIssues && dataQuality && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Database className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900">
                  Data Quality Issues Detected
                </h3>
                <p className="text-xs text-amber-700 mt-1">
                  Some candidates have incomplete data which may affect segmentation accuracy
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <div className="text-xs text-gray-600">Missing Location</div>
                <div className="text-xl font-bold text-amber-700">
                  {dataQuality.missingLocation}
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    ({Math.round((dataQuality.missingLocation / dataQuality.totalCandidates) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <div className="text-xs text-gray-600">Missing University</div>
                <div className="text-xl font-bold text-amber-700">
                  {dataQuality.missingUniversity}
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    ({Math.round((dataQuality.missingUniversity / dataQuality.totalCandidates) * 100)}%)
                  </span>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <div className="text-xs text-gray-600">Missing Graduation Date</div>
                <div className="text-xl font-bold text-amber-700">
                  {dataQuality.missingGraduationDate}
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    ({Math.round((dataQuality.missingGraduationDate / dataQuality.totalCandidates) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Limitations Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <strong>Limitations:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Work authorization field does not exist in database. Segment C uses simplified logic.</li>
                <li>School names are normalized using existing abbreviation dictionary, but some variations may not match.</li>
                <li>Graduation dates must be in parseable format (e.g., "May 2024", "2024").</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Segment Cards */}
        <div className="space-y-4">
          {segments.map((segment) => (
            <div
              key={segment.key}
              className={`bg-white rounded-lg shadow-sm border-2 ${segment.borderColor} overflow-hidden`}
            >
              {/* Segment Header */}
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleSegment(segment.key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${segment.color}`}>
                      <segment.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {segment.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {segment.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900">
                        {segment.count}
                      </div>
                      <div className="text-xs text-gray-500">
                        Expected: {segment.expectedRange}
                      </div>
                    </div>
                    {expandedSegments.has(segment.key) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Candidate List (Expandable) */}
              {expandedSegments.has(segment.key) && (
                <div className="border-t border-gray-200 bg-gray-50">
                  {segment.candidates.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      No candidates in this segment
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="space-y-2">
                        {segment.candidates.map((candidate: any) => (
                          <div
                            key={candidate.id}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                            onClick={() => router.push(`/admin/candidates/${candidate.id}`)}
                          >
                            <div>
                              <div className="font-medium text-gray-900">
                                {candidate.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {candidate.email}
                              </div>
                            </div>
                            <div className="text-right text-sm text-gray-600">
                              <div className="font-medium">
                                {candidate.normalizedUniversity || candidate.university || 'No university'}
                              </div>
                              {candidate.normalizedUniversity && candidate.university !== candidate.normalizedUniversity && (
                                <div className="text-xs text-gray-400">
                                  Original: {candidate.university}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">
                                {candidate.location || 'No location'}
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
          ))}
        </div>
      </div>
    </div>
  );
}
