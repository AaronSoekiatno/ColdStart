import { Suspense } from "react";
import HomeClient from "./page-client";
import { Loader2 } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <Loader2 className="h-12 w-12 animate-spin text-blue-300" />
      </div>
    }>
      <HomeClient />
    </Suspense>
  );
}
