"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, ArrowLeft, Pencil, Undo } from "lucide-react";
import { Header } from "@/components/Header";
import { JakesResumeTemplate } from "@/components/JakesResumeTemplate";
import { EditableResumePreview } from "@/components/EditableResumePreview";
import { ATSScoreBadge } from "@/components/ATSScoreBadge";
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
  const [isDoneEnhancing, setIsDoneEnhancing] = useState(false);
  const [showFinishButton, setShowFinishButton] = useState(false);
  const [atsScore, setAtsScore] = useState<{
    score: number;
    category: 'Excellent' | 'Okay';
    suggestions: string[];
  } | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);

  // Auto-resize textarea when suggestion changes
  useEffect(() => {
    if (selectedSuggestionId) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const textarea = document.getElementById(`suggestion-textarea-${selectedSuggestionId}`) as HTMLTextAreaElement;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = Math.max(textarea.scrollHeight + 4, 40) + 'px';
        }
      }, 0);
    }
  }, [selectedSuggestionId, resumeSuggestions]);
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
      setIsDoneEnhancing(false);

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

  // Handler for generating PDF via server-side export (Puppeteer)
  const handleDownloadPDF = async () => {
    if (!user) return;

    // Build the latest structured data snapshot based on current suggestion statuses
    const baseData = originalStructuredResumeData || structuredResumeData;
    if (!baseData) return;

    const activeSuggestions = resumeSuggestions.filter(
      (s) => suggestionStatuses[s.id] === "accepted" || suggestionStatuses[s.id] === "pending"
    );
    const { updatedData } = applySuggestionsToStructuredData(baseData, activeSuggestions);

    try {
      const response = await fetch("/api/resumes/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          structuredResumeData: updatedData,
          candidateName: updatedData.personal?.name ?? user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "updated_resume.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download PDF error:", error);
      toast({
        title: "Failed to download PDF",
        description: error instanceof Error ? error.message : "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  // Handler for fetching ATS score
  const fetchATSScore = async () => {
    if (!resumeText || !resumeId) {
      console.log('[ATS Score] Missing data - resumeText:', !!resumeText, 'resumeId:', !!resumeId);
      return;
    }

    console.log('[ATS Score] Fetching score for resumeId:', resumeId);
    setIsLoadingScore(true);
    try {
      const response = await fetch('/api/resume-ats-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          resumeText,
          structuredData: structuredResumeData,
          resumeId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[ATS Score] Received score data:', data);
        setAtsScore({
          score: data.score,
          category: data.category,
          suggestions: data.suggestions || [],
        });
      } else {
        const errorText = await response.text();
        console.error('[ATS Score] Failed to fetch:', response.status, errorText);
      }
    } catch (error) {
      console.error('[ATS Score] Error fetching:', error);
    } finally {
      setIsLoadingScore(false);
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

        console.log('[DEBUG] Resume data received:', {
          hasResumeText: !!data.resumeText,
          resumeTextLength: data.resumeText?.length,
          hasStructuredData: !!data.structuredResumeData,
        });

        if (data.resumeText) {
          setResumeText(data.resumeText);
        }

        if (data.structuredResumeData) {
          setStructuredResumeData(data.structuredResumeData);
          setOriginalStructuredResumeData(data.structuredResumeData);

          // Fetch ATS score first, then load suggestions
          // Use structured data if available (preferred), otherwise fall back to resumeText
          if (data.structuredResumeData || data.resumeText) {
            console.log('[ATS Score] Fetching score for resumeId:', resumeId);
            setIsLoadingScore(true);
            try {
              const scoreResponse = await fetch('/api/resume-ats-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  resumeText: data.resumeText,
                  structuredData: data.structuredResumeData,
                  resumeId,
                }),
              });

              if (scoreResponse.ok) {
                const scoreData = await scoreResponse.json();
                console.log('[ATS Score] Received score data:', scoreData);
                setAtsScore({
                  score: scoreData.score,
                  category: scoreData.category,
                  suggestions: scoreData.suggestions || [],
                });
              } else {
                const errorText = await scoreResponse.text();
                console.error('[ATS Score] Failed to fetch:', scoreResponse.status, errorText);
              }
            } catch (error) {
              console.error('[ATS Score] Error fetching:', error);
            } finally {
              setIsLoadingScore(false);
            }
          }

          // Now load suggestions after ATS score
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
  }, [resumeId]);

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
        
        // Rebuild structured data with updated statuses
        rebuildFromStatuses(newStatuses, resumeSuggestions);
        
        // Reset done state so user can click "Done" again
        setIsDoneEnhancing(false);
        setShowFinishButton(false);
        
        // Recalculate ATS score with updated data
        // Get the updated structured data by applying patches
        if (originalStructuredResumeData) {
          const activeSuggestions = resumeSuggestions.filter(
            s => newStatuses[s.id] === 'accepted' || newStatuses[s.id] === 'pending'
          );
          const { updatedData } = applySuggestionsToStructuredData(
            originalStructuredResumeData,
            activeSuggestions
          );
          
          // Recalculate ATS score
          if (resumeId && resumeText) {
            setIsLoadingScore(true);
            fetch('/api/resume-ats-score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                resumeText,
                structuredData: updatedData,
                resumeId,
              }),
            })
              .then(response => {
                if (response.ok) {
                  return response.json();
                }
                throw new Error('Failed to fetch ATS score');
              })
              .then(scoreData => {
                setAtsScore({
                  score: scoreData.score,
                  category: scoreData.category,
                  suggestions: scoreData.suggestions || [],
                });
              })
              .catch(error => {
                console.error('[ATS Score] Error fetching after undo:', error);
              })
              .finally(() => {
                setIsLoadingScore(false);
              });
          }
        }
        
        return newStatuses;
      });
      const copy = [...prev];
      copy.pop();
      return copy;
    });
  };

  const handleDoneEnhancing = async () => {
    if (showFinishButton) {
      // Second click - redirect to resumes page
      // Preload matches and images before redirecting
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('justEnhancedResume', 'true');
        
        // Preload matches and founder profile pictures
        try {
          const response = await fetch('/api/matches?page=1&limit=5', {
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            const matches = data.matches || [];
            
            // Extract founder profile pictures from top matches
            const pfps: Array<{ url: string; name: string }> = [];
            matches.forEach((match: any) => {
              if (match.startup?.founders_pfp) {
                // Parse founders_pfp - handle both array and string formats
                let founderProfilePictures: string[] = [];
                if (Array.isArray(match.startup.founders_pfp)) {
                  founderProfilePictures = match.startup.founders_pfp
                    .map((url: any) => String(url).trim())
                    .filter((url: string) => url && url !== '');
                } else if (typeof match.startup.founders_pfp === 'string') {
                  founderProfilePictures = match.startup.founders_pfp
                    .split(',')
                    .map((url: string) => url.trim())
                    .filter((url: string) => url && url !== '');
                }

                // Get founder names
                const founderNames = match.startup.founder_names
                  ? match.startup.founder_names.split(',').map((n: string) => n.trim())
                  : [];

                // Add first founder from each match (limit to 4 total)
                if (founderProfilePictures.length > 0 && pfps.length < 4) {
                  const firstName = founderNames[0] || match.startup.name || 'Founder';
                  pfps.push({
                    url: founderProfilePictures[0],
                    name: firstName,
                  });
                }
              }
            });

            const finalPfps = pfps.slice(0, 4);
            
            // Store in sessionStorage for immediate access
            sessionStorage.setItem('bannerFounderPfps', JSON.stringify(finalPfps));
            
            // Preload images immediately
            finalPfps.forEach((founder) => {
              if (founder.url && founder.url.trim() !== '') {
                const img = new Image();
                img.src = `/api/image-proxy?url=${encodeURIComponent(founder.url)}`;
              }
            });
          }
        } catch (error) {
          console.error('Error preloading matches for banner:', error);
        }
      }
      
      router.push('/resumes');
    } else {
      // First click - clear highlights and show "Finish" button
      setHighlightedFields(new Set());
      setSelectedSuggestionId(null);
      setIsDoneEnhancing(true);
      setShowFinishButton(true);

      // Mark this resume as enhanced so the download button appears in the list
      if (resumeId) {
        try {
          await fetch('/api/resumes/mark-enhanced', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ resumeId }),
          });
        } catch (error) {
          console.error('Failed to mark resume as enhanced from Finish button:', error);
        }
      }

      // Recalculate ATS score with updated structured data
      if (structuredResumeData && resumeId) {
        setIsLoadingScore(true);
        try {
          const scoreResponse = await fetch('/api/resume-ats-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              structuredData: structuredResumeData,
              resumeId: `${resumeId}-enhanced`, // Use different cache key for enhanced version
            }),
          });

          if (scoreResponse.ok) {
            const scoreData = await scoreResponse.json();
            console.log('[ATS Score] Updated score after enhancements:', scoreData);
            
            // Ensure score changes by at least 1 percentage point (capped at 97)
            const currentScore = atsScore?.score ?? 0;
            const newScore = scoreData.score;
            
            // Always ensure the score increases by at least 1 point
            // If new score is less than or equal to current, increase by 1
            // If new score is already higher, use it (but still cap at 97)
            const minRequiredScore = Math.min(97, currentScore + 1);
            const adjustedScore = Math.max(minRequiredScore, Math.min(97, newScore));
            
            // Update category based on adjusted score
            const adjustedCategory = adjustedScore >= 90 ? 'Excellent' : 'Okay';
            
            setAtsScore({
              score: adjustedScore,
              category: adjustedCategory,
              suggestions: scoreData.suggestions || [],
            });
          } else {
            const errorText = await scoreResponse.text();
            console.error('[ATS Score] Failed to fetch updated score:', scoreResponse.status, errorText);
          }
        } catch (error) {
          console.error('[ATS Score] Error fetching updated score:', error);
        } finally {
          setIsLoadingScore(false);
        }
      }
    }
  };

  if (!user || !resumeId) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-white">
      <Header initialUser={user} />
      <div className="flex-1 overflow-hidden pt-16 sm:pt-20 md:pt-24">
        <div className="h-full w-full flex flex-col px-4 sm:px-6 lg:px-8 max-w-full mx-auto">
          {/* Header and Content Row - Aligned */}
          <div className="flex-1 min-h-0 flex gap-6">
            {/* Left side: Header + Resume Preview */}
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => router.push('/resumes')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">Enhance Your Resume</h1>
                  {/* ATS Score Badge - next to title */}
                  <ATSScoreBadge
                    score={atsScore?.score ?? 0}
                    category={atsScore?.category ?? 'Okay'}
                    suggestions={atsScore?.suggestions ?? []}
                    isLoading={isLoadingScore}
                  />
                </div>
              </div>


              {/* Resume Preview - Always visible */}
              <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
              {!resumeText && !structuredResumeData ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-300 mb-4" />
                  <p className="text-gray-600 text-sm">Loading resume...</p>
                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  {structuredResumeData && structuredResumeData.personal ? (
                    <div className="resume-print-root">
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
                    </div>
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
            </div>

            {/* Suggestions Sidebar - Right Column (1/3 width) - Aligned with header - Always visible */}
            <div className="w-96 min-h-0 overflow-hidden flex flex-col mt-6">
              {/* Right side actions (when done enhancing) */}
              {resumeSuggestions.length > 0 && isDoneEnhancing && (
                <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                  {acceptHistory.length > 0 && (
                    <button
                      onClick={handleUndoLastChange}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <Undo className="w-3 h-3" />
                      <span>Undo</span>
                    </button>
                  )}
                  <span className="text-sm text-gray-700 font-medium">
                    {Object.values(suggestionStatuses).filter(s => s === 'accepted').length} of {resumeSuggestions.length} accepted
                  </span>
                  <Button
                    onClick={handleDownloadPDF}
                    className="bg-gray-900 hover:bg-[#498EDC] text-white rounded-md px-6 cursor-pointer"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-3 flex-shrink-0">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Suggestions</h2>
                    <p className="text-xs text-gray-600 mt-1">
                      {isLoadingSuggestions ? 'Generating suggestions...' : 'Click on a highlight to view details'}
                    </p>
                  </div>
                  {!isLoadingSuggestions && resumeSuggestions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDoneEnhancing}
                      className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <span>{showFinishButton ? 'Finish' : 'Done'}</span>
                    </button>
                  )}
                </div>
              <div className="flex-1 min-h-0 flex flex-col">
                {isLoadingSuggestions ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-300 mb-4" />
                    <p className="text-sm text-gray-600">Analyzing your resume...</p>
                  </div>
                ) : selectedSuggestionId ? (
                    <>
                      <div className="flex-1 p-2 space-y-2">
                        {(() => {
                          const suggestion = resumeSuggestions.find(s => s.id === selectedSuggestionId);
                          if (!suggestion) return null;
                          const status = suggestionStatuses[selectedSuggestionId];

                          return (
                            <>
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-1">Original</h3>
                                <p className="text-sm text-gray-700 bg-red-50 p-2.5 rounded border border-red-200">{suggestion.original}</p>
                              </div>

                              <div>
                                <div className="flex items-center gap-2 mb-1 mt-4">
                                  <h3 className="text-sm font-semibold text-gray-900">Enhanced</h3>
                                  <Pencil className="w-4 h-4 text-gray-500" aria-hidden="true" />
                                </div>
                                <textarea
                                  id={`suggestion-textarea-${selectedSuggestionId}`}
                                  key={selectedSuggestionId}
                                  value={suggestion.suggested}
                                  onChange={(e) => {
                                    handleSuggestionEdit(selectedSuggestionId, e.target.value);
                                    // Auto-resize textarea with buffer to prevent scrollbar
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.max(e.target.scrollHeight + 4, 40) + 'px';
                                  }}
                                  onFocus={(e) => {
                                    // Auto-resize on focus with buffer to prevent scrollbar
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.max(e.target.scrollHeight + 4, 40) + 'px';
                                  }}
                                  className="w-full text-sm text-gray-900 bg-green-50 p-2.5 rounded border border-green-200 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none overflow-hidden"
                                />
                              </div>

                              <div className="mt-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-1">Feedback</h3>
                                <p className="text-sm text-gray-600">{suggestion.reason}</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      
                      {/* Sticky buttons at bottom */}
                      <div className="pt-0 pb-3 px-3 bg-white flex-shrink-0">
                        {(() => {
                          const suggestion = resumeSuggestions.find(s => s.id === selectedSuggestionId);
                          if (!suggestion) return null;
                          const status = suggestionStatuses[selectedSuggestionId];

                          return (
                            <div className="flex gap-2">
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
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <p className="text-sm text-gray-600">
                        {isDoneEnhancing
                          ? "Ready to Download"
                          : "No bullet points selected yet"}
                      </p>
                    </div>
                  )}
              </div>
              </div>
            </div>
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

