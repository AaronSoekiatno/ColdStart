"use client";

import { ReactNode, useState } from "react";
import Image from "next/image";

interface FlipCardProps {
  frontContent: ReactNode;
  backImageSrc: string;
  backImageAlt?: string;
  className?: string;
}

export function FlipCard({
  frontContent,
  backImageSrc,
  backImageAlt = "Match card preview",
  className = "",
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={`relative w-full h-full perspective-1000 ${className}`}
      style={{ perspective: "1000px", minHeight: "400px" }}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <div
        className="relative w-full h-full transition-transform duration-700 transform-style-preserve-3d"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front Side */}
        <div
          className="absolute inset-0 w-full h-full backface-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {frontContent}
        </div>

        {/* Back Side */}
        <div
          className="absolute inset-0 w-full h-full backface-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="w-full h-full rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-white flex items-center justify-center p-4">
            <Image
              src={backImageSrc}
              alt={backImageAlt}
              width={600}
              height={800}
              className="w-full h-auto max-h-full object-contain rounded-lg"
              unoptimized
            />
          </div>
        </div>
      </div>
    </div>
  );
}
