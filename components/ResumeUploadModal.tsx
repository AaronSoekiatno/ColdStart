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
import { SignUpModal } from "@/components/SignUpModal";
import { SignInModal } from "@/components/SignInModal";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface ResumeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: () => void; // Optional callback when upload succeeds
}

export function ResumeUploadModal({ open, onOpenChange, onUploadSuccess }: ResumeUploadModalProps) {
  const router = useRouter();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Preload onboarding page for faster navigation
    router.prefetch('/onboarding');

    // Get current user for upgrade modal
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth state changes (e.g., when user signs up)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      // If user just signed up/in, check for onboarding
      if (session?.user?.email) {
        // Close sign up/in modals
        setShowSignUpModal(false);
        setShowSignInModal(false);
        
        // Check for onboarding
        try {
          const response = await fetch('/api/candidate/check-onboarding', {
            credentials: 'include',
          });
          const data = await response.json();
          
          if (data.needsOnboarding) {
            // Redirect to full-screen onboarding page
            router.push('/onboarding');
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
      }
    });

    return () => subscription.unsubscribe();
  }, [onUploadSuccess, router]);

  const handleUploadSuccess = async () => {
    onOpenChange(false);
    
    // Check if user is authenticated
    if (user?.email) {
      // User is authenticated - check if they need onboarding
      try {
        const response = await fetch('/api/candidate/check-onboarding', {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (data.needsOnboarding) {
          // Redirect to full-screen onboarding page
          router.push('/onboarding');
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
      // User is NOT authenticated - prompt them to sign up
      setShowSignUpModal(true);
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
      <SignUpModal
        open={showSignUpModal}
        onOpenChange={setShowSignUpModal}
        onSwitchToSignIn={() => {
          setShowSignUpModal(false);
          setShowSignInModal(true);
        }}
      />
      <SignInModal
        open={showSignInModal}
        onOpenChange={setShowSignInModal}
      />
    </>
  );
}

