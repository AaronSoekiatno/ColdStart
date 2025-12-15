'use client';

import { useState, useMemo } from 'react';
import { ResumeCard } from '@/components/ResumeCard';
import { useToast } from '@/hooks/use-toast';
import { Check, Upload } from 'lucide-react';

interface Resume {
  id: string;
  fileName: string;
  resumeUrl: string | null;
  name?: string;
  isPrimary: boolean;
   hasEnhancedVersion?: boolean;
}

interface ResumeListProps {
  resumes: Resume[];
  isPremium: boolean;
  onUploadClick?: () => void; // Callback to open upload modal
}

export function ResumeList({ resumes, isPremium, onUploadClick }: ResumeListProps) {
  // Sort resumes: active (primary) first, then others
  const sortedResumes = useMemo(() => {
    return [...resumes].sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;
      return 0;
    });
  }, [resumes]);

  // Find primary resume ID for initial selection
  const primaryResumeId = useMemo(() => {
    return sortedResumes.find(r => r.isPrimary)?.id || null;
  }, [sortedResumes]);

  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(primaryResumeId);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);
  const { toast } = useToast();

  // Ensure at least one card is always selected - fallback to primary if somehow null
  const effectiveSelectedResumeId = selectedResumeId || primaryResumeId;

  const handleSetPrimary = async () => {
    if (!effectiveSelectedResumeId) return;

    const selectedResume = sortedResumes.find(r => r.id === effectiveSelectedResumeId);
    if (!selectedResume || selectedResume.isPrimary) {
      return;
    }

    setIsSettingPrimary(true);
    try {
      const response = await fetch('/api/resumes/set-primary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resumeId: effectiveSelectedResumeId }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to set active resume' }));
        
        if (errorData.upgradeRequired) {
          toast({
            title: "Premium feature",
            description: 'Setting an active resume is a Premium feature. Please upgrade to Premium.',
            variant: "destructive",
          });
        } else {
          throw new Error(errorData.error || 'Failed to set active resume');
        }
        return;
      }

      // Success - reload the page to show updated state
      window.location.reload();
    } catch (error) {
      console.error('Failed to set active resume:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to set active resume. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsSettingPrimary(false);
    }
  };

  const handleCardSelect = (resumeId: string) => {
    // Prevent deselecting if this is the only selected card
    // At least one card must always be selected
    setSelectedResumeId(prev => {
      // If clicking on the currently selected card, prevent deselection
      if (prev === resumeId) {
        return prev; // Keep it selected
      }
      // Otherwise, select the new card
      return resumeId;
    });
  };

  const selectedResume = effectiveSelectedResumeId ? sortedResumes.find(r => r.id === effectiveSelectedResumeId) : null;
  const canSetPrimary = isPremium && selectedResume && !selectedResume.isPrimary;
  const isButtonDisabled = !isPremium || !selectedResume || selectedResume.isPrimary || isSettingPrimary;
  const isAlreadyActive = selectedResume?.isPrimary ?? false;

  return (
    <>
      {/* Header Section */}
      <div className="mb-6 sm:mb-8">
        {/* Title and Active Button Row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">My Resumes</h1>
            <p className="text-sm sm:text-base text-gray-600">
              Manage all of your resumes here!
            </p>
          </div>
          {/* Active Button - positioned to the right on desktop, below title on mobile */}
          <button
            onClick={handleSetPrimary}
            disabled={isButtonDisabled}
            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 text-white rounded-lg transition-all text-xs sm:text-sm font-medium shadow-sm self-start sm:self-auto flex-shrink-0 ${
              isAlreadyActive && isButtonDisabled
                ? 'bg-blue-300 hover:bg-blue-300 disabled:bg-blue-300 disabled:cursor-not-allowed'
                : 'bg-black hover:bg-blue-300 disabled:bg-gray-400 disabled:cursor-not-allowed'
            }`}
          >
            {isSettingPrimary ? (
              <>
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Setting...</span>
              </>
            ) : isAlreadyActive ? (
              <>
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Active</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Set as Active</span>
              </>
            )}
          </button>
        </div>
        
        {/* Upload Button */}
        {onUploadClick && (
          <button
            onClick={onUploadClick}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-black hover:bg-gray-800 text-white rounded-lg transition-all text-xs sm:text-sm font-medium shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Upload Resume</span>
          </button>
        )}
      </div>

      {sortedResumes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {sortedResumes.map((resume) => (
            <ResumeCard 
              key={resume.id}
              fileName={resume.fileName} 
              resumeUrl={resume.resumeUrl}
              resumeName={resume.name}
              isPrimary={resume.isPrimary}
              resumeId={resume.id}
              isPremium={isPremium}
              hasEnhancedVersion={resume.hasEnhancedVersion}
              isSelected={effectiveSelectedResumeId === resume.id}
              onSelect={() => handleCardSelect(resume.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 p-6 sm:p-12 text-center shadow-sm">
          <p className="text-gray-600 text-sm sm:text-lg">
            No resumes found. Upload your resume to get started!
          </p>
        </div>
      )}
    </>
  );
}

