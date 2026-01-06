"use client";

import { useState, useEffect, useRef } from "react";
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
import { ResetPasswordModal } from "./ResetPasswordModal";

interface SignInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SignInModal = ({ open, onOpenChange }: SignInModalProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const { toast } = useToast();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Initialize Google Sign-In using Google Identity Services
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
        setTimeout(initializeGoogle, 100);
        return;
      }

      // Initialize Google Sign-In
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCallback,
        auto_select: false,
      });

      // Render the Google Sign-In button
      if (googleButtonRef.current) {
        // Use a fixed width to ensure consistent button appearance
        // regardless of whether the user has a saved Google session
        const buttonWidth = 400;
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: buttonWidth,
          text: 'continue_with',
          shape: 'rectangular',
        });
      }
    };

    if (existingScript) {
      initializeGoogle();
    } else {
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
        window.sessionStorage.setItem('postAuthRedirect', '/matches');
      }

      onOpenChange(false);

      // Note: Redirect to /matches is handled by onAuthStateChange in NewLandingPage
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

  const handleEmailSignIn = async (e: React.FormEvent) => {
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
        description: "Please enter your password.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }


      // Store redirect intent for client-side redirect
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('postAuthRedirect', '/matches');
      }

      // Opt user into marketing emails (consent given by continuing - non-blocking)
      fetch('/api/email-preferences/opt-in', {
        method: 'POST',
        credentials: 'include',
      }).catch(error => {
        console.error('Failed to opt user into marketing emails:', error);
      });

      onOpenChange(false);

      // Clear form
      setEmail("");
      setPassword("");
      // Note: Redirect to /matches is handled by onAuthStateChange in NewLandingPage
    } catch (error) {
      console.error('Email sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to sign in. Please try again.";

      // Check for specific error types
      if (errorMessage.includes("Invalid login credentials") || errorMessage.includes("Email not confirmed")) {
        toast({
          title: "Sign in failed",
          description: "Invalid email or password. Please check your credentials and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign in failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-white text-center">
            Sign in
          </DialogTitle>
          <DialogDescription className="text-white/60 text-center">
            Choose your preferred sign-in method
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Google Sign In Button - Rendered by Google Identity Services */}
          <div ref={googleButtonRef} className="w-full google-signin-button"></div>

          {/* Divider */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/20"></div>
            <span className="px-4 text-sm text-white/60">OR</span>
            <div className="flex-grow border-t border-white/20"></div>
          </div>

          {/* Email Sign In Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
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
                placeholder="Enter your password"
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
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsResetPasswordModalOpen(true);
                }}
                className="text-sm text-white/60 hover:text-white/80 underline"
              >
                Forgot password?
              </button>
            </div>
          </form>

          {/* Legal text */}
          <p className="text-xs text-white/40 text-center pt-2">
            By continuing, you acknowledge our{" "}
            <a href="/privacy" className="underline hover:text-white/60">
              Privacy Policy
            </a>{" "}
            and consent to us sending you emails.
          </p>
        </div>
      </DialogContent>

      {/* Reset Password Modal */}
      <ResetPasswordModal
        open={isResetPasswordModalOpen}
        onOpenChange={setIsResetPasswordModalOpen}
      />
    </Dialog>
  );
};

