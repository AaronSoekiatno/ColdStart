"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Sparkles, Loader2, CheckCircle2 } from "lucide-react";

interface AccessCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AccessCodeModal = ({ open, onOpenChange, onSuccess }: AccessCodeModalProps) => {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      toast({
        title: "Access code required",
        description: "Please enter your access code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/access-codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to redeem access code');
      }

      // Success!
      setIsSuccess(true);
      setSuccessMessage(data.message || 'Access code redeemed successfully!');
      
      toast({
        title: "Success!",
        description: data.message || 'Access code redeemed successfully!',
      });

      // Call onSuccess callback after a short delay
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
        // Reset state for next time
        setCode("");
        setIsSuccess(false);
        setSuccessMessage("");
        // Refresh the page to update premium status
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Error redeeming access code:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to redeem access code',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      // Reset state
      setCode("");
      setIsSuccess(false);
      setSuccessMessage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white border-gray-200">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            {isSuccess ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : (
              <Ticket className="w-6 h-6 text-white" />
            )}
          </div>
          <DialogTitle className="text-xl font-semibold text-black">
            {isSuccess ? "Welcome to the Beta!" : "Enter Access Code"}
          </DialogTitle>
          <DialogDescription className="text-black">
            {isSuccess 
              ? successMessage
              : "Have a beta access code? Enter it below to join our exclusive testing cohort."
            }
          </DialogDescription>
        </DialogHeader>

        {!isSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter your access code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-center text-lg font-mono tracking-widest uppercase h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-black"
                disabled={isLoading}
                autoFocus
                maxLength={20}
              />
              <p className="text-xs text-black text-center">
                Access codes are case-insensitive
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Redeem Code
                </>
              )}
            </Button>
          </form>
        )}

        {isSuccess && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Redirecting...
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

