"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ResumeUpload from "@/app/components/ResumeUpload";

interface ResumeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResumeUploadModal({ open, onOpenChange }: ResumeUploadModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-white/20 text-white sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-white text-center">
            Upload Your Resume
          </DialogTitle>
          <DialogDescription className="text-white/60 text-center">
            Upload your resume to get started. We'll analyze it and find the best startup matches for you.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <ResumeUpload onSuccess={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

