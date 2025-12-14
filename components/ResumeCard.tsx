'use client';

import { useState } from 'react';
import { Eye, Check, Star } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface ResumeCardProps {
  fileName: string;
  resumeUrl: string | null;
  resumeName?: string;
  isPrimary?: boolean;
  resumeId?: string;
  isPremium?: boolean;
}

export function ResumeCard({ 
  fileName, 
  resumeUrl, 
  resumeName, 
  isPrimary = false,
  resumeId,
  isPremium = false,
}: ResumeCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);

  if (!resumeUrl) {
    return null;
  }

  const displayName = resumeName || fileName;

  const handleSetPrimary = async () => {
    if (!resumeId || isPrimary) return;
    
    setIsSettingPrimary(true);
    try {
      const response = await fetch('/api/resumes/set-primary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resumeId }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to set primary resume' }));
        
        if (errorData.upgradeRequired) {
          alert('Setting a primary resume is a Premium feature. Please upgrade to Premium.');
        } else {
          throw new Error(errorData.error || 'Failed to set primary resume');
        }
        return;
      }

      // Success - reload the page to show updated state
      window.location.reload();
    } catch (error) {
      console.error('Failed to set primary resume:', error);
      alert(error instanceof Error ? error.message : 'Failed to set primary resume. Please try again.');
    } finally {
      setIsSettingPrimary(false);
    }
  };

  return (
    <>
      <div className={cn(
        "bg-white rounded-2xl border p-6 transition-all flex flex-col shadow-sm",
        isPrimary ? "border-blue-500 border-2" : "border-gray-200"
      )}>
        <div className="flex-1 mb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate flex-1" title={displayName}>
              {displayName}
            </h3>
            {isPrimary && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium flex-shrink-0">
                <Star className="w-3 h-3 fill-current" />
                <span>Current</span>
              </div>
            )}
          </div>
          {resumeName && (
            <p className="text-sm text-gray-500 truncate" title={fileName}>
              {fileName}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-900 transition-all"
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">Preview</span>
          </button>
          {isPremium && !isPrimary && resumeId && (
            <button
              onClick={handleSetPrimary}
              disabled={isSettingPrimary}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-all text-sm font-medium"
            >
              {isSettingPrimary ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Setting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Set as Current</span>
                </>
              )}
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
    </>
  );
}

