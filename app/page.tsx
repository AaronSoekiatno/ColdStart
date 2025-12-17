'use client';

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewLandingPage } from "@/components/NewLandingPage";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

function NewLandingPageWrapper() {
  return <NewLandingPage />;
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check if uploadResume param is present - if so, show landing page
          const uploadResume = searchParams.get('uploadResume');
          if (uploadResume === 'true') {
            setIsCheckingAuth(false);
            return;
          }

          // Check if candidate exists before redirecting
          try {
            const candidateResponse = await fetch('/api/candidate-info', {
              credentials: 'include',
              cache: 'no-store',
            });

            if (candidateResponse.ok) {
              // Candidate exists, redirect to matches
              router.push('/matches');
            } else {
              // No candidate record - show landing page so user can upload resume first
              // Onboarding will happen after resume upload
              setIsCheckingAuth(false);
            }
          } catch (fetchError) {
            console.error('Error checking candidate:', fetchError);
            // Show landing page on error
            setIsCheckingAuth(false);
          }
        } else {
          // User is not authenticated, show landing page
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        // On error, show landing page
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router, searchParams]);

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <Loader2 className="h-12 w-12 animate-spin text-blue-300" />
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <NewLandingPageWrapper />
    </Suspense>
  );
}
