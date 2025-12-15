"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ResumeUpload from "@/app/components/ResumeUpload";
import { UpgradeModal } from "@/components/UpgradeModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface ResumeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: () => void; // Optional callback when upload succeeds
}

export function ResumeUploadModal({ open, onOpenChange, onUploadSuccess }: ResumeUploadModalProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Get current user for upgrade modal
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleUploadSuccess = async () => {
    onOpenChange(false);
    
    // Check if user needs onboarding (no job_type set)
    if (user?.email) {
      try {
        const response = await fetch('/api/candidate/check-onboarding', {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (data.needsOnboarding) {
          setShowOnboardingModal(true);
        } else {
          // Call the upload success callback if provided
          if (onUploadSuccess) {
            onUploadSuccess();
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // If check fails, just call success callback
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }
    } else {
      // Call the upload success callback if provided
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    }
  };

  return (
    <>
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
            <ResumeUpload 
              onSuccess={handleUploadSuccess} 
              onUpgradeRequired={() => {
                setShowUpgradeModal(true);
                onOpenChange(false); // Close the upload modal
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      {showUpgradeModal && user && (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          hiddenMatchCount={0}
          email={user.email || ''}
          customTitle="Upgrade to Premium"
          isPremium={false}
        />
      )}
      {showOnboardingModal && (
        <OnboardingModal
          open={showOnboardingModal}
          onOpenChange={setShowOnboardingModal}
          onComplete={() => {
            setShowOnboardingModal(false);
            // Call the upload success callback after onboarding is complete
            if (onUploadSuccess) {
              onUploadSuccess();
            }
          }}
        />
      )}
    </>
  );
}

