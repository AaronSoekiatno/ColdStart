"use client";

import { Suspense } from "react";
import { NewLandingPage } from "@/components/landing/NewLandingPage";

export const dynamic = 'force-dynamic';

function OnboardingPageWrapper() {
  return <NewLandingPage />;
}

export default function OnboardingPage() {
  // Show the same landing page as the regular landing page (which triggers onboarding modal)
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <OnboardingPageWrapper />
    </Suspense>
  );
}
