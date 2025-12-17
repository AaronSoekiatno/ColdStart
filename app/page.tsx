'use client';

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewLandingPage } from "@/components/NewLandingPage";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Use getSession for more reliable auth checking
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Check if uploadResume param is present - if so, show landing page
          const uploadResume = searchParams.get('uploadResume');
          if (uploadResume === 'true') {
            console.log('[Auth Check] Upload resume flag present, showing landing page');
            setIsCheckingAuth(false);
            return;
          }

          // Check if candidate exists and has matches (which means they have resumes)
          try {
            const candidateResponse = await fetch('/api/candidate-info', {
              credentials: 'include',
              cache: 'no-store',
            });

            if (candidateResponse.ok) {
              // Candidate exists, check if they have matches (which indicates they have resumes)
              const matchesResponse = await fetch('/api/matches?page=1&limit=1', {
                credentials: 'include',
                cache: 'no-store',
              });

              if (matchesResponse.ok) {
                // User has candidate and matches (has resumes), redirect to matches
                console.log('[Auth Check] User has candidate and matches, redirecting to matches');
                router.push('/matches');
              } else if (matchesResponse.status === 404) {
                // User has candidate but no matches/resumes, show landing page with upload modal
                console.log('[Auth Check] User has candidate but no matches/resumes, showing landing page with upload modal');
                router.push('/?uploadResume=true');
              } else {
                // Other error, show landing page with upload modal
                console.log('[Auth Check] Error checking matches, showing landing page with upload modal');
                router.push('/?uploadResume=true');
              }
            } else {
              // No candidate record - show landing page with upload modal
              console.log('[Auth Check] No candidate record, showing landing page with upload modal');
              router.push('/?uploadResume=true');
            }
          } catch (fetchError) {
            console.error('[Auth Check] Error checking candidate/matches:', fetchError);
            // On error, show landing page with upload modal
            router.push('/?uploadResume=true');
          }
        } else {
          // User is not authenticated, show landing page
          console.log('[Auth Check] User not authenticated, showing landing page');
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error('[Auth Check] Error checking authentication:', error);
        // On error, show landing page as fallback
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
  // Render landing page if not authenticated
  return <NewLandingPage />; }
