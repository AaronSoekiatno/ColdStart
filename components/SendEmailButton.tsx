"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SendEmailButtonProps {
  startupId: string;
  matchScore: number;
  founderEmail?: string;
  persona?: 'direct-ask' | 'genuine-fan';
  onSent?: () => void;
  variant?: "default" | "outline" | "ghost";
  className?: string;
  disabled?: boolean;
  requiresFounderSelection?: boolean;
  isFounderSelected?: boolean;
}

export const SendEmailButton = ({
  startupId,
  matchScore,
  founderEmail,
  persona = 'direct-ask',
  variant = "default",
  className,
  disabled = false,
  requiresFounderSelection = false,
  isFounderSelected = false,
}: SendEmailButtonProps) => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const { toast } = useToast();

  const handleOpenPreview = () => {
    console.log(`[SendEmailButton] handleOpenPreview called with persona: ${persona}`);
    // Check if founder selection is required but no founder is selected
    if (requiresFounderSelection && !isFounderSelected) {
      toast({
        title: "Select a founder",
        description: "Please select a founder first before generating an email.",
        variant: "destructive",
      });
      return;
    }

    setIsNavigating(true);
    // Navigate to the generate email page with founder email and persona if available
    const params = new URLSearchParams({
      startupId,
      matchScore: matchScore.toString(),
      persona: persona,
    });
    console.log(`[SendEmailButton] Navigating with persona param: ${persona}, full URL: /generate-email?${params.toString()}`);
    if (founderEmail) {
      params.append('founderEmail', founderEmail);
    }
    router.push(`/generate-email?${params.toString()}`);
  };

  return (
    <Button
      onClick={handleOpenPreview}
      disabled={isNavigating || disabled}
      variant={variant}
      className={`${className || 'bg-gray-50 hover:bg-gray-100 text-gray-900'} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isNavigating ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Generate Email
        </span>
      )}
    </Button>
  );
};
