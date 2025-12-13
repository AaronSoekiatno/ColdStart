"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugReportModal({ open, onOpenChange }: BugReportModalProps) {
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || description.trim().length === 0) {
      toast({
        title: "Description required",
        description: "Please describe the issue you're experiencing.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to report a bug.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Auto-capture context
      const browserInfo = {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        platform: navigator.platform,
      };

      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          description: description.trim(),
          page_url: window.location.href,
          user_agent: navigator.userAgent,
          browser_info: browserInfo,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to submit bug report");
      }

      toast({
        title: "Report submitted",
        description: "Thank you! We'll look into this issue.",
      });

      setDescription("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-white/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-white text-center">
            Report a Bug
          </DialogTitle>
          <DialogDescription className="text-white/60 text-center">
            Help us improve by reporting any issues you encounter.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-white/80 mb-2">
              What went wrong?
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue you're experiencing..."
              required
              disabled={isSubmitting}
              rows={5}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || !description.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
          <p className="text-xs text-white/50 text-center">
            We automatically capture page URL and browser info to help debug the issue.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
