"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}

export function DonutChart({
  data,
  size = 200,
  strokeWidth = 22,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const total = data.reduce((acc, d) => acc + d.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-center gap-6",
        className
      )}
    >
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          {/* Background Ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-secondary/60"
          />

          {/* Segments */}
          {data.map((seg, idx) => {
            const percent = seg.value / total;
            const strokeDasharray = `${circumference * percent} ${circumference}`;
            const strokeDashoffset = -(accumulatedPercent * circumference);
            accumulatedPercent += percent;
            const isHovered = hoverIndex === idx;

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="cursor-pointer transition-all duration-200"
                style={{
                  opacity: hoverIndex !== null && !isHovered ? 0.5 : 1,
                }}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center content */}
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            {centerValue && (
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend list */}
      <div className="flex flex-col gap-2.5 min-w-[140px]">
        {data.map((seg, idx) => {
          const percent = ((seg.value / total) * 100).toFixed(1);
          const isHovered = hoverIndex === idx;

          return (
            <div
              key={idx}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-xs transition-colors cursor-pointer",
                isHovered ? "bg-secondary" : "hover:bg-secondary/40"
              )}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span
                  className={cn(
                    "font-medium",
                    isHovered ? "text-foreground font-semibold" : "text-muted-foreground"
                  )}
                >
                  {seg.label}
                </span>
              </div>
              <span className="font-bold tabular-nums text-foreground">
                {percent}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DonutChart;

