'use client';

import { useState } from 'react';
import { Eye } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface ResumeCardProps {
  fileName: string;
  resumeUrl: string | null;
}

export function ResumeCard({ fileName, resumeUrl }: ResumeCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!resumeUrl) {
    return null;
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:bg-gray-50 transition-all flex flex-col shadow-sm">
        <div className="flex-1 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate" title={fileName}>
            {fileName}
          </h3>
        </div>
        <button
          onClick={() => setIsPreviewOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-900 transition-all"
        >
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">Preview</span>
        </button>
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

