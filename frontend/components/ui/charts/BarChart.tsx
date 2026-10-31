"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface BarDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarDataPoint[];
  height?: number;
  primaryColor?: string;
  valueFormatter?: (val: number) => string;
  className?: string;
}

export function BarChart({
  data,
  height = 240,
  primaryColor = "#E07A5F",
  valueFormatter = (val) => val.toLocaleString("vi-VN"),
  className,
}: BarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-dashed border-border/80 text-xs text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        Không có dữ liệu hiển thị
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 10);
  const minVal = 0;

  const paddingX = 40;
  const paddingY = 25;
  const width = 600;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const barSlotWidth = chartWidth / data.length;
  const barWidth = Math.min(36, barSlotWidth * 0.65);

  const getY = (val: number) => {
    const range = maxVal - minVal || 1;
    return height - paddingY - ((val - minVal) / range) * chartHeight;
  };

  // Horizontal Grid Lines
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = minVal + ((maxVal - minVal) / gridSteps) * (gridSteps - i);
    const y = getY(val);
    return { val, y };
  });

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          {/* Grid lines & Y-axis labels */}
          {gridLines.map((line, idx) => (
            <g key={idx}>
              <line
                x1={paddingX}
                y1={line.y}
                x2={width - paddingX}
                y2={line.y}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-border/40"
                strokeWidth={1}
              />
              <text
                x={paddingX - 8}
                y={line.y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] font-medium"
              >
                {valueFormatter(Math.round(line.val))}
              </text>
            </g>
          ))}

          {/* Bars */}
          {data.map((d, i) => {
            const barX = paddingX + i * barSlotWidth + (barSlotWidth - barWidth) / 2;
            const barY = getY(d.value);
            const barH = height - paddingY - barY;
            const isHovered = hoverIndex === i;
            const fill = d.color || primaryColor;

            return (
              <g key={i}>
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={Math.max(barH, 2)}
                  rx={6}
                  fill={fill}
                  className="transition-all duration-200"
                  style={{
                    opacity: hoverIndex !== null && !isHovered ? 0.45 : 1,
                    transformOrigin: `${barX + barWidth / 2}px ${height - paddingY}px`,
                    transform: isHovered ? "scaleY(1.02)" : "scaleY(1)",
                  }}
                />

                {/* Hover value label on top of bar */}
                {isHovered && (
                  <text
                    x={barX + barWidth / 2}
                    y={barY - 6}
                    textAnchor="middle"
                    className="fill-foreground text-[11px] font-bold"
                  >
                    {valueFormatter(d.value)}
                  </text>
                )}

                {/* X Axis Label */}
                <text
                  x={barX + barWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  className={cn(
                    "text-[11px] font-semibold transition-colors",
                    isHovered ? "fill-primary font-bold" : "fill-muted-foreground"
                  )}
                >
                  {d.label}
                </text>

                {/* Interactive transparent hit area */}
                <rect
                  x={paddingX + i * barSlotWidth}
                  y={paddingY}
                  width={barSlotWidth}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default BarChart;

