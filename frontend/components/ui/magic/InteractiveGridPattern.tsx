"use client";

import React, { useState, useId, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface InteractiveGridPatternProps
  extends React.SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
  squares?: [number, number]; // [horizontalCount, verticalCount]
  className?: string;
  squaresClassName?: string;
  hoverColor?: string;
}

export function InteractiveGridPattern({
  width = 40,
  height = 40,
  squares = [24, 24],
  className,
  squaresClassName,
  hoverColor = "fill-primary/20 stroke-primary/30",
  ...props
}: InteractiveGridPatternProps) {
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);
  const [horizontal, vertical] = squares;

  const handleMouseEnter = useCallback((key: string) => {
    setHoveredSquare(key);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredSquare(null);
  }, []);

  return (
    <svg
      width={width * horizontal}
      height={height * vertical}
      className={cn(
        "pointer-events-auto absolute inset-0 h-full w-full stroke-border/40 [mask-image:radial-gradient(ellipse_at_center,white_30%,transparent_80%)]",
        className
      )}
      {...props}
    >
      <g>
        {Array.from({ length: horizontal }).map((_, i) =>
          Array.from({ length: vertical }).map((_, j) => {
            const key = `${i}-${j}`;
            const isHovered = hoveredSquare === key;

            return (
              <rect
                key={key}
                x={i * width}
                y={j * height}
                width={width}
                height={height}
                className={cn(
                  "stroke-border/40 transition-all duration-300",
                  isHovered
                    ? hoverColor
                    : "fill-transparent hover:fill-primary/10",
                  squaresClassName
                )}
                onMouseEnter={() => handleMouseEnter(key)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })
        )}
      </g>
    </svg>
  );
}

export default InteractiveGridPattern;

