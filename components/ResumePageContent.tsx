'use client';

import { useState } from 'react';
import { ResumeList } from '@/components/ResumeList';
import { ResumeUploadModal } from '@/components/ResumeUploadModal';

interface Resume {
  id: string;
  fileName: string;
  resumeUrl: string | null;
  name?: string;
  isPrimary: boolean;
}

interface ResumePageContentProps {
  resumes: Resume[];
  isPremium: boolean;
}

export function ResumePageContent({ resumes, isPremium }: ResumePageContentProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);

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

