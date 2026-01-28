"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface SignUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromReview?: boolean;
  onSwitchToSignIn?: () => void;
  redirectTo?: string;
}

export const SignUpModal = ({ open, onOpenChange, fromReview = false, onSwitchToSignIn, redirectTo }: SignUpModalProps) => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Preload onboarding page when sign-up modal opens for faster navigation
  useEffect(() => {
    if (open) {
      router.prefetch('/onboarding');
    }
  }, [open, router]);

  // Initialize Google Sign-In button using Google Identity Services
  useEffect(() => {
    if (!open) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured');
      return;
    }

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');

    const initializeGoogle = () => {
      if (typeof window.google === 'undefined' || !googleButtonRef.current) {
        // Retry after a short delay
        setTimeout(initializeGoogle, 100);
        return;
      }

      // Initialize Google Sign-In
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCallback,
        auto_select: false,
      });

      // Render the button
      if (googleButtonRef.current) {
        // Use a fixed width to ensure consistent button appearance
        // regardless of whether the user has a saved Google session
        const buttonWidth = 400;
        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            theme: 'outline',
            size: 'large',
            width: buttonWidth,
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
          }
        );
      }
    };

    if (existingScript) {
      // Script already loaded, just initialize
      initializeGoogle();
    } else {
      // Load Google Identity Services script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      document.body.appendChild(script);
    }
  }, [open]);

  const handleGoogleCallback = async (response: any) => {
    try {
      setIsLoading(true);
      const idToken = response.credential;

      // Use Supabase's signInWithIdToken to create a session
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        throw error;
      }

      // Store redirect intent for client-side redirect
      if (typeof window !== 'undefined') {
        const redirect = redirectTo || '/onboarding';
        window.sessionStorage.setItem('postAuthRedirect', redirect);
      }

      onOpenChange(false);

      // Note: Redirect is handled by onAuthStateChange in NewLandingPage
    } catch (error) {
      console.error('Google sign in error:', error);
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "Failed to sign in with Google. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    if (!password) {
      toast({
        title: "Password required",
        description: "Please enter a password.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      // Use signUp with email and password
      // Always use window.location.origin for redirects to ensure localhost works correctly
      const appUrl = window.location.origin;
      const redirectUrl = redirectTo
        ? `${appUrl}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`
        : `${appUrl}/auth/callback`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        // If the user already exists, prompt them to sign in instead.
        if (
          error.code === "user_already_exists" ||
          /already registered|already exists/i.test(error.message)
        ) {
          toast({
            title: "Account already exists",
            description:
              "That email is already on file. Please sign in instead.",
            variant: "destructive",
          });

          // If we have a handler to switch to sign-in, call it.
          if (onSwitchToSignIn) {
            onOpenChange(false);
            onSwitchToSignIn();
          }
          return;
        }
        throw error;
      }

      toast({
        title: "Account created",
        description: "Your account has been created successfully. You can now sign in.",
      });
      onOpenChange(false);

      // Clear form
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      // If we have a handler to switch to sign-in, suggest signing in
      if (onSwitchToSignIn) {
        setTimeout(() => {
          onSwitchToSignIn();
        }, 500);
      }
    } catch (error) {
      console.error('Email sign up error:', error);
      toast({
        title: "Sign up failed",
        description: error instanceof Error ? error.message : "Failed to send magic link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-white text-center">
            Sign up
          </DialogTitle>
          <DialogDescription className="text-white/60 text-center">
            {fromReview ? "Sign up to continue to your results" : "Choose your preferred sign-up method"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* OAuth Buttons */}
          <div className="space-y-3">
            {/* Google Sign Up - Rendered by Google Identity Services */}
            <div ref={googleButtonRef} className="w-full flex justify-center google-signin-button"></div>

            {/* GitHub Sign Up */}
            <Button
              variant="outline"
              onClick={() => {
                // Use the same auth flow as connect but for sign-in/up
                window.location.href = '/api/auth/github/signin';
              }}
              className="w-full flex items-center justify-center gap-2 h-[44px] bg-white text-black hover:bg-gray-100 border-white/20 font-medium rounded text-sm relative px-3"
            >
              <svg height="20" viewBox="0 0 16 16" version="1.1" width="20" aria-hidden="true" className="absolute left-3">
                <path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
              </svg>
              <span>Sign up with GitHub</span>
            </Button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/20"></div>
            <span className="px-4 text-sm text-white/60">OR</span>
            <div className="flex-grow border-t border-white/20"></div>
          </div>

          {/* Email Sign Up Form */}
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="bg-gray-900 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 h-12"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Enter your password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="bg-gray-900 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 h-12"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="bg-gray-900 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 h-12"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-6 rounded-lg transition-all"
            >
              {isLoading ? "Creating account..." : "Sign up"}
            </Button>
          </form>

          {/* Legal text */}
          <p className="text-xs text-white/40 text-center pt-2">
            By continuing, you acknowledge our{" "}
            <a href="/privacy" className="underline hover:text-white/60">
              Privacy Policy
            </a>{" "}
            and consent to us sending you emails.
          </p>

          {/* Sign in link */}
          {onSwitchToSignIn && (
            <p className="text-sm text-white/60 text-center pt-2">
              Already have an account?{" "}
              <button
                onClick={() => {
                  onOpenChange(false);
                  onSwitchToSignIn();
                }}
                className="underline hover:text-white/80 text-white/70"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

