'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUp, Zap, Check, AlertTriangle } from 'lucide-react';

export default function LinkedInImportPage() {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<'csv' | 'api' | null>(null);

  const handleMethodSelect = (method: 'csv' | 'api') => {
    setSelectedMethod(method);
    if (method === 'csv') {
      router.push('/linkedin-import/csv');
    } else {
      router.push('/linkedin-import/scrape');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Import Your LinkedIn Network
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Find hiring opportunities in your immediate network by matching your connections to our candidate database
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* CSV Upload Method */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedMethod === 'csv' ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleMethodSelect('csv')}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <FileUp className="w-6 h-6 text-green-600 dark:text-green-300" />
                </div>
                <div>
                  <CardTitle className="text-xl">CSV Upload</CardTitle>
                  <div className="text-sm text-green-600 dark:text-green-400 font-semibold">
                    Recommended
                  </div>
                </div>
              </div>
              <CardDescription>
                Manual upload of your LinkedIn data export
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    100% reliable - always works
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Most secure - no password needed
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Complete data including emails
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Takes 10-15 minutes (LinkedIn prep time)
                  </span>
                </div>
              </div>
              <Button className="w-full" variant="default">
                Select CSV Upload
              </Button>
            </CardContent>
          </Card>

          {/* API Scrape Method */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedMethod === 'api' ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleMethodSelect('api')}
          >
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Zap className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <CardTitle className="text-xl">Quick Import</CardTitle>
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-semibold">
                    Fast
                  </div>
                </div>
              </div>
              <CardDescription>
                Automated scraping via PhantomBuster API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Fast - 5-10 minutes total
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Fully automated process
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Requires LinkedIn password
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    May fail (10% chance - 2FA/CAPTCHA)
                  </span>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                Select Quick Import
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Important Information */}
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="w-5 h-5" />
              Important Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">CSV Upload Method:</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                <li>You download your own data from LinkedIn</li>
                <li>100% compliant with LinkedIn&apos;s terms</li>
                <li>We never access your LinkedIn account</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Quick Import Method:</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                <li>We log into LinkedIn on your behalf</li>
                <li>This may violate LinkedIn&apos;s Terms of Service</li>
                <li>Your LinkedIn account could be restricted</li>
                <li>We don&apos;t store your password (used transiently only)</li>
                <li>We&apos;re not liable for any account issues</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
