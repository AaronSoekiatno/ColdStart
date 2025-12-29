"use client";

import { Suspense } from "react";
import { NewLandingPage } from "@/components/landing/NewLandingPage";

export const dynamic = 'force-dynamic';

function TopCandidatesLandingPageWrapper() {
  return <NewLandingPage />;
}

export default function TopCandidatesPage() {
  // Show the same landing page as the regular landing page
  // The landing page component will handle user-specific UI
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <TopCandidatesLandingPageWrapper />
    </Suspense>
  );
}
