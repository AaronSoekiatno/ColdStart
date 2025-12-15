'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';

interface EmailPreview {
  subject: string;
  html: string;
  text: string;
  hasApiKey: boolean;
  apiKeyStatus: string;
}

interface ConnectionTest {
  success: boolean;
  message: string;
  error?: string;
  domains?: Array<{ name: string; status: string }>;
}

export default function PreviewWaitlistEmailPage() {
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionTest, setConnectionTest] = useState<ConnectionTest | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    async function fetchEmailPreview() {
      try {
        const response = await fetch('/api/waitlist/preview');
        if (!response.ok) {
          throw new Error('Failed to fetch email preview');
        }
        const data = await response.json();
        setEmailPreview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchEmailPreview();
  }, []);

  async function testConnection() {
    setTestingConnection(true);
    setConnectionTest(null);
    try {
      const response = await fetch('/api/waitlist/test-connection');
      const data = await response.json();
      setConnectionTest(data);
    } catch (err) {
      setConnectionTest({
        success: false,
        message: 'Failed to test connection',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setTestingConnection(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600">Loading email preview...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !emailPreview) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error loading email preview: {error || 'Unknown error'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Waitlist Email Preview</h1>

          {/* API Connection Status */}
          <div className={`mb-6 p-4 rounded-lg border ${
            emailPreview.hasApiKey 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Resend API Connection Status</h2>
              {emailPreview.hasApiKey && (
                <button
                  onClick={testConnection}
                  disabled={testingConnection}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
              )}
            </div>
            <p className="text-sm">
              <span className="font-medium">API Key:</span>{' '}
              {emailPreview.hasApiKey ? (
                <span className="text-green-700">✓ Configured</span>
              ) : (
                <span className="text-yellow-700">⚠ Not configured (RESEND_API_KEY missing)</span>
              )}
            </p>
            <p className="text-sm mt-1">
              <span className="font-medium">Status:</span>{' '}
              <span className={emailPreview.hasApiKey ? 'text-green-700' : 'text-yellow-700'}>
                {emailPreview.apiKeyStatus}
              </span>
            </p>
            {!emailPreview.hasApiKey && (
              <p className="text-xs mt-2 text-yellow-800">
                Add RESEND_API_KEY to your .env.local file to enable email sending.
              </p>
            )}
            
            {/* Connection Test Results */}
            {connectionTest && (
              <div className={`mt-4 p-3 rounded-lg ${
                connectionTest.success 
                  ? 'bg-green-100 border border-green-300' 
                  : 'bg-red-100 border border-red-300'
              }`}>
                <p className={`text-sm font-medium ${
                  connectionTest.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {connectionTest.success ? '✓' : '✗'} {connectionTest.message}
                </p>
                {connectionTest.error && (
                  <p className="text-xs text-red-700 mt-1">{connectionTest.error}</p>
                )}
                {connectionTest.success && connectionTest.domains && connectionTest.domains.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-green-700 font-medium">Verified Domains:</p>
                    <ul className="text-xs text-green-700 mt-1 list-disc list-inside">
                      {connectionTest.domains.map((domain, idx) => (
                        <li key={idx}>{domain.name} ({domain.status})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Email Subject */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Subject Line</h2>
            <p className="text-lg font-medium">{emailPreview.subject}</p>
          </div>

          {/* Email HTML Preview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">HTML Preview</h2>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div 
                className="bg-white p-4"
                dangerouslySetInnerHTML={{ __html: emailPreview.html }}
              />
            </div>
          </div>

          {/* Plain Text Version */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Plain Text Version</h2>
            <pre className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm whitespace-pre-wrap font-mono">
              {emailPreview.text}
            </pre>
          </div>

          {/* Note about email placeholder */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> The <code className="bg-blue-100 px-1 rounded">{"{{email}}"}</code> placeholder 
              in the unsubscribe link will be replaced with the actual recipient email when sending.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
