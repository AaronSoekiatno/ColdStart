"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Copy, Download } from "lucide-react";
import { DiffBlock } from "@/components/DiffBlock";
import { Header } from "@/components/Header";
import { JakesResumeTemplate } from "@/components/JakesResumeTemplate";
import { EditableResumePreview } from "@/components/EditableResumePreview";
import type { StructuredResumeData } from "@/types/resume";
import type { ResumePatch, ResumePath } from "@/types/resume-patch";
import { applyPatches } from "@/lib/resume-patch";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface ResumeSuggestion {
  id: string;
  section: string;
  original: string;
  suggested: string;
  reason: string;
  keywords: string[];
  patch?: ResumePatch; // New patch-based field
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
  const [resumeText, setResumeText] = useState<string>('');
  const [structuredResumeData, setStructuredResumeData] = useState<StructuredResumeData | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<Set<ResumePath>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    // Check auth
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (!user || !startupId) {
        router.push("/matches");
        return;
      }
    });
  }, [router, startupId]);

  useEffect(() => {
    if (!startupId || !user) return;

    const loadEmailPreview = async () => {
      try {
        setIsPreviewLoading(true);

        const emailResponse = await fetch("/api/send-email/preview", {
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

        const emailData = await emailResponse.json();

        if (!emailResponse.ok) {
          throw new Error(emailData.error || 'Failed to generate email preview');
        }

        setPreviewSubject(emailData.subject);
        setPreviewBody(emailData.body);

        if (emailData.resumeUrl) {
          setResumeUrl(emailData.resumeUrl);
        }

        if (emailData.resumeText) {
          setResumeText(emailData.resumeText);
        }

        if (emailData.structuredResumeData) {
          console.log('Setting structured resume data:', emailData.structuredResumeData);
          setStructuredResumeData(emailData.structuredResumeData);
        } else {
          console.log('No structured resume data in response. Available keys:', Object.keys(emailData));
        }

        toast({
          title: "Email drafted",
          description: "Review your personalized email before sending.",
        });
      } catch (error) {
        console.error('Preview email error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate email preview';
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        router.push("/matches");
      } finally {
        setIsPreviewLoading(false);
      }
    };

    loadEmailPreview();
  }, [startupId, matchScore, user, toast, router]);

  const handleDownloadPDF = async () => {
    const acceptedSuggestions = resumeSuggestions.filter(
      s => suggestionStatuses[s.id] === 'accepted'
    );

    if (!resumeText) {
      toast({
        title: "Resume not available",
        description: "Resume text is not loaded.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generating PDF...",
        description: "Please wait while we create your PDF.",
      });

      const response = await fetch('/api/apply-resume-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          acceptedSuggestions: acceptedSuggestions.map(s => ({
            id: s.id,
            section: s.section,
            original: s.original,
            suggested: s.suggested,
            reason: s.reason,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate PDF');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = acceptedSuggestions.length > 0
        ? 'Edited_Resume.pdf'
        : 'Resume.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: acceptedSuggestions.length > 0
          ? "Your edited resume with all accepted changes has been downloaded as a PDF."
          : "Your resume has been downloaded as a PDF.",
      });
    } catch (error) {
      console.error('Download PDF error:', error);
      toast({
        title: "Failed to download PDF",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      });
    }
  };

  // Apply accepted suggestions to structured resume data using patches
  const applySuggestionsToStructuredData = (data: StructuredResumeData, suggestions: ResumeSuggestion[]): { updatedData: StructuredResumeData; highlightedFields: Set<ResumePath> } => {
    // Extract patches from suggestions (prefer patch-based, fallback to legacy)
    const patches: ResumePatch[] = [];
    
    for (const suggestion of suggestions) {
      if (suggestion.patch) {
        // Use patch-based suggestion
        patches.push(suggestion.patch);
      } else {
        // Legacy format: try to create a patch from original/suggested text
        // This is a fallback for backward compatibility
        console.warn(`Suggestion ${suggestion.id} missing patch, attempting legacy conversion`);
        // We'll skip legacy suggestions for now - they should all have patches
      }
    }
    
    // Apply all patches at once
    const result = applyPatches(data, patches);
    
    return {
      updatedData: result.updatedData,
      highlightedFields: result.modifiedPaths,
    };
  };

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
    <div className="h-screen overflow-hidden flex flex-col bg-white">
      <Header initialUser={user} />
      <div className="flex-1 overflow-hidden pt-16 sm:pt-20 md:pt-24">
        <div className="h-full w-full flex flex-col">
          {isPreviewLoading && previewSubject === null && previewBody === null ? (
            <div className="flex flex-col items-center justify-center flex-1 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-gray-600 text-sm">Loading your email and resume...</p>
            </div>
          ) : previewSubject && previewBody ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Two-column layout */}
              <div className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0 overflow-hidden">
                {/* LEFT: Email Preview */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-r border-gray-200 px-6 py-4">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">Review Email</h3>
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
                          onChange={(e) => setPreviewSubject(e.target.value)}
                          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 pr-10"
                          placeholder="Email subject"
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
                      <label className="text-xs text-gray-700 block">Body:</label>
                      <div className="relative flex-1 flex flex-col min-h-0">
                        <Textarea
                          value={previewBody || ''}
                          onChange={(e) => setPreviewBody(e.target.value)}
                          className="flex-1 min-h-0 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 resize-none pr-10"
                          placeholder="Email body"
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

                {/* RIGHT: Resume Preview & Suggestions */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 py-4">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-900">Edit Resume</h3>
                    <div className="flex items-center gap-2">
                      {resumeSuggestions.length > 0 && (
                        <>
                          <span className="text-xs text-gray-900 font-medium">
                            {Object.values(suggestionStatuses).filter(s => s === 'accepted').length} of {resumeSuggestions.length} accepted
                          </span>
                          {Object.values(suggestionStatuses).filter(s => s === 'accepted').length > 0 && (
                            <Button
                              onClick={handleDownloadPDF}
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download as PDF
                            </Button>
                          )}
                        </>
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
                      <div className="h-full overflow-y-auto">
                        <div className="space-y-6">
                          {resumeText && (
                            <div>
                              <div className="mb-3">
                                <h4 className="text-base font-semibold text-gray-900 mb-1">✨ Live Resume Preview</h4>
                                <p className="text-sm text-gray-600">
                                  Changes are applied in real-time as you accept suggestions. Green highlights show updated sections.
                                </p>
                              </div>
                              <div className="overflow-hidden">
                                {structuredResumeData && structuredResumeData.personal ? (
                                  <JakesResumeTemplate
                                    data={structuredResumeData}
                                    highlightedFields={highlightedFields}
                                  />
                                ) : resumeText ? (
                                  <EditableResumePreview
                                    originalText={resumeText}
                                    acceptedSuggestions={resumeSuggestions.filter(
                                      s => suggestionStatuses[s.id] === 'accepted'
                                    )}
                                  />
                                ) : (
                                  <div className="p-8 text-gray-600">
                                    Resume not available. Please upload your resume first.
                                  </div>
                                )}
                              </div>
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
                                        const newStatuses: Record<string, 'pending' | 'accepted' | 'rejected'> = { ...prev, [suggestion.id]: 'accepted' };
                                        // Apply suggestion to structured data using patches
                                        if (structuredResumeData) {
                                          const accepted = resumeSuggestions.filter(
                                            s => (newStatuses[s.id] === 'accepted')
                                          );
                                          const { updatedData, highlightedFields: newHighlighted } = applySuggestionsToStructuredData(
                                            structuredResumeData,
                                            accepted
                                          );
                                          setStructuredResumeData(updatedData);
                                          setHighlightedFields(newHighlighted);
                                        }
                                        return newStatuses;
                                      });
                                    }}
                                    onReject={() => {
                                      setSuggestionStatuses(prev => ({ ...prev, [suggestion.id]: 'rejected' }));
                                    }}
                                  />
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : resumeText ? (
                      <div className="h-full flex flex-col">
                        <div className="mb-3">
                          <h4 className="text-base font-semibold text-gray-900 mb-1">📄 Your Resume</h4>
                          <p className="text-sm text-gray-600">
                            Your resume, structured and styled for easy editing. Click "Tailor" to get AI-powered improvement suggestions for this startup.
                          </p>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          {structuredResumeData && structuredResumeData.personal ? (
                            <JakesResumeTemplate
                              data={structuredResumeData}
                              highlightedFields={new Set()}
                            />
                          ) : resumeText ? (
                            <EditableResumePreview
                              originalText={resumeText}
                              acceptedSuggestions={[]}
                            />
                          ) : (
                            <div className="p-8 text-gray-600">
                              Resume not available. Please upload your resume first.
                            </div>
                          )}
                        </div>
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
    </div>
  );
}

