'use client';

import { Suspense } from "react";
import { NewLandingPage } from "@/components/NewLandingPage";

function NewLandingPageWrapper() {
  return <NewLandingPage />;
}

export default function Home() {
  // Allow both authenticated and unauthenticated users to view the landing page
  // The landing page component will handle user-specific UI (e.g., showing user menu if logged in)
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <NewLandingPageWrapper />
    </Suspense>
  );
}
