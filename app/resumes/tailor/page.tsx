"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, ArrowLeft, Pencil, Undo } from "lucide-react";
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
  patch?: ResumePatch;
}

function EnhanceResumePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId");

  const [user, setUser] = useState<User | null>(null);
  const [resumeSuggestions, setResumeSuggestions] = useState<ResumeSuggestion[]>([]);
  const [suggestionStatuses, setSuggestionStatuses] = useState<Record<string, 'pending' | 'accepted' | 'rejected'>>({});
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsRequested, setSuggestionsRequested] = useState(false);
  const [resumeText, setResumeText] = useState<string>('');
  const [structuredResumeData, setStructuredResumeData] = useState<StructuredResumeData | null>(null);
  const [originalStructuredResumeData, setOriginalStructuredResumeData] = useState<StructuredResumeData | null>(null);
  const [highlightedFields, setHighlightedFields] = useState<Set<ResumePath>>(new Set());
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [acceptHistory, setAcceptHistory] = useState<string[]>([]);
  const { toast } = useToast();

  // Helper function to apply suggestions to structured resume data
  const applySuggestionsToStructuredData = (
    data: StructuredResumeData,
    suggestions: ResumeSuggestion[]
  ): { updatedData: StructuredResumeData; highlightedFields: Set<ResumePath> } => {
    const patches = suggestions
      .filter(s => s.patch)
      .map(s => s.patch!);

    const result = applyPatches(data, patches);

    return {
      updatedData: result.updatedData,
      highlightedFields: result.modifiedPaths,
    };
  };

  const rebuildFromStatuses = (
    statuses: Record<string, 'pending' | 'accepted' | 'rejected'>,
    suggestionsList: ResumeSuggestion[]
  ) => {
    if (!originalStructuredResumeData) return;
    const active = suggestionsList.filter(
      s => statuses[s.id] === 'accepted' || statuses[s.id] === 'pending'
    );
    const { updatedData } = applySuggestionsToStructuredData(
      originalStructuredResumeData,
      active
    );
    // Only highlight suggestions that are still pending; accepted and denied lose highlights
    const highlightPaths = suggestionsList
      .filter(s => statuses[s.id] === 'pending' && s.patch)
      .map(s => s.patch!.path);

    setStructuredResumeData(updatedData);
    setHighlightedFields(new Set(highlightPaths));
  };

  const handleLoadSuggestions = async (currentStructuredData?: StructuredResumeData) => {
    if (!resumeId) return;

    // Use provided data or fall back to state
    const dataToUse = currentStructuredData || structuredResumeData;

    try {
      setIsLoadingSuggestions(true);
      setSuggestionsRequested(true);

      const response = await fetch("/api/resume-suggestions-general", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          resumeId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load resume suggestions');
      }

      const suggestions = data.suggestions || [];
      setResumeSuggestions(suggestions);

      // Apply all suggestions immediately to preview
      if (dataToUse && suggestions.length > 0) {
        const { updatedData, highlightedFields: newHighlighted } = applySuggestionsToStructuredData(
          dataToUse,
          suggestions
        );
        setStructuredResumeData(updatedData);
        setHighlightedFields(newHighlighted);

        // Set all as 'pending' initially (they're applied but not confirmed)
        const initialStatuses: Record<string, 'pending'> = {};
        suggestions.forEach((s: ResumeSuggestion) => {
          initialStatuses[s.id] = 'pending';
        });
        setSuggestionStatuses(initialStatuses);
      } else {
        // Fallback: set all as pending without applying
        const initialStatuses: Record<string, 'pending'> = {};
        suggestions.forEach((s: ResumeSuggestion) => {
          initialStatuses[s.id] = 'pending';
        });
        setSuggestionStatuses(initialStatuses);
      }
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

  // Handler for downloading PDF with applied suggestions
  const handleDownloadPDF = async () => {
    if (!structuredResumeData || !user) return;

    try {
      // Get accepted suggestions
      const acceptedSuggestions = resumeSuggestions.filter(
        s => suggestionStatuses[s.id] === 'accepted'
      );

      if (acceptedSuggestions.length === 0) {
        toast({
          title: "No changes to download",
          description: "Please accept some suggestions before downloading.",
          variant: "destructive",
        });
        return;
      }

      // Call API to generate and download PDF
      const response = await fetch("/api/apply-resume-suggestions", {
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'updated_resume.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF downloaded",
        description: "Your updated resume has been downloaded.",
      });
    } catch (error) {
      console.error('Download PDF error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to download PDF';
      toast({
        title: "Failed to download PDF",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Check auth
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (!user || !resumeId) {
        router.push("/resumes");
        return;
      }

      // Fetch the resume data and structured data
      try {
        const response = await fetch(`/api/resumes/get-resume?resumeId=${resumeId}`, {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch resume data');
        }

        const data = await response.json();

        if (data.resumeText) {
          setResumeText(data.resumeText);
        }

        if (data.structuredResumeData) {
          setStructuredResumeData(data.structuredResumeData);
          setOriginalStructuredResumeData(data.structuredResumeData);

          // Automatically load suggestions after resume data is loaded
          // Pass the structured data directly to avoid race condition with state updates
          handleLoadSuggestions(data.structuredResumeData);
        } else if (resumeId) {
          // If no structured data, still try to load suggestions
          handleLoadSuggestions();
        }
      } catch (error) {
        console.error('Error fetching resume data:', error);
        toast({
          title: "Error",
          description: "Failed to load resume data",
          variant: "destructive",
        });
      }
    });
  }, [router, resumeId]);

  const handleSuggestionClick = (suggestionId: string) => {
    setSelectedSuggestionId(suggestionId);
  };

  const handleSuggestionEdit = (suggestionId: string, newText: string) => {
    setResumeSuggestions(prev => {
      const updated = prev.map(s =>
        s.id === suggestionId
          ? {
              ...s,
              suggested: newText,
              patch: s.patch ? { ...s.patch, newValue: newText } : s.patch,
            }
          : s
      );
      rebuildFromStatuses(suggestionStatuses, updated);
      return updated;
    });
  };

  const handleSuggestionAccept = (suggestionId: string) => {
    setSuggestionStatuses(prev => {
      const newStatuses: Record<string, 'pending' | 'accepted' | 'rejected'> = { ...prev, [suggestionId]: 'accepted' };
      rebuildFromStatuses(newStatuses, resumeSuggestions);
      return newStatuses;
    });
    setAcceptHistory(prev => [...prev, suggestionId]);
  };

  const handleSuggestionDeny = (suggestionId: string) => {
    setSuggestionStatuses(prev => {
      const newStatuses: Record<string, 'pending' | 'accepted' | 'rejected'> = { ...prev, [suggestionId]: 'rejected' };
      rebuildFromStatuses(newStatuses, resumeSuggestions);
      return newStatuses;
    });

    // Keep the suggestion selected so user can see it was rejected
    // setSelectedSuggestionId(null);
  };

  const handleSuggestionUndo = (suggestionId: string) => {
    setSuggestionStatuses(prev => {
      const newStatuses: Record<string, 'pending' | 'accepted' | 'rejected'> = { ...prev, [suggestionId]: 'pending' };
      rebuildFromStatuses(newStatuses, resumeSuggestions);
      return newStatuses;
    });
    setAcceptHistory(prev => {
      const idx = prev.lastIndexOf(suggestionId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy.splice(idx, 1);
      return copy;
    });
  };

  const handleUndoLastChange = () => {
    setAcceptHistory(prev => {
      if (prev.length === 0) return prev;
      const target = prev[prev.length - 1];
      setSuggestionStatuses(prevStatuses => {
        const newStatuses: Record<string, 'pending' | 'accepted' | 'rejected'> = { ...prevStatuses, [target]: 'pending' };
        rebuildFromStatuses(newStatuses, resumeSuggestions);
        return newStatuses;
      });
      const copy = [...prev];
      copy.pop();
      return copy;
    });
  };

  if (!user || !resumeId) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-white">
      <Header initialUser={user} />
      <div className="flex-1 overflow-hidden pt-16 sm:pt-20 md:pt-24">
        <div className="h-full w-full flex flex-col px-4 sm:px-6 lg:px-8 max-w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/resumes')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Enhance Your Resume</h1>
                <p className="text-sm text-gray-600">Click on highlights to view suggestions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {resumeSuggestions.length > 0 && (
                <>
                  {acceptHistory.length > 0 && (
                    <button
                      onClick={handleUndoLastChange}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <Undo className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                  )}
                  <span className="text-sm text-gray-700 font-medium">
                    {Object.values(suggestionStatuses).filter(s => s === 'accepted').length} of {resumeSuggestions.length} accepted
                  </span>
                  {Object.values(suggestionStatuses).filter(s => s === 'accepted').length > 0 && (
                    <Button
                      onClick={handleDownloadPDF}
                      className="bg-gray-900 hover:bg-[#498EDC] text-white rounded-md px-6 cursor-pointer"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Two-column layout: Resume Preview (left) + Suggestions Sidebar (right) */}
          <div className="flex-1 min-h-0 flex gap-6">
            {/* Resume Preview - Left Column (2/3 width) */}
            <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              {!resumeText && !structuredResumeData ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-300 mb-4" />
                  <p className="text-gray-600 text-sm">Loading resume...</p>
                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  {structuredResumeData && structuredResumeData.personal ? (
                    <JakesResumeTemplate
                      data={structuredResumeData}
                      highlightedFields={highlightedFields}
                      pathToSuggestionId={new Map(
                        resumeSuggestions
                          .filter(s => s.patch)
                          .map(s => [s.patch!.path, s.id])
                      )}
                      pathToSuggestion={new Map(
                        resumeSuggestions
                          .filter(s => s.patch)
                          .map(s => [s.patch!.path, { original: s.original, suggested: s.suggested }])
                      )}
                      selectedSuggestionId={selectedSuggestionId}
                      onClick={handleSuggestionClick}
                    />
                  ) : resumeText ? (
                    <EditableResumePreview
                      originalText={resumeText}
                      acceptedSuggestions={resumeSuggestions.filter(
                        s => suggestionStatuses[s.id] === 'accepted' || suggestionStatuses[s.id] === 'pending'
                      )}
                    />
                  ) : (
                    <div className="p-8 text-gray-600 text-center">
                      Resume not available. Please upload your resume first.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Suggestions Sidebar - Right Column (1/3 width) */}
            {(resumeSuggestions.length > 0 || isLoadingSuggestions) && (
              <div className="w-96 min-h-0 overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Suggestions</h2>
                  <p className="text-xs text-gray-600 mt-1">
                    {isLoadingSuggestions ? 'Generating suggestions...' : 'Click on a highlight to view details'}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {isLoadingSuggestions ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-300 mb-4" />
                      <p className="text-sm text-gray-600">Analyzing your resume...</p>
                    </div>
                  ) : selectedSuggestionId ? (
                    <div className="space-y-4">
                      {(() => {
                        const suggestion = resumeSuggestions.find(s => s.id === selectedSuggestionId);
                        if (!suggestion) return null;
                        const status = suggestionStatuses[selectedSuggestionId];

                        return (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 mb-2">Original</h3>
                              <p className="text-sm text-gray-700 bg-red-50 p-3 rounded border border-red-200">{suggestion.original}</p>
                            </div>

                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-sm font-semibold text-gray-900">Enhanced</h3>
                                <Pencil className="w-4 h-4 text-gray-500" aria-hidden="true" />
                              </div>
                              <textarea
                                value={suggestion.suggested}
                                onChange={(e) => handleSuggestionEdit(selectedSuggestionId, e.target.value)}
                                className="w-full text-sm text-gray-900 bg-green-50 p-3 rounded border border-green-200 focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[140px] resize-vertical"
                              />
                            </div>

                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 mb-2">Reasoning</h3>
                              <p className="text-sm text-gray-600">{suggestion.reason}</p>
                            </div>

                            {suggestion.keywords && suggestion.keywords.length > 0 && (
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-2">Keywords</h3>
                                <div className="flex flex-wrap gap-2">
                                  {suggestion.keywords.map((keyword, idx) => {
                                    const sourceText = structuredResumeData
                                      ? JSON.stringify(structuredResumeData).toLowerCase()
                                      : resumeText.toLowerCase();
                                    const hasKeyword = sourceText.includes(keyword.toLowerCase());
                                    return (
                                      <span
                                        key={idx}
                                        className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${
                                          hasKeyword
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-red-50 text-red-700 border-red-200'
                                        }`}
                                      >
                                        {hasKeyword ? '✓' : '✗'} {keyword}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              {status === 'pending' && (
                                <>
                                  <Button
                                    onClick={() => handleSuggestionAccept(selectedSuggestionId)}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    onClick={() => handleSuggestionDeny(selectedSuggestionId)}
                                    variant="outline"
                                    className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                                  >
                                    Deny
                                  </Button>
                                </>
                              )}
                              {status === 'accepted' && (
                                <div className="w-full p-3 bg-green-50 border border-green-200 rounded text-center text-sm text-green-700 font-medium">
                                  ✓ Accepted
                                </div>
                              )}
                              {status === 'rejected' && (
                                <div className="w-full p-3 bg-red-50 border border-red-200 rounded text-center text-sm text-red-700 font-medium">
                                  ✗ Denied
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <p className="text-sm text-gray-600">Select a highlighted section in your resume to view the suggestion</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EnhanceResumePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <EnhanceResumePageContent />
    </Suspense>
  );
}
