'use client';

import { useState, useEffect } from 'react';
import { ResumeList } from '@/components/ResumeList';
import { ResumeUploadModal } from '@/components/ResumeUploadModal';
import { EnhancePortfolioBanner } from '@/components/EnhancePortfolioBanner';
import { CheckMatchesBanner } from '@/components/CheckMatchesBanner';

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
        onUploadClick={() => setShowUploadModal(true)}
      />

      <ResumeUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onUploadSuccess={handleUploadSuccess}
      />
    </>
  );
}

