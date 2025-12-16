'use client';

import { useState, useEffect } from 'react';
import { ResumeList } from '@/components/ResumeList';
import { ResumeUploadModal } from '@/components/ResumeUploadModal';
import { UpgradeModal } from '@/components/UpgradeModal';
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
}

export function ResumePageContent({ resumes, isPremium }: ResumePageContentProps) {
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
    // Free users can only have 1 resume
    // If they already have 1 or more, show upgrade modal
    if (!isPremium && resumes.length >= 1) {
      setShowUpgradeModal(true);
    } else {
      setShowUploadModal(true);
    }
  };

  const handleUploadSuccess = () => {
    // Reload the page after successful upload to show the new resume
    setTimeout(() => {
      window.location.reload();
    }, 1500); // Wait for the success message to show
  };

  return (
    <>
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
        email={userEmail}
        isPremium={isPremium}
        customTitle="Upgrade to Upload Multiple Resumes"
      />
    </>
  );
}

