'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUp, Upload, ExternalLink, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function CSVUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/linkedin/csv-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Redirect to results page
      router.push(`/linkedin-import/results?importId=${data.importId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-3xl mx-auto">
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
            <CardTitle className="text-2xl">Upload LinkedIn Connections CSV</CardTitle>
            <CardDescription>
              Follow the steps below to download and upload your LinkedIn connections data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Download from LinkedIn */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold">
                  1
                </div>
                <h3 className="text-lg font-semibold">Download Your LinkedIn Data</h3>
              </div>
              <div className="ml-10 space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Click the button below to go to LinkedIn&apos;s data download page:
                </p>
                <a
                  href="https://www.linkedin.com/mypreferences/d/download-my-data"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Go to LinkedIn Download Page
                  </Button>
                </a>
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2 text-sm">
                  <p className="font-medium text-slate-900 dark:text-white">On LinkedIn:</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                    <li>Select &quot;Request archive&quot; or &quot;Want something in particular?&quot;</li>
                    <li>Choose &quot;Connections&quot; only (faster download)</li>
                    <li>Click &quot;Request archive&quot;</li>
                    <li>LinkedIn will email you a download link in 10-15 minutes</li>
                    <li>Download the ZIP file and extract <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">Connections.csv</code></li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Step 2: Upload CSV */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold">
                  2
                </div>
                <h3 className="text-lg font-semibold">Upload Connections.csv</h3>
              </div>
              <div className="ml-10 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Once you have the <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">Connections.csv</code> file:
                </p>

                <div
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                  {selectedFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">{selectedFile.name}</span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                      >
                        Choose different file
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-slate-600 dark:text-slate-400 mb-2">
                        Click to select or drag and drop
                      </p>
                      <p className="text-sm text-slate-500">Connections.csv file from LinkedIn</p>
                    </>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={!selectedFile || uploading}
                  onClick={handleUpload}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload and Process Connections
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">What happens next?</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>• We&apos;ll parse your connections data</li>
                <li>• Match connections to our candidate database</li>
                <li>• Show you matches with full candidate profiles</li>
                <li>• Typically finds 5-10 matches per 1000 connections</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
