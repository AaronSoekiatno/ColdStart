"use client";

import { useState } from "react";
import { PenTool } from "lucide-react";
import { BugReportModal } from "@/components/BugReportModal";

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-[#498EDC] hover:bg-[#3a7bc4] text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        aria-label="Provide feedback"
      >
        <PenTool className="w-4 h-4" strokeWidth={2.5} />
        <span className="text-sm font-semibold">Feedback</span>
      </button>
      <BugReportModal open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

