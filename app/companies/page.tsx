'use client';

import { Suspense } from "react";
import { CompanyLandingPage } from "@/components/landing/CompanyLandingPage";

export const dynamic = 'force-dynamic';

function CompanyLandingPageWrapper() {
  return <CompanyLandingPage />;
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CompanyLandingPageWrapper />
    </Suspense>
  );
}

