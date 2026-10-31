"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ProgressiveBlurProps {
  className?: string;
  direction?: "top" | "bottom" | "left" | "right";
  stops?: number;
}

export function ProgressiveBlur({
  className,
  direction = "bottom",
  stops = 8,
}: ProgressiveBlurProps) {
  const getGradientDirection = () => {
    switch (direction) {
      case "top":
        return "to top";
      case "bottom":
        return "to bottom";
      case "left":
        return "to left";
      case "right":
        return "to right";
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 h-16",
        direction === "top" && "top-0",
        direction === "bottom" && "bottom-0",
        className
      )}
      style={{
        maskImage: `linear-gradient(${getGradientDirection()}, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 100%)`,
        WebkitMaskImage: `linear-gradient(${getGradientDirection()}, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 100%)`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    />
  );
}

export default ProgressiveBlur;

