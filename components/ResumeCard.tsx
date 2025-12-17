'use client';

import { useState, useEffect } from 'react';
import { Eye, Pencil, Trash2, Sparkles, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ResumeCardProps {
  fileName: string;
  resumeUrl: string | null;
  resumeName?: string;
  isPrimary?: boolean;
  resumeId?: string;
  isPremium?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  hasEnhancedVersion?: boolean;
}

export function ResumeCard({
  fileName,
  resumeUrl,
  resumeName,
  isPrimary = false,
  resumeId,
  isPremium = false,
  isSelected = false,
  onSelect,
  hasEnhancedVersion = false,
}: ResumeCardProps) {
  const router = useRouter();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedName, setEditedName] = useState(resumeName || fileName);
  const [isDownloadingNewResume, setIsDownloadingNewResume] = useState(false);
  const { toast } = useToast();

  if (!resumeUrl) {
    return null;
  }

  const displayName = resumeName || fileName;

  // Update edited name when resumeName changes
  useEffect(() => {
    setEditedName(resumeName || fileName);
  }, [resumeName, fileName]);

  const handleEditName = async () => {
    if (!resumeId || !editedName.trim()) return;

    setIsUpdatingName(true);
    try {
      const response = await fetch('/api/resumes/update-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          resumeId, 
          name: editedName.trim() 
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update resume name' }));
        throw new Error(errorData.error || 'Failed to update resume name');
      }

      // Success - reload the page to show updated name
      window.location.reload();
    } catch (error) {
      console.error('Failed to update resume name:', error);
      alert(error instanceof Error ? error.message : 'Failed to update resume name. Please try again.');
    } finally {
      setIsUpdatingName(false);
    }
  };


  const handleDelete = async () => {
    if (!resumeId) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch('/api/resumes/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resumeId }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete resume');
      }

      toast({
        title: "Resume deleted",
        description: "The resume has been deleted successfully.",
      });

      // Close dialog and reload the page to show updated list
      setIsDeleteOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete resume:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete resume. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadNewResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!resumeId) return;

    setIsDownloadingNewResume(true);
    try {
      // Track the download event
      await fetch('/api/resumes/track-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          resumeId,
          downloadType: 'enhanced',
        }),
      }).catch((error) => {
        // Don't block the download if tracking fails
        console.warn('Failed to track download:', error);
      });
      // Fetch structured resume data for this resume
      const resumeResponse = await fetch(`/api/resumes/get-resume?resumeId=${resumeId}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!resumeResponse.ok) {
        const errorData = await resumeResponse.json().catch(() => ({ error: 'Failed to load resume data' }));
        throw new Error(errorData.error || 'Failed to load resume data');
      }

      const resumeJson = await resumeResponse.json();
      const structuredResumeData = resumeJson.structuredResumeData;

      if (!structuredResumeData) {
        throw new Error('No structured resume data found for this resume');
      }

      // Call the same PDF export endpoint used in the enhance page
      const response = await fetch('/api/resumes/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          structuredResumeData,
          candidateName: structuredResumeData.personal?.name ?? undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate PDF' }));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'updated_resume.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download new resume error:', error);
      toast({
        title: 'Failed to download new resume',
        description: error instanceof Error ? error.message : 'Failed to download PDF',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingNewResume(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger selection if clicking on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    onSelect?.();
  };

  return (
    <>
      <div 
        className={cn(
          "bg-white rounded-xl sm:rounded-2xl border p-4 sm:p-6 transition-all flex flex-col shadow-sm cursor-pointer",
          // Only selected cards have blue border, all others have gray border
          isSelected ? "border-blue-300 border-2" : "border-gray-200"
        )}
        onClick={handleCardClick}
      >
        <div className="flex-1 mb-3 sm:mb-4">
          <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2 relative">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate" title={displayName}>
                {displayName}
              </h3>
              {resumeId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditOpen(true);
                  }}
                  className="p-1 sm:p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900 flex-shrink-0 cursor-pointer"
                  aria-label="Edit resume name"
                  title="Edit resume name"
                >
                  <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {resumeId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeleteOpen(true);
                  }}
                  className="p-1 sm:p-1.5 rounded-md hover:bg-red-100 transition-colors text-red-600 hover:text-red-700 cursor-pointer"
                  aria-label="Delete resume"
                  title="Delete resume"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </div>
          {resumeName && (
            <p className="text-xs sm:text-sm text-gray-500 truncate" title={fileName}>
              {fileName}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (resumeId) {
                // Track the preview event
                await fetch('/api/resumes/track-download', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({
                    resumeId,
                    downloadType: 'preview',
                  }),
                }).catch((error) => {
                  // Don't block the preview if tracking fails
                  console.warn('Failed to track preview:', error);
                });
              }
              setIsPreviewOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-900 transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="text-xs sm:text-sm font-medium">Preview</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!resumeId) return;
              router.push(`/resumes/enhance?resumeId=${resumeId}`);
            }}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-black hover:bg-gray-800 text-white rounded-lg transition-all text-xs sm:text-sm font-medium cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Enhance</span>
          </button>
          {hasEnhancedVersion && (
            <button
              onClick={handleDownloadNewResume}
              disabled={isDownloadingNewResume}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-300 hover:bg-blue-400 text-white rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{isDownloadingNewResume ? 'Downloading...' : 'Download New Resume'}</span>
            </button>
          )}
        </div>
      </div>

      <DialogPrimitive.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-4 bg-black border border-white/20 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-3xl text-white"
          )}>
            <DialogPrimitive.Title className="sr-only">
              Preview of {fileName}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none text-white hover:text-white z-10">
              <span className="sr-only">Close</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </DialogPrimitive.Close>

            <div className="w-full h-[80vh]">
              <iframe
                src={resumeUrl}
                className="w-full h-full rounded-lg border border-white/10"
                title={`Preview of ${fileName}`}
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Edit Name Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Edit Resume Name
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Update the resume name displayed.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="resume-name" className="block text-sm font-medium text-gray-700 mb-2">
                Resume Name
              </label>
              <input
                id="resume-name"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isUpdatingName) {
                    handleEditName();
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Enter resume name"
                disabled={isUpdatingName}
                maxLength={255}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setEditedName(resumeName || fileName); // Reset on cancel
                }}
                disabled={isUpdatingName}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEditName}
                disabled={isUpdatingName || !editedName.trim() || editedName.trim() === (resumeName || fileName)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-300 hover:bg-blue-500 rounded-lg transition-all disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer hover:shadow-md"
              >
                {isUpdatingName ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Delete Resume
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Are you sure you want to delete "{displayName}"? This action cannot be undone.
              {isPrimary && (
                <span className="block mt-2 text-amber-600 font-medium">
                  Note: This is your active resume. Another resume will be set as active automatically.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

