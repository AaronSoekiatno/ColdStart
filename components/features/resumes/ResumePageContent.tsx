'use client';

import { useState, useEffect } from 'react';
import { ResumeList } from '@/components/features/resumes/ResumeList';
import { ResumeUploadModal } from '@/components/modals/ResumeUploadModal';
import { EnhancePortfolioBanner } from '@/components/EnhancePortfolioBanner';
import { CheckMatchesBanner } from '@/components/features/matches/CheckMatchesBanner';
import { UpgradeModal } from '@/components/modals/UpgradeModal';
import { supabase } from '@/lib/supabase';

interface Resume {
  id: string;
  fileName: string;
  resumeUrl: string | null;
  name?: string;
  isPrimary: boolean;
  hasEnhancedVersion?: boolean;
}

interface ResumePageContentProps {
  resumes: Resume[];
  isPremium: boolean;
  isNewUser?: boolean;
  primaryResumeId?: string;
}

export function ResumePageContent({ resumes, isPremium, isNewUser = false, primaryResumeId }: ResumePageContentProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    // Get user email for upgrade modal
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });
  }, []);

  const handleUploadClick = () => {
    // Resume upload limits temporarily removed - all users can upload multiple resumes
    // TODO: Re-implement premium-based resume limits if needed in the future
    setShowUploadModal(true);
  };

  const handleUploadSuccess = () => {
    // Reload the page after successful upload to show the new resume
    setTimeout(() => {
      window.location.reload();
    }, 1500); // Wait for the success message to show
  };

  // Check if user just finished enhancing (takes priority over new user banner)
  const [justEnhanced, setJustEnhanced] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const justEnhancedFlag = sessionStorage.getItem('justEnhancedResume');
      if (justEnhancedFlag === 'true') {
        setJustEnhanced(true);
      }
    }
  }, []);

  // Check if user has any enhanced resume
  const hasEnhancedResume = resumes.some(resume => resume.hasEnhancedVersion);

  return (
    <>
      <CheckMatchesBanner />
      {/* Only show enhance banner if user didn't just finish enhancing and doesn't have any enhanced resume */}
      {!justEnhanced && !hasEnhancedResume && (
        <EnhancePortfolioBanner
          resumeId={primaryResumeId}
          isNewUser={isNewUser}
        />
      )}
      <ResumeList
        resumes={resumes}
        isPremium={isPremium}
        onUploadClick={handleUploadClick}
      />

      <ResumeUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUploadSuccess={handleUploadSuccess}
      />

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        hiddenMatchCount={0}
        email={userEmail}
        isPremium={isPremium}
        customTitle="Upgrade to Upload Multiple Resumes"
      />
    </>
  );
}

