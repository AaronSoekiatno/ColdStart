'use client';

import { Suspense } from "react";
import { CompanyLandingPage } from "@/components/landing/CompanyLandingPage";

export const dynamic = 'force-dynamic';

function CompanyLandingPageWrapper() {
  return <CompanyLandingPage />;
}

export default function Home() {
  // Main landing page is now the Company Landing Page
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CompanyLandingPageWrapper />
    </Suspense>
  );
}
