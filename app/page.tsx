import { Suspense } from "react";
import { NewLandingPage } from "@/components/NewLandingPage";

function NewLandingPageWrapper() {
  return <NewLandingPage />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <NewLandingPageWrapper />
    </Suspense>
  );
}
