"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";

function UnsubscribePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "already_unsubscribed">("idle");
  const [message, setMessage] = useState("");
  const [canResubscribe, setCanResubscribe] = useState(false);

  const handleUnsubscribe = useCallback(async (emailToUnsubscribe: string, tokenToValidate: string) => {
    if (!emailToUnsubscribe || !tokenToValidate) {
      setStatus("error");
      setMessage("Please provide both email and token.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(
        `/api/unsubscribe?email=${encodeURIComponent(emailToUnsubscribe)}&token=${encodeURIComponent(tokenToValidate)}`
      );
      
      const data = await response.json();

      if (response.ok && data.success) {
        if (data.already_unsubscribed) {
          setStatus("already_unsubscribed");
          setMessage(data.message || "You are already unsubscribed from welcome emails.");
          setCanResubscribe(true);
        } else {
          setStatus("success");
          setMessage(data.message || "You have been successfully unsubscribed from welcome emails.");
          setCanResubscribe(true);
        }
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to unsubscribe. Please try again.");
      }
    } catch (error) {
      console.error("Unsubscribe error:", error);
      setStatus("error");
      setMessage("An error occurred while processing your request. Please try again later.");
    }
  }, []);

  // If email and token are in URL, auto-process unsubscribe
  useEffect(() => {
    const urlEmail = searchParams.get("email");
    const urlToken = searchParams.get("token");
    
    if (urlEmail && urlToken && status === "idle") {
      handleUnsubscribe(urlEmail, urlToken);
    }
  }, [searchParams, status, handleUnsubscribe]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUnsubscribe(email, token);
  };

  const handleResubscribe = async () => {
    // For resubscribe, we would need a separate API endpoint
    // For now, just show a message
    setMessage("To resubscribe, please contact us at hello@joinhermes.co or sign up again.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
      <div className="bg-black border border-white/20 rounded-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Mail className="w-12 h-12 text-white/60 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-white mb-2">
            Unsubscribe from Emails
          </h1>
          <p className="text-white/60 text-sm">
            Manage your email preferences
          </p>
        </div>

        {status === "idle" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-900 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 h-12"
              />
            </div>
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-white/80 mb-2">
                Unsubscribe Token
              </label>
              <Input
                id="token"
                type="text"
                placeholder="Enter token from email"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="bg-gray-900 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 h-12"
              />
              <p className="text-xs text-white/40 mt-1">
                Find this token in the unsubscribe link from your email
              </p>
            </div>
            <Button
              type="submit"
              disabled={!email || !token}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-6 rounded-lg transition-all"
            >
              Unsubscribe
            </Button>
          </form>
        )}

        {status === "loading" && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-white/60 animate-spin mx-auto mb-4" />
            <p className="text-white/60">Processing your request...</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-white mb-4">{message}</p>
            <p className="text-white/60 text-sm mb-4">
              You will no longer receive welcome emails from Hermes.
            </p>
            {canResubscribe && (
              <Button
                onClick={handleResubscribe}
                variant="outline"
                className="mt-4 text-white border-white/20 hover:bg-white/10"
              >
                Resubscribe
              </Button>
            )}
            <Button
              onClick={() => router.push("/")}
              className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white"
            >
              Return to Home
            </Button>
          </div>
        )}

        {status === "already_unsubscribed" && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <p className="text-white mb-4">{message}</p>
            <p className="text-white/60 text-sm mb-4">
              You are already unsubscribed from welcome emails.
            </p>
            {canResubscribe && (
              <Button
                onClick={handleResubscribe}
                variant="outline"
                className="mt-4 text-white border-white/20 hover:bg-white/10"
              >
                Resubscribe
              </Button>
            )}
            <Button
              onClick={() => router.push("/")}
              className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white"
            >
              Return to Home
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-white mb-4">{message}</p>
            <p className="text-white/60 text-sm mb-4">
              If you continue to experience issues, please contact us at{" "}
              <a href="mailto:hello@joinhermes.co" className="text-blue-400 hover:underline">
                hello@joinhermes.co
              </a>
            </p>
            <Button
              onClick={() => {
                setStatus("idle");
                setMessage("");
              }}
              className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white"
            >
              Try Again
            </Button>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            Need help? Contact us at{" "}
            <a href="mailto:hello@joinhermes.co" className="text-blue-400 hover:underline">
              hello@joinhermes.co
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
      </div>
    }>
      <UnsubscribePageContent />
    </Suspense>
  );
}

