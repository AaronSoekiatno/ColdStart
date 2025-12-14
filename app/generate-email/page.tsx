"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Copy } from "lucide-react";
import { DiffBlock } from "@/components/DiffBlock";
import { Header } from "@/components/Header";
import { supabase, isSubscribed } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { UpgradeModal } from "@/components/UpgradeModal";

interface ResumeSuggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
  keywords: string[];
}

export default function GenerateEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startupId = searchParams.get("startupId");
  const matchScoreParam = searchParams.get("matchScore");
  const matchScore = matchScoreParam ? parseFloat(matchScoreParam) : 0;
  const founderEmail = searchParams.get("founderEmail");
  
  const [user, setUser] = useState<User | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [resumeSuggestions, setResumeSuggestions] = useState<ResumeSuggestion[]>([]);
  const [suggestionStatuses, setSuggestionStatuses] = useState<Record<string, 'pending' | 'accepted' | 'rejected'>>({});
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsRequested, setSuggestionsRequested] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [emailTone, setEmailTone] = useState<'professional' | 'classy' | 'informative' | 'ambitious' | 'conversational'>('professional');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { toast } = useToast();


  useEffect(() => {
    // Check auth and premium status
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (!user || !startupId) {
        router.push("/matches");
        return;
      }

      // Fetch premium status
      try {
        const response = await fetch('/api/candidate-info', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (response.ok) {
          const candidateInfo = await response.json();
          setIsPremium(isSubscribed(candidateInfo));
        }
      } catch (error) {
        console.error('Error fetching premium status:', error);
      }

      // Don't try to load here - let the main useEffect handle it
      // This useEffect is just for auth and premium status
    });
  }, [router, startupId]);

  const loadEmailPreview = async () => {
    if (!startupId || !user) return;

    try {
      setIsPreviewLoading(true);
      setPreviewSubject('');
      setPreviewBody('');

      // Use streaming endpoint
      const response = await fetch("/api/send-email/preview-stream", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startupId,
          matchScore,
          tone: isPremium ? emailTone : undefined,
        }),
      });

      // CRITICAL: Check status code FIRST before reading body
      // If it's a 403, show upgrade modal IMMEDIATELY without reading stream
      // This ensures instant feedback when limit is exceeded
      if (response.status === 403) {
        setIsPreviewLoading(false);
        setShowUpgradeModal(true);
        // Cancel any pending stream reading to free resources
        // We don't need to read the error message - we already know it's a limit error
        if (response.body) {
          const reader = response.body.getReader();
          reader.cancel().catch(() => {
            // Ignore cancellation errors - we don't need the stream
          });
        }
        return; // Exit immediately - modal is already shown
      }

      if (!response.ok) {
        
        // Handle other error statuses (not 403)
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/event-stream')) {
          // Handle SSE error stream for other errors
          const reader = response.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'error' && data.upgradeRequired) {
                      setShowUpgradeModal(true);
                      setIsPreviewLoading(false);
                      return;
                    }
                  } catch (e) {
                    // Ignore parse errors in error handling
                  }
                }
              }
            }
          }
        } else {
          // Handle JSON error response
          try {
            const errorData = await response.json();
            if (errorData.upgradeRequired) {
              setShowUpgradeModal(true);
              setIsPreviewLoading(false);
              return;
            }
            throw new Error(errorData.error || 'Failed to generate email preview');
          } catch (jsonError) {
            throw new Error('Failed to generate email preview');
          }
        }
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let receivedResumeUrl: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'metadata') {
                if (data.resumeUrl) {
                  receivedResumeUrl = data.resumeUrl;
                  setResumeUrl(data.resumeUrl);
                }
              } else if (data.type === 'chunk') {
                // Accumulate text as it streams in
                accumulatedText += data.text;
                
                // Try to extract body text from JSON for real-time display
                // This creates a ChatGPT-like streaming effect
                try {
                  // Look for the body field and extract its value as it streams
                  const bodyStartIndex = accumulatedText.indexOf('"body"');
                  if (bodyStartIndex !== -1) {
                    // Find the start of the body value (after "body":")
                    const valueStart = accumulatedText.indexOf('"', bodyStartIndex + 7) + 1;
                    if (valueStart > 0) {
                      // Extract everything after the opening quote
                      let bodyValue = accumulatedText.substring(valueStart);
                      // Remove any trailing JSON structure (closing quote, brace, etc.)
                      bodyValue = bodyValue.replace(/"[^"]*$/, '').replace(/"}?\s*$/, '');
                      // Unescape JSON string characters
                      bodyValue = bodyValue
                        .replace(/\\n/g, '\n')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\')
                        .replace(/\\t/g, '\t');
                      if (bodyValue) {
                        setPreviewBody(bodyValue);
                      }
                    }
                  }
                  
                  // Try to extract subject
                  const subjectMatch = accumulatedText.match(/"subject"\s*:\s*"([^"]*)"/);
                  if (subjectMatch && subjectMatch[1]) {
                    setPreviewSubject(subjectMatch[1]);
                  }
                } catch {
                  // If extraction fails, the final 'done' event will have the correct values
                }
              } else if (data.type === 'done') {
                // Final result
                const finalSubject = data.subject || '';
                const finalBody = data.body || '';
                setPreviewSubject(finalSubject);
                setPreviewBody(finalBody);
                setIsPreviewLoading(false);
                // Email is automatically saved to Supabase by the API route
                toast({
                  title: "Email drafted",
                  description: "Review your personalized email before sending.",
                });
                return;
              } else if (data.type === 'error') {
                // Handle error events from SSE stream
                setIsPreviewLoading(false);
                if (data.upgradeRequired) {
                  setShowUpgradeModal(true);
                  return; // Don't throw, just show modal
                }
                throw new Error(data.error || 'Unknown error');
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }

      setIsPreviewLoading(false);
    } catch (error) {
      console.error('Preview email error:', error);
      setIsPreviewLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate email preview';
      
      // Check if this is a limit exceeded error - if so, show upgrade modal instead of redirecting
      if (errorMessage.includes('3 email generations per day') || errorMessage.includes('Upgrade to Premium')) {
        setShowUpgradeModal(true);
        return; // Don't redirect, just show modal
      }
      
      // Don't redirect if it's just a premium feature error
      if (!errorMessage.includes('Premium feature')) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        router.push("/matches");
      } else {
        toast({
          title: "Premium Feature",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    // Load email when component mounts or when startupId/user changes
    // The API route will check Supabase for existing email, or generate new one if not found
    if (user && startupId) {
      loadEmailPreview();
    }
  }, [startupId, matchScore, user, isPremium, emailTone]);

  const handleLoadSuggestions = async () => {
    if (!startupId) return;

    try {
      setIsLoadingSuggestions(true);
      setSuggestionsRequested(true);

      const response = await fetch("/api/resume-suggestions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startupId,
          matchScore,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load resume suggestions');
      }

      setResumeSuggestions(data.suggestions || []);
      const initialStatuses: Record<string, 'pending'> = {};
      (data.suggestions || []).forEach((s: ResumeSuggestion) => {
        initialStatuses[s.id] = 'pending';
      });
      setSuggestionStatuses(initialStatuses);
    } catch (error) {
      console.error('Error loading suggestions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load resume suggestions';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setSuggestionsRequested(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSendEmail = async () => {
    if (!startupId || !previewSubject || !previewBody) return;

    try {
      setIsSending(true);

      const response = await fetch("/api/send-email", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startupId,
          subject: previewSubject,
          body: previewBody,
          matchScore,
          founderEmail: founderEmail || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save email');
      }

      toast({
        title: "Email saved!",
        description: "Your email has been saved successfully.",
      });

      // Redirect to tracker page
      router.push("/tracker");
    } catch (error) {
      console.error('Save email error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save email';
      toast({
        title: "Failed to save email",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!user || !startupId) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      <Header initialUser={user} />
      <div className="flex-1 overflow-hidden pt-16 sm:pt-20 md:pt-24">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col">
          {isPreviewLoading && previewSubject === null && previewBody === null ? (
            <div className="flex flex-col items-center justify-center flex-1 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-gray-600 text-sm">Generating your email...</p>
            </div>
          ) : (previewSubject || previewBody || isPreviewLoading) ? (
            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
              {/* Two-column layout */}
              <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 min-h-0 overflow-hidden">
                {/* LEFT: Email Preview */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <h3 className="text-sm font-semibold mb-2 text-gray-900">Review Email</h3>
                  <div className="flex-1 flex flex-col space-y-3 min-h-0">
                    {founderEmail && (
                      <div className="space-y-1.5 flex-shrink-0">
                        <label className="text-xs text-gray-700 block">To:</label>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                          <span className="text-sm text-gray-900 font-medium flex-1">
                            {founderEmail}
                          </span>
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(founderEmail);
                                toast({
                                  title: "Copied!",
                                  description: "Founder email copied to clipboard.",
                                });
                              } catch (err) {
                                toast({
                                  title: "Failed to copy",
                                  description: "Could not copy email to clipboard.",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="flex-shrink-0 p-1.5 rounded transition-colors cursor-pointer mr-1"
                            aria-label="Copy email"
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    )}
                    {isPremium && (previewSubject || previewBody) && (
                      <div className="space-y-1.5 flex-shrink-0">
                        <label className="text-xs text-gray-700 block">Email Tone:</label>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              const newTone = 'professional';
                              if (newTone !== emailTone) {
                                setEmailTone(newTone);
                              }
                            }}
                            disabled={isPreviewLoading}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              emailTone === 'professional'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            } ${isPreviewLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Professional
                          </button>
                          <button
                            onClick={() => {
                              const newTone = 'classy';
                              if (newTone !== emailTone) {
                                setEmailTone(newTone);
                              }
                            }}
                            disabled={isPreviewLoading}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              emailTone === 'classy'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            } ${isPreviewLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Classy
                          </button>
                          <button
                            onClick={() => {
                              const newTone = 'informative';
                              if (newTone !== emailTone) {
                                setEmailTone(newTone);
                              }
                            }}
                            disabled={isPreviewLoading}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              emailTone === 'informative'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            } ${isPreviewLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Informative
                          </button>
                          <button
                            onClick={() => {
                              const newTone = 'ambitious';
                              if (newTone !== emailTone) {
                                setEmailTone(newTone);
                              }
                            }}
                            disabled={isPreviewLoading}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              emailTone === 'ambitious'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            } ${isPreviewLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Ambitious
                          </button>
                          <button
                            onClick={() => {
                              const newTone = 'conversational';
                              if (newTone !== emailTone) {
                                setEmailTone(newTone);
                              }
                            }}
                            disabled={isPreviewLoading}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              emailTone === 'conversational'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            } ${isPreviewLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            Conversational
                          </button>
                        </div>
                        {isPreviewLoading && (
                          <p className="text-xs text-gray-500">Regenerating email with new tone...</p>
                        )}
                      </div>
                    )}
                    <div className="space-y-1.5 flex-shrink-0">
                      <label className="text-xs text-gray-700 block">Subject:</label>
                      <div className="relative">
                        <Input
                          value={previewSubject || ''}
                          onChange={(e) => {
                            setPreviewSubject(e.target.value);
                            // Subject editing is local only - Supabase stores the generated version
                          }}
                          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 pr-10"
                          placeholder={isPreviewLoading ? "Generating..." : "Email subject"}
                        />
                        <button
                          onClick={async () => {
                            if (!previewSubject) return;
                            try {
                              await navigator.clipboard.writeText(previewSubject);
                              toast({
                                title: "Copied!",
                                description: "Subject copied to clipboard.",
                              });
                            } catch (err) {
                              toast({
                                title: "Failed to copy",
                                description: "Could not copy subject to clipboard.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded transition-colors cursor-pointer"
                          aria-label="Copy subject"
                          disabled={!previewSubject}
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
                      <label className="text-xs text-gray-700 block">
                        Body:
                        {isPreviewLoading && (
                          <span className="ml-2 text-blue-500 text-xs">Generating...</span>
                        )}
                      </label>
                      <div className="relative flex-1 flex flex-col min-h-0">
                        <Textarea
                          value={previewBody || ''}
                          onChange={(e) => {
                            setPreviewBody(e.target.value);
                            // Body editing is local only - Supabase stores the generated version
                          }}
                          className="flex-1 min-h-0 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 resize-none pr-10"
                          placeholder={isPreviewLoading ? "Your email will appear here as it's generated..." : "Email body"}
                        />
                        <button
                          onClick={async () => {
                            if (!previewBody) return;
                            try {
                              await navigator.clipboard.writeText(previewBody);
                              toast({
                                title: "Copied!",
                                description: "Body copied to clipboard.",
                              });
                            } catch (err) {
                              toast({
                                title: "Failed to copy",
                                description: "Could not copy body to clipboard.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="absolute right-4 top-2 p-1.5 rounded transition-colors cursor-pointer"
                          aria-label="Copy body"
                          disabled={!previewBody}
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DIVIDER */}
                <div className="hidden lg:block w-px bg-gray-200" />

                {/* RIGHT: Resume Preview & Suggestions */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-gray-900">Edit Resume</h3>
                    <div className="flex items-center gap-2">
                      {resumeSuggestions.length > 0 && (
                        <span className="text-xs text-gray-600">
                          {Object.values(suggestionStatuses).filter(s => s === 'accepted').length} of {resumeSuggestions.length} accepted
                        </span>
                      )}
                      {!suggestionsRequested && resumeUrl && (
                        <Button
                          onClick={handleLoadSuggestions}
                          disabled={isLoadingSuggestions}
                          size="sm"
                          className="bg-blue-500 hover:opacity-75 text-white h-8 text-sm font-medium transition-opacity"
                        >
                          {isLoadingSuggestions ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Tailoring...
                            </span>
                          ) : (
                            "Tailor"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    {resumeSuggestions.length > 0 ? (
                      <div className="h-full overflow-y-auto space-y-4 pr-2">
                        {resumeUrl && (
                          <div className="h-[300px] rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                            <iframe
                              src={resumeUrl}
                              className="w-full h-full bg-white"
                              title="Resume Preview"
                            />
                          </div>
                        )}
                        {resumeSuggestions
                          .filter(suggestion => suggestionStatuses[suggestion.id] === 'accepted')
                          .length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                              Accepted Changes
                            </h4>
                            {resumeSuggestions
                              .filter(suggestion => suggestionStatuses[suggestion.id] === 'accepted')
                              .map((suggestion) => (
                                <div
                                  key={suggestion.id}
                                  className="border border-green-500/30 bg-green-50 rounded-lg p-3"
                                >
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className="text-xs text-gray-700 font-medium">{suggestion.section}</span>
                                    <span className="text-xs text-green-600">✓ Accepted</span>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="text-sm text-gray-600 line-through text-gray-400">
                                      {suggestion.original}
                                    </div>
                                    <div className="text-sm text-green-700 font-medium">
                                      {suggestion.suggested}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                        {resumeSuggestions
                          .filter(suggestion => suggestionStatuses[suggestion.id] === 'pending')
                          .length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                              Pending Review
                            </h4>
                            {resumeSuggestions
                              .filter(suggestion => suggestionStatuses[suggestion.id] === 'pending')
                              .map((suggestion) => (
                                <DiffBlock
                                  key={suggestion.id}
                                  suggestion={suggestion}
                                  status="pending"
                                  onAccept={() => {
                                    setSuggestionStatuses(prev => {
                                      return { ...prev, [suggestion.id]: 'accepted' as const };
                                    });
                                  }}
                                  onReject={() => {
                                    setSuggestionStatuses(prev => {
                                      return { ...prev, [suggestion.id]: 'rejected' as const };
                                    });
                                  }}
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    ) : resumeUrl ? (
                      <div className="h-full rounded-lg overflow-hidden border border-gray-200">
                        <iframe
                          src={resumeUrl}
                          className="w-full h-full bg-white"
                          title="Resume Preview"
                          onError={() => {
                            // If the signed URL expired, clear it and show message
                            console.warn('Resume URL may have expired');
                            setResumeUrl(null);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <p className="text-gray-600 text-sm">No resume found</p>
                        <p className="text-gray-500 text-xs mt-2">Please upload your resume first</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between w-full">
                  <div className="text-xs text-gray-500">
                    {resumeSuggestions.length > 0 && (
                      <>Note: Resume improvements are for your reference only</>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => router.push("/matches")}
                      className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendEmail}
                      disabled={isSending || isPreviewLoading}
                      className="bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </span>
                      ) : (
                        "Sent Email"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {showUpgradeModal && user && (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          hiddenMatchCount={0}
          email={user.email || ''}
          customTitle="Upgrade to Premium"
          isPremium={isPremium}
          onDismiss={() => {
            // Redirect to matches page when modal is dismissed
            router.push('/matches');
          }}
        />
      )}
    </div>
  );
}

