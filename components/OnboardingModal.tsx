"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type JobType = 'full-time' | 'part-time' | 'internship';

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (jobType: JobType) => void;
}

export function OnboardingModal({ open, onOpenChange, onComplete }: OnboardingModalProps) {
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedJobType) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/candidate/update-job-type', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ jobType: selectedJobType }),
      });

      if (!response.ok) {
        throw new Error('Failed to save job type');
      }

      onComplete(selectedJobType);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving job type:', error);
      alert('Failed to save your preference. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-gray-900 text-center">
            Welcome to ColdStart!
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-center mt-2">
            Let's personalize your experience. What type of position are you looking for?
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-6 space-y-3">
          <button
            onClick={() => setSelectedJobType('full-time')}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedJobType === 'full-time'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-900">Full-Time</div>
            <div className="text-sm text-gray-600 mt-1">Permanent, full-time positions</div>
          </button>

          <button
            onClick={() => setSelectedJobType('part-time')}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedJobType === 'part-time'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-900">Part-Time</div>
            <div className="text-sm text-gray-600 mt-1">Part-time or contract positions</div>
          </button>

          <button
            onClick={() => setSelectedJobType('internship')}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedJobType === 'internship'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-900">Internship</div>
            <div className="text-sm text-gray-600 mt-1">Summer, winter, or year-round internships</div>
          </button>
        </div>

        <div className="mt-6">
          <Button
            onClick={handleSubmit}
            disabled={!selectedJobType || isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
