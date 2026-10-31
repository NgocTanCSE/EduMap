"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  children: React.ReactNode;
}

export function MagicCard({
  children,
  className,
  gradientSize = 250,
  gradientColor = "rgba(224, 122, 95, 0.15)",
  gradientOpacity = 0.8,
  ...props
}: MagicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mouseX, setMouseX] = useState(-gradientSize);
  const [mouseY, setMouseY] = useState(-gradientSize);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (cardRef.current) {
        const { left, top } = cardRef.current.getBoundingClientRect();
        setMouseX(e.clientX - left);
        setMouseY(e.clientY - top);
      }
    },
    [cardRef]
  );

  const handleMouseLeave = useCallback(() => {
    setMouseX(-gradientSize);
    setMouseY(-gradientSize);
  }, [gradientSize]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative flex size-full flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card p-6 shadow-orvel transition-all duration-200 hover:border-border hover:shadow-pop",
        className
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 80%)`,
          opacity: mouseX > 0 && mouseY > 0 ? gradientOpacity : 0,
        }}
      />
      <div className="relative z-10 flex size-full flex-col">{children}</div>
    </div>
  );
}

export default MagicCard;

