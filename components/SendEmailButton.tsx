"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

interface SendEmailButtonProps {
  startupId: string;
  matchScore: number;
  founderEmail?: string;
  onSent?: () => void;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export const SendEmailButton = ({
  startupId,
  matchScore,
  variant = "default",
  className,
}: SendEmailButtonProps) => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleOpenPreview = () => {
    setIsNavigating(true);
    // Navigate to the generate email page
    router.push(`/generate-email?startupId=${startupId}&matchScore=${matchScore}`);
  };

  return (
    <Button
      onClick={handleOpenPreview}
      disabled={isNavigating}
      variant={variant}
      className={`bg-gray-50 hover:bg-gray-100 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
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
