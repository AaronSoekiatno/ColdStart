'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SignInModal } from '@/components/modals/SignInModal';
import Image from 'next/image';

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showSignIn, setShowSignIn] = useState(true);
    const redirect = searchParams?.get('redirect') || '/matches';

    useEffect(() => {
        // Check if user is already logged in
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Already logged in, redirect to intended destination
                router.push(redirect);
            }
        };
        checkAuth();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                // User just logged in, check for stored redirect
                const storedRedirect = window.sessionStorage.getItem('postAuthRedirect');
                const targetPath = storedRedirect || redirect;
                window.sessionStorage.removeItem('postAuthRedirect');
                router.push(targetPath);
            }
        });

        return () => subscription.unsubscribe();
    }, [router, redirect]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="max-w-md w-full space-y-8 p-8">
                <div className="text-center">
                    <div className="flex justify-center mb-6">
                        <Image
                            src="/images/blacked.svg"
                            alt="Hermes"
                            width={48}
                            height={48}
                            priority
                        />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">Sign in to Hermes</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {redirect !== '/matches'
                            ? 'You need to be logged in to access this page'
                            : 'Continue to your dashboard'}
                    </p>
                </div>

                <SignInModal
                    open={showSignIn}
                    onOpenChange={(open) => {
                        setShowSignIn(open);
                        if (!open) {
                            // If modal is closed without signing in, redirect to home
                            router.push('/');
                        }
                    }}
                    redirectTo={redirect}
                />
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="max-w-md w-full space-y-8 p-8">
                    <div className="text-center">
                        <div className="flex justify-center mb-6">
                            <Image
                                src="/images/blacked.svg"
                                alt="Hermes"
                                width={48}
                                height={48}
                                priority
                            />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900">Sign in to Hermes</h2>
                        <p className="mt-2 text-sm text-gray-600">Loading...</p>
                    </div>
                </div>
            </div>
        }>
            <LoginPageContent />
        </Suspense>
    );
}
