'use client';

import { useState } from 'react';
import { AshbyJob } from '@/lib/ashby-jobs';

interface JobListingsModalProps {
  startupId: string;
  startupName: string;
  ashbySlug?: string;
}

/**
 * Modal component to display job listings from Ashby
 *
 * Usage:
 * ```tsx
 * <JobListingsModal
 *   startupId={startup.id}
 *   startupName={startup.name}
 *   ashbySlug={startup.ashby_slug}
 * />
 * ```
 */
export function JobListingsModal({
  startupId,
  startupName,
  ashbySlug,
}: JobListingsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [jobs, setJobs] = useState<AshbyJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    if (jobs.length > 0) {
      // Already fetched, just open modal
      setIsOpen(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = ashbySlug
        ? `/api/startups/${startupId}/jobs?slug=${ashbySlug}`
        : `/api/startups/${startupId}/jobs`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setJobs(data.jobs);
        setIsOpen(true);
      } else {
        setError(data.error || 'No jobs found');
      }
    } catch (err) {
      setError('Failed to load jobs. Please try again.');
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={fetchJobs}
        disabled={loading}
        className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'View Open Positions'}
      </button>

      {/* Error Message */}
      {error && !isOpen && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Open Positions at {startupName}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {jobs.length} {jobs.length === 1 ? 'position' : 'positions'} available
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
              >
                ×
              </button>
            </div>

            {/* Job List */}
            <div className="overflow-y-auto max-h-[60vh] px-6 py-4">
              {jobs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No active job postings found.
                </p>
              ) : (
                <ul className="space-y-4">
                  {jobs.map((job) => (
                    <li
                      key={job.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {job.title}
                          </h3>
                          <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                            {job.department && (
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {job.department}
                              </span>
                            )}
                            {job.location && (
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {job.location}
                              </span>
                            )}
                            {job.employmentType && (
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {job.employmentType === 'FullTime' ? 'Full Time' : job.employmentType}
                              </span>
                            )}
                          </div>
                        </div>
                        <a
                          href={job.applicationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          Apply →
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <p className="text-xs text-gray-500">
                Job listings powered by Ashby. Click "Apply" to open the application in a new tab.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
