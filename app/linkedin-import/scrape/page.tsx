'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import Link from 'next/link';

export default function ScrapeImportPage() {
  const router = useRouter();
  const [linkedinEmail, setLinkedinEmail] = useState('');
  const [linkedinPassword, setLinkedinPassword] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Poll for job status
  useEffect(() => {
    if (!jobId || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/linkedin/scrape/status?jobId=${jobId}`);
        const data = await response.json();

        setProgress(data.progress || 0);
        setStatus(data.message || '');

        if (data.status === 'success') {
          clearInterval(pollInterval);
          setIsPolling(false);
          // Redirect to results
          setTimeout(() => {
            router.push(`/linkedin-import/results?jobId=${jobId}`);
          }, 1000);
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          setIsPolling(false);
          setError(data.error || 'Scraping failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, isPolling, router]);

  const handleStartScrape = async () => {
    if (!linkedinEmail || !linkedinPassword || !isAgreed) return;

    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/linkedin/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinEmail, linkedinPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.fallback) {
          // Offer CSV fallback
          setError(`${data.error}. We recommend using the CSV upload method instead.`);
        } else {
          throw new Error(data.error || 'Failed to start scraping');
        }
        return;
      }

      // Start polling for status
      setJobId(data.jobId);
      setIsPolling(true);
      setStatus('Initializing scraping job...');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scraping');
    } finally {
      setIsStarting(false);
    }
  };

  if (isPolling && jobId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-500 animate-pulse" />
              Importing Your Connections
            </CardTitle>
            <CardDescription>This usually takes 5-10 minutes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Progress</span>
                <span className="font-semibold text-slate-900 dark:text-white">{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Status Steps */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Logged into LinkedIn</span>
              </div>
              <div className="flex items-center gap-3">
                {progress > 30 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}
                <span className="text-sm text-slate-700 dark:text-slate-300">Loading connections...</span>
              </div>
              <div className="flex items-center gap-3">
                {progress > 70 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                )}
                <span className="text-sm text-slate-700 dark:text-slate-300">Extracting profiles...</span>
              </div>
              <div className="flex items-center gap-3">
                {progress >= 100 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Loader2 className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-sm text-slate-700 dark:text-slate-300">Processing matches...</span>
              </div>
            </div>

            {status && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
                {status}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/linkedin-import">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to method selection
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Quick Import via API</CardTitle>
            <CardDescription>
              Enter your LinkedIn credentials to automatically import your connections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Credentials Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">LinkedIn Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={linkedinEmail}
                  onChange={(e) => setLinkedinEmail(e.target.value)}
                  disabled={isStarting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">LinkedIn Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={linkedinPassword}
                  onChange={(e) => setLinkedinPassword(e.target.value)}
                  disabled={isStarting}
                />
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2 text-sm">
              <h4 className="font-semibold text-green-900 dark:text-green-200">Security Notice</h4>
              <ul className="text-green-800 dark:text-green-300 space-y-1">
                <li>• Your password is NEVER stored in our database</li>
                <li>• It&apos;s used only to authenticate with PhantomBuster</li>
                <li>• Encrypted in transit and deleted immediately after use</li>
              </ul>
            </div>

            {/* Risk Agreement */}
            <div className="border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-200">Important Disclaimer</h4>
                  <ul className="text-yellow-800 dark:text-yellow-300 space-y-1">
                    <li>• This method may violate LinkedIn&apos;s Terms of Service</li>
                    <li>• Your LinkedIn account could be restricted or banned</li>
                    <li>• There&apos;s a 10% failure rate due to 2FA/CAPTCHA</li>
                    <li>• We are not liable for any account issues</li>
                  </ul>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAgreed}
                  onChange={(e) => setIsAgreed(e.target.checked)}
                  className="rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
                  disabled={isStarting}
                />
                <span className="text-sm text-yellow-900 dark:text-yellow-200 font-medium">
                  I understand and accept these risks
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                <Link href="/linkedin-import/csv">
                  <Button variant="outline" className="mt-3" size="sm">
                    Use CSV Upload Instead
                  </Button>
                </Link>
              </div>
            )}

            <Button
              className="w-full gap-2"
              size="lg"
              disabled={!linkedinEmail || !linkedinPassword || !isAgreed || isStarting}
              onClick={handleStartScrape}
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Start Import
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
