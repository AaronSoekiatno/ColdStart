'use client';

import { Suspense } from "react";
import { NewLandingPage } from "@/components/landing/NewLandingPage";

export const dynamic = 'force-dynamic';

function NewLandingPageWrapper() {
    return <NewLandingPage />;
}

export default function CandidatesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" />}>
            <NewLandingPageWrapper />
        </Suspense>
    );
}
