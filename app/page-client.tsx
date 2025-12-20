'use client';

import { Suspense, useEffect, useState } from "react";
import { NewLandingPage } from "@/components/landing/NewLandingPage";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

function LandingPageWithSuspense() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <Loader2 className="h-12 w-12 animate-spin text-blue-300" />
      </div>
    }>
      <NewLandingPage />
    </Suspense>
  );
}

function HomeContent() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Use getSession for more reliable auth checking
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // User is authenticated, redirect to matches immediately
          console.log('[Auth Check] User authenticated, redirecting to matches');
          window.location.href = '/matches';
          return; // Exit early to prevent showing loading state
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
  }, []);

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
        <Loader2 className="h-12 w-12 animate-spin text-blue-300" />
      </div>
    );
  }

  return <LandingPageWithSuspense />;
}

export default function HomeClient() {
  return <HomeContent />;
}

