"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, X, Mail, AlertTriangle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { supabase, isSubscribed } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { BugReportModal } from "@/components/modals/BugReportModal";

function GenerateEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startupId = searchParams.get("startupId");
  const matchScoreParam = searchParams.get("matchScore");
  const matchScore = matchScoreParam ? parseFloat(matchScoreParam) : 0;
  const founderEmail = searchParams.get("founderEmail");
  const personaParam = searchParams.get("persona");

  const [user, setUser] = useState<User | null>(null);
  const [isSending, setIsSending] = useState(false);
  // Start with no preview loading until the user chooses an email style
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  type EmailPersona = 'direct-ask' | 'genuine-fan' | 'value-first';
  // Initialize emailPersona from URL param if valid, otherwise no selection yet
  const [emailPersona, setEmailPersona] = useState<EmailPersona | null>(() => {
    if (personaParam === 'genuine-fan' || personaParam === 'direct-ask' || personaParam === 'value-first') {
      console.log(`[Generate Email Page] Initializing - personaParam from URL: '${personaParam}', pre-selecting emailPersona to: '${personaParam}' (no API call yet)`);
      return personaParam as EmailPersona;
    }
    console.log(`[Generate Email Page] Initializing - no valid personaParam, starting with no persona selected`);
    return null;
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentResearchMessage, setCurrentResearchMessage] = useState(0);
  const { toast } = useToast();

  // Research messages that simulate AI thinking
  const researchMessages = [
    "Analyzing startup profile and recent updates...",
    "Researching founder background and expertise...",
    "Reviewing company mission and values...",
    "Examining market positioning and competition...",
    "Crafting personalized outreach strategy...",
  ];

  // Ref to prevent concurrent API calls
  const isLoadingRef = useRef(false);
  const currentRequestRef = useRef<string | null>(null);
  // Cache for generated emails by persona to avoid redundant API calls
  const emailCacheRef = useRef<Record<string, { subject: string; body: string }>>({});

  // Rotate research messages during loading
  useEffect(() => {
    if (isPreviewLoading && previewSubject === null && previewBody === null) {
      const interval = setInterval(() => {
        setCurrentResearchMessage((prev) => (prev + 1) % researchMessages.length);
      }, 2500); // Change message every 2.5 seconds

      return () => clearInterval(interval);
    } else {
      setCurrentResearchMessage(0); // Reset when not loading
    }
  }, [isPreviewLoading, previewSubject, previewBody]);

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


  const loadEmailPreview = async (overridePersona?: EmailPersona) => {
    if (!startupId || !user) return;

    // Determine which persona to use for this request:
    // 1) Explicit override from the click handler
    // 2) URL param if valid
    // 3) Local state
    const currentPersona: EmailPersona =
      overridePersona ??
      ((personaParam === 'genuine-fan' || personaParam === 'direct-ask' || personaParam === 'value-first'
        ? (personaParam as EmailPersona)
        : (emailPersona ?? 'direct-ask')));

    // Create a unique request key to deduplicate concurrent requests and for caching
    const requestKey = `${startupId}-${currentPersona}-${matchScore}`;

    // Check cache first
    const cachedEmail = emailCacheRef.current[requestKey];
    if (cachedEmail) {
      console.log('[Email Preview] Loading from cache for:', requestKey);
      // Show loading animation even when loading from cache (for consistent UX)
      setIsPreviewLoading(true);
      // Small delay to show loading animation (300ms feels natural)
      await new Promise(resolve => setTimeout(resolve, 300));
      setPreviewSubject(cachedEmail.subject);
      setPreviewBody(cachedEmail.body);
      setIsPreviewLoading(false);
      return;
    }

    // If we're already loading this exact request, skip it
    if (isLoadingRef.current && currentRequestRef.current === requestKey) {
      console.log('[Email Preview] Skipping duplicate request:', requestKey);
      return;
    }

    // If we're loading a different request, wait for it to finish
    if (isLoadingRef.current) {
      console.log('[Email Preview] Another request in progress, waiting...');
      // Wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return loadEmailPreview(overridePersona);
    }

    // Mark as loading and set current request
    isLoadingRef.current = true;
    currentRequestRef.current = requestKey;

    try {
      setIsPreviewLoading(true);
      // Don't reset subject/body to empty strings - let them stay null during initial loading
      // so the research messages can show

      // Use streaming endpoint
      console.log(`[Email Preview] Requesting email generation with persona: '${currentPersona}' (from URL param: '${personaParam}', state: '${emailPersona}') for startupId: ${startupId}`);
      const response = await fetch("/api/send-email/preview-stream", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startupId,
          matchScore,
          persona: currentPersona,
        }),
      });

      // CRITICAL: Check status code FIRST before reading body
      // If it's a 403, show upgrade modal IMMEDIATELY without reading stream
      // This ensures instant feedback when limit is exceeded
      if (response.status === 403) {
        setIsPreviewLoading(false);
        isLoadingRef.current = false;
        currentRequestRef.current = null;
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
                      isLoadingRef.current = false;
                      currentRequestRef.current = null;
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
              isLoadingRef.current = false;
              currentRequestRef.current = null;
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
                // Metadata received - can be used for future extensions
              } else if (data.type === 'chunk') {
                // Accumulate text as it streams in for debugging
                accumulatedText += data.text;
                // Don't try to parse JSON in real-time - just wait for the final result
              } else if (data.type === 'done') {
                // Final result
                const finalSubject = data.subject || '';
                const finalBody = data.body || '';
                // Cache the generated email
                emailCacheRef.current[requestKey] = {
                  subject: finalSubject,
                  body: finalBody,
                };
                setPreviewSubject(finalSubject);
                setPreviewBody(finalBody);
                setIsPreviewLoading(false);
                isLoadingRef.current = false;
                currentRequestRef.current = null;
                // Email is automatically saved to Supabase by the API route
                toast({
                  title: "Email drafted",
                  description: "Review your personalized email before sending.",
                });
                return;
              } else if (data.type === 'error') {
                // Handle error events from SSE stream
                setIsPreviewLoading(false);
                isLoadingRef.current = false;
                currentRequestRef.current = null;
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
      isLoadingRef.current = false;
      currentRequestRef.current = null;
    } catch (error) {
      console.error('Preview email error:', error);
      setIsPreviewLoading(false);
      isLoadingRef.current = false;
      currentRequestRef.current = null;
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

  // Sync persona with query param when it changes, but enforce premium restrictions
  useEffect(() => {
    console.log(`[Generate Email Page] Persona sync effect - personaParam: '${personaParam}', emailPersona: '${emailPersona}', isPremium: ${isPremium}`);
    if (personaParam === 'genuine-fan' || personaParam === 'direct-ask' || personaParam === 'value-first') {
      // Only allow 'genuine-fan' and 'value-first' for premium users
      if ((personaParam === 'genuine-fan' || personaParam === 'value-first') && !isPremium) {
        // Free users can't use premium personas - force to 'direct-ask'
        if (emailPersona !== 'direct-ask') {
          console.log(`[Generate Email Page] Free user tried to use '${personaParam}', forcing to 'direct-ask'`);
          setEmailPersona('direct-ask');
        }
      } else {
        // Only update if different to prevent unnecessary re-renders
        if (emailPersona !== personaParam) {
          console.log(`[Generate Email Page] Syncing emailPersona from '${emailPersona}' to '${personaParam}'`);
          setEmailPersona(personaParam as EmailPersona);
        }
      }
    } else {
      // If no valid persona in URL, clear local selection (user must choose)
      if (emailPersona !== null) {
        console.log(`[Generate Email Page] Invalid or missing personaParam '${personaParam}', clearing emailPersona selection`);
        setEmailPersona(null);
      }
    }
  }, [personaParam, isPremium]); // Removed emailPersona from deps to prevent loops

  const handleSendViaMailto = () => {
    if (!founderEmail || !previewSubject || !previewBody) return;

    try {
      // URL encode the subject and body for mailto
      const encodedSubject = encodeURIComponent(previewSubject);
      const encodedBody = encodeURIComponent(previewBody);

      // Create mailto URL
      const mailtoUrl = `mailto:${founderEmail}?subject=${encodedSubject}&body=${encodedBody}`;

      // Open in new browser tab
      window.open(mailtoUrl, '_blank');

      toast({
        title: "Email app opened",
        description: "Your email client should open in a new tab with the pre-filled email.",
      });
    } catch (error) {
      toast({
        title: "Failed to open email app",
        description: "Please try copying the email content manually.",
        variant: "destructive",
      });
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
    <div className="h-screen overflow-hidden flex flex-col bg-white">
      <Header initialUser={user} />
      <div className="flex-1 overflow-hidden pt-16 sm:pt-20 md:pt-24">
        <div className="h-full w-full flex flex-col">
          <div className="flex-1 flex flex-col min-h-0 w-full h-full">
            {/* Email Preview */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 sm:px-8 md:px-12 lg:px-16 py-6 sm:py-8">
                <div className="flex items-center justify-between mb-6 flex-shrink-0">
                  <h3 className="text-3xl sm:text-4xl font-semibold text-gray-900">Review Email</h3>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleSendViaMailto}
                      disabled={!founderEmail || isPreviewLoading || !previewSubject || !previewBody}
                      className="bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-md px-4"
                    >
                      <span className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Open in Email App
                      </span>
                    </Button>
                    <Button
                      onClick={handleSendEmail}
                      disabled={isSending || isPreviewLoading || !previewSubject || !previewBody}
                      variant="outline"
                      className="border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-md px-4"
                    >
                      {isSending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        "Already Sent"
                      )}
                    </Button>
                    <button
                      onClick={() => router.push('/matches')}
                      className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900 cursor-pointer"
                      aria-label="Close and return to matches"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {/* Persona selection - users must choose a style before an email is generated */}
                <div className="mb-4 flex-shrink-0">
                  <p className="text-[15px] text-gray-900 font-medium mb-1.5">
                    Choose an email style to generate your draft:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {/* Direct Ask - available to all users */}
                    <button
                      type="button"
                      onClick={async () => {
                        // If switching to a different persona, clear previous content to show loading animation
                        if (emailPersona !== 'direct-ask') {
                          setPreviewSubject(null);
                          setPreviewBody(null);
                        }
                        // Show loading animation immediately
                        setIsPreviewLoading(true);
                        // Update local state immediately for UI
                        setEmailPersona('direct-ask');

                        // Sync persona into URL so future loads are consistent
                        const params = new URLSearchParams(Array.from(searchParams.entries()));
                        params.set('persona', 'direct-ask');
                        const query = params.toString();
                        router.replace(`/generate-email?${query}`, { scroll: false });

                        // Trigger preview generation explicitly after selection
                        await loadEmailPreview('direct-ask');
                      }}
                      className={`flex-1 min-w-[140px] rounded-md border px-3 py-2 text-left text-[11px] sm:text-xs cursor-pointer ${emailPersona === 'direct-ask'
                          ? 'border-blue-500 bg-blue-50 text-gray-900'
                          : 'border-blue-300 bg-white text-gray-800 hover:border-blue-400 hover:bg-gray-50'
                        }`}
                    >
                      <div className="font-semibold mb-0.5">Direct Ask</div>
                      <div className="text-[10px] text-gray-600">
                        Get straight to the point. Respectful and efficient.
                      </div>
                    </button>

                    {/* Genuine Fan - premium */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isPremium) {
                          setShowUpgradeModal(true);
                          return;
                        }

                        // If switching to a different persona, clear previous content to show loading animation
                        if (emailPersona !== 'genuine-fan') {
                          setPreviewSubject(null);
                          setPreviewBody(null);
                        }
                        // Show loading animation immediately
                        setIsPreviewLoading(true);
                        setEmailPersona('genuine-fan');
                        const params = new URLSearchParams(Array.from(searchParams.entries()));
                        params.set('persona', 'genuine-fan');
                        const query = params.toString();
                        router.replace(`/generate-email?${query}`, { scroll: false });

                        await loadEmailPreview('genuine-fan');
                      }}
                      className={`flex-1 min-w-[140px] rounded-md border px-3 py-2 text-left text-[11px] sm:text-xs cursor-pointer ${!isPremium
                          ? 'border-blue-300 bg-gray-50 text-gray-400'
                          : emailPersona === 'genuine-fan'
                            ? 'border-blue-500 bg-blue-50 text-gray-900'
                            : 'border-blue-300 bg-white text-gray-800 hover:border-blue-400 hover:bg-gray-50'
                        }`}
                    >
                      <div className="font-semibold mb-0.5">
                        Genuine Fan
                      </div>
                      <div className={`text-[10px] ${!isPremium ? 'text-gray-400' : 'text-gray-600'}`}>
                        Show authentic interest and personal connection.
                      </div>
                    </button>

                    {/* Value-First - premium */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isPremium) {
                          setShowUpgradeModal(true);
                          return;
                        }

                        // If switching to a different persona, clear previous content to show loading animation
                        if (emailPersona !== 'value-first') {
                          setPreviewSubject(null);
                          setPreviewBody(null);
                        }
                        // Show loading animation immediately
                        setIsPreviewLoading(true);
                        setEmailPersona('value-first');
                        const params = new URLSearchParams(Array.from(searchParams.entries()));
                        params.set('persona', 'value-first');
                        const query = params.toString();
                        router.replace(`/generate-email?${query}`, { scroll: false });

                        await loadEmailPreview('value-first');
                      }}
                      className={`flex-1 min-w-[140px] rounded-md border px-3 py-2 text-left text-[11px] sm:text-xs cursor-pointer ${!isPremium
                          ? 'border-blue-300 bg-gray-50 text-gray-400'
                          : emailPersona === 'value-first'
                            ? 'border-blue-500 bg-blue-50 text-gray-900'
                            : 'border-blue-300 bg-white text-gray-800 hover:border-blue-400 hover:bg-gray-50'
                        }`}
                    >
                      <div className="font-semibold mb-0.5">
                        Value-First
                      </div>
                      <div className={`text-[10px] ${!isPremium ? 'text-gray-400' : 'text-gray-600'}`}>
                        Lead with what you can bring to the table.
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col space-y-4 min-h-0">
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
                  <div className="space-y-1.5 flex-shrink-0">
                    <label className="text-xs text-gray-700 block">Subject:</label>
                    <div className="relative">
                      <Input
                        value={previewSubject || ''}
                        onChange={(e) => {
                          setPreviewSubject(e.target.value);
                          // Subject editing is local only - Supabase stores the generated version
                        }}
                        className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-300 pr-10"
                        placeholder={
                          isPreviewLoading
                            ? "Generating subject..."
                            : previewSubject
                              ? "Email subject"
                              : "Choose an email style above to generate your subject"
                        }
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
                    <label className="text-xs text-gray-700 flex items-start justify-between gap-3">
                      <span className="flex items-center gap-2">
                        Body:
                        {isPreviewLoading && (
                          <Loader2 className="h-3.5 w-3.5 text-blue-300 animate-spin" />
                        )}
                      </span>
                      <span className="flex items-start gap-3 text-[10px] sm:text-[11px] text-gray-600 text-right max-w-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        <span>
                          <span className="font-medium">85% email accuracy.</span>{" "}
                          If your email bounces, please{" "}
                          <button
                            type="button"
                            onClick={() => setShowFeedbackModal(true)}
                            className="text-blue-600 hover:text-blue-700 underline font-medium"
                          >
                            alert us
                          </button>
                          .
                        </span>
                      </span>
                    </label>
                    <div className="relative flex-1 flex flex-col min-h-0">
                      <Textarea
                        value={previewBody || ''}
                        onChange={(e) => {
                          setPreviewBody(e.target.value);
                          // Body editing is local only - Supabase stores the generated version
                        }}
                        className="flex-1 min-h-0 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-300 resize-none pr-10 text-base sm:text-lg"
                        placeholder={
                          isPreviewLoading
                            ? researchMessages[currentResearchMessage]
                            : previewBody
                              ? "Email body"
                              : "Choose an email style above to generate your email"
                        }
                        style={isPreviewLoading && !previewBody ? {
                          background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer-bg 2s linear infinite',
                        } : undefined}
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
            </div>
          </div>
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
      <BugReportModal
        open={showFeedbackModal}
        onOpenChange={setShowFeedbackModal}
        bouncedEmail={founderEmail || undefined}
        startupId={startupId || undefined}
      />
    </div>
  );
}

export default function GenerateEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <GenerateEmailPageContent />
    </Suspense>
  );
}
