"use client";

import { ReactNode } from "react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";

interface ScrollAnimateProps {
  children: ReactNode;
  className?: string;
  delay?: number; // Delay in ms for staggered animations
  direction?: "up" | "down" | "left" | "right" | "fade";
  threshold?: number;
  rootMargin?: string;
}

export function ScrollAnimate({
  children,
  className = "",
  delay = 0,
  direction = "up",
  threshold = 0.1,
  rootMargin = "0px",
}: ScrollAnimateProps) {
  const { ref, isVisible } = useScrollAnimation({
    threshold,
    rootMargin,
    triggerOnce: true,
  });

  const getTransform = () => {
    if (!isVisible) {
      switch (direction) {
        case "up":
          return "translateY(30px)";
        case "down":
          return "translateY(-30px)";
        case "left":
          return "translateX(30px)";
        case "right":
          return "translateX(-30px)";
        case "fade":
          return "translateY(0px)";
        default:
          return "translateY(30px)";
      }
    }
    return "translateY(0px)";
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transition: `opacity 0.6s ease-out ${delay}ms, transform 0.6s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

