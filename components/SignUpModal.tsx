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
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        throw error;
      }

      // Success - user is signed in/up
      toast({
        title: "Welcome!",
        description: "Your account has been created.",
      });

      // Store redirect intent for client-side redirect
      if (typeof window !== 'undefined') {
        const redirect = redirectTo || '/onboarding';
        window.sessionStorage.setItem('postAuthRedirect', redirect);
      }

      onOpenChange(false);

      // Note: Redirect is handled by onAuthStateChange in NewLandingPage
    } catch (error) {
      console.error('Google sign up error:', error);
      toast({
        title: "Sign up failed",
        description: error instanceof Error ? error.message : "Failed to sign up with Google. Please try again.",
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
          {/* Google Sign Up Button - Rendered by Google Identity Services */}
          <div ref={googleButtonRef} className="w-full google-signin-button"></div>

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
            and agree to get occasional product updates and promotional emails.
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

