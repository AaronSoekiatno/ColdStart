'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function InterviewPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to IDE page where Minerva is now integrated
    router.replace('/ide');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-400 mx-auto mb-4" />
        <p className="text-slate-300">Redirecting to IDE...</p>
      </div>
    </div>
  );
}
