"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, ArrowLeft } from "lucide-react";
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
  const [hoveredSuggestionId, setHoveredSuggestionId] = useState<string | null>(null);
  const [hoveredElementPosition, setHoveredElementPosition] = useState<{ top: number; left: number } | null>(null);
  const [isModalHovered, setIsModalHovered] = useState(false);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resumePreviewRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Helper function to apply suggestions to structured resume data
  const applySuggestionsToStructuredData = (
    data: StructuredResumeData,
    suggestions: ResumeSuggestion[]
  ): { updatedData: StructuredResumeData; highlightedFields: Set<ResumePath> } => {
    // Filter suggestions that have patches
    const patches = suggestions
      .filter(s => s.patch)
      .map(s => s.patch!);

    // Apply all patches
    const result = applyPatches(data, patches);

    return {
      updatedData: result.updatedData,
      highlightedFields: result.modifiedPaths,
    };
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

  const handleLoadSuggestions = async () => {
    if (!resumeId) return;

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
      if (structuredResumeData && suggestions.length > 0) {
        const { updatedData, highlightedFields: newHighlighted } = applySuggestionsToStructuredData(
          structuredResumeData,
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

  const handleSuggestionHover = (suggestionId: string, event: React.MouseEvent) => {
    if (!resumePreviewRef.current) return;

    // Clear any pending close timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const containerRect = resumePreviewRef.current.getBoundingClientRect();

    setHoveredSuggestionId(suggestionId);
    setIsModalHovered(false);
    // Position above the changed line
    setHoveredElementPosition({
      top: rect.top - containerRect.top - 8,
      left: rect.left - containerRect.left + rect.width / 2,
    });
  };

  const handleSuggestionLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      if (!isModalHovered) {
        setHoveredSuggestionId(null);
        setHoveredElementPosition(null);
      }
      leaveTimeoutRef.current = null;
    }, 800);
  };

  const handleModalEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsModalHovered(true);
  };

  const handleModalLeave = () => {
    setIsModalHovered(false);
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredSuggestionId(null);
      setHoveredElementPosition(null);
      leaveTimeoutRef.current = null;
    }, 500);
  };

  const handleSuggestionAccept = (suggestionId: string) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    setSuggestionStatuses(prev => {
      const newStatuses: Record<string, 'pending' | 'accepted' | 'rejected'> = { ...prev, [suggestionId]: 'accepted' };
      return newStatuses;
    });

    // Remove highlight for the accepted suggestion
    const suggestion = resumeSuggestions.find(s => s.id === suggestionId);
    if (suggestion?.patch) {
      setHighlightedFields(prev => {
        const newHighlighted = new Set(prev);
        newHighlighted.delete(suggestion.patch!.path);
        return newHighlighted;
      });
    }

    setHoveredSuggestionId(null);
    setHoveredElementPosition(null);
    setIsModalHovered(false);
  };

  const handleSuggestionDeny = (suggestionId: string) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    setSuggestionStatuses(prev => {
      const newStatuses: Record<string, 'pending' | 'accepted' | 'rejected'> = { ...prev, [suggestionId]: 'rejected' };

      // Revert this specific suggestion by rebuilding from original
      if (originalStructuredResumeData) {
        const acceptedSuggestions = resumeSuggestions.filter(
          s => newStatuses[s.id] === 'accepted' || (newStatuses[s.id] === 'pending' && s.id !== suggestionId)
        );

        const { updatedData, highlightedFields: newHighlighted } = applySuggestionsToStructuredData(
          originalStructuredResumeData,
          acceptedSuggestions
        );
        setStructuredResumeData(updatedData);
        setHighlightedFields(newHighlighted);
      }

      return newStatuses;
    });

    setHoveredSuggestionId(null);
    setHoveredElementPosition(null);
    setIsModalHovered(false);
  };

  if (!user || !resumeId) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-white">
      <Header initialUser={user} />
      <div className="flex-1 overflow-hidden pt-16 sm:pt-20 md:pt-24">
        <div className="h-full w-full flex flex-col px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/resumes')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Enhance Your Resume</h1>
                <p className="text-sm text-gray-600">Improve your resume with AI-powered suggestions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {resumeSuggestions.length > 0 && (
                <>
                  <span className="text-sm text-gray-700 font-medium">
                    {Object.values(suggestionStatuses).filter(s => s === 'accepted').length} of {resumeSuggestions.length} accepted
                  </span>
                  {Object.values(suggestionStatuses).filter(s => s === 'accepted').length > 0 && (
                    <Button
                      onClick={handleDownloadPDF}
                      className="bg-gray-900 hover:bg-[#498EDC] text-white rounded-md px-6"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  )}
                </>
              )}
              {resumeSuggestions.length === 0 && (
                <Button
                  onClick={handleLoadSuggestions}
                  disabled={isLoadingSuggestions}
                  className="bg-blue-300 hover:bg-blue-300 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-md px-6"
                >
                  {isLoadingSuggestions ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Suggestions...
                    </span>
                  ) : (
                    "Generate Suggestions"
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Resume Preview */}
          <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            {resumeSuggestions.length > 0 ? (
              <div className="h-full overflow-y-auto">
                {resumeText && (
                  <div className="overflow-hidden relative" ref={resumePreviewRef}>
                    {structuredResumeData && structuredResumeData.personal ? (
                      <>
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
                          onHover={handleSuggestionHover}
                          onLeave={handleSuggestionLeave}
                        />
                        {/* Hover Modal */}
                        {hoveredSuggestionId && hoveredElementPosition && (
                          <div
                            className="absolute z-50 pointer-events-auto"
                            style={{
                              top: `${hoveredElementPosition.top}px`,
                              left: `${hoveredElementPosition.left}px`,
                              transform: 'translate(-50%, -100%)'
                            }}
                            onMouseEnter={handleModalEnter}
                            onMouseLeave={handleModalLeave}
                          >
                            <div className="bg-white border border-gray-300 rounded shadow-lg flex gap-1 p-1">
                              <Button
                                onClick={() => handleSuggestionAccept(hoveredSuggestionId)}
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-3 text-green-600 hover:bg-green-50 hover:text-green-700 border-green-300"
                              >
                                Accept
                              </Button>
                              <Button
                                onClick={() => handleSuggestionDeny(hoveredSuggestionId)}
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-3 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-300"
                              >
                                Deny
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
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
            ) : resumeText ? (
              <div className="h-full overflow-y-auto">
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
                  <div className="p-8 text-gray-600 text-center">
                    Resume not available. Please upload your resume first.
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-300 mb-4" />
                <p className="text-gray-600 text-sm">Loading resume...</p>
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
