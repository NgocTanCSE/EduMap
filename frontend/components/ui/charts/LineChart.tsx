"use client";

import React, { useState, useId } from "react";
import { cn } from "@/lib/utils";

export interface DataPoint {
  label: string; // e.g. "T1", "2021", "T2/2025"
  value: number;
  secondaryValue?: number;
}

export interface LineChartProps {
  data: DataPoint[];
  height?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  valueFormatter?: (val: number) => string;
  className?: string;
}

export function LineChart({
  data,
  height = 260,
  primaryLabel = "Thực tế",
  secondaryLabel,
  primaryColor = "#E07A5F",
  secondaryColor = "#0F6A45",
  valueFormatter = (val) => val.toLocaleString("vi-VN"),
  className,
}: LineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradId = useId();

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

  // Calculate range
  const allValues = data.flatMap((d) => [
    d.value,
    ...(d.secondaryValue !== undefined ? [d.secondaryValue] : []),
  ]);
  const minVal = Math.min(0, Math.min(...allValues));
  const maxVal = Math.max(...allValues, 10);
  const paddingX = 40;
  const paddingY = 25;
  const width = 600; // viewBox width

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const getX = (index: number) => {
    if (data.length <= 1) return paddingX + chartWidth / 2;
    return paddingX + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const range = maxVal - minVal || 1;
    return height - paddingY - ((val - minVal) / range) * chartHeight;
  };

  // Build smooth bezier path
  const buildSmoothPath = (getValue: (d: DataPoint) => number) => {
    if (data.length < 2) {
      const x = getX(0);
      const y = getY(getValue(data[0]));
      return `M ${x} ${y}`;
    }

    let path = `M ${getX(0)} ${getY(getValue(data[0]))}`;
    for (let i = 0; i < data.length - 1; i++) {
      const x0 = getX(i);
      const y0 = getY(getValue(data[i]));
      const x1 = getX(i + 1);
      const y1 = getY(getValue(data[i + 1]));
      const cx = (x0 + x1) / 2;
      path += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return path;
  };

  const primaryPath = buildSmoothPath((d) => d.value);
  const primaryAreaPath = `${primaryPath} L ${getX(data.length - 1)} ${height - paddingY} L ${getX(0)} ${height - paddingY} Z`;

  const secondaryPath =
    secondaryLabel && data.some((d) => d.secondaryValue !== undefined)
      ? buildSmoothPath((d) => d.secondaryValue ?? 0)
      : null;

  // Horizontal Grid Lines (4 steps)
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = minVal + ((maxVal - minVal) / gridSteps) * (gridSteps - i);
    const y = getY(val);
    return { val, y };
  });

  const activePoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className={cn("relative w-full", className)}>
      {/* Legend bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
            <span className="text-foreground">{primaryLabel}</span>
          </div>

          {secondaryLabel && (
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: secondaryColor }}
              />
              <span className="text-muted-foreground">{secondaryLabel}</span>
            </div>
          )}
        </div>

        {activePoint && (
          <div className="flex items-center gap-2 text-foreground">
            <span className="text-muted-foreground">{activePoint.label}:</span>
            <span className="font-bold tabular-nums">
              {valueFormatter(activePoint.value)}
            </span>
          </div>
        )}
      </div>

      {/* SVG Viewport */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={primaryColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>

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

          {/* Area Fill */}
          <path d={primaryAreaPath} fill={`url(#${gradId})`} />

          {/* Primary Curve */}
          <path
            d={primaryPath}
            fill="none"
            stroke={primaryColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Secondary Curve */}
          {secondaryPath && (
            <path
              d={secondaryPath}
              fill="none"
              stroke={secondaryColor}
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive vertical crosshair & points */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={paddingY}
                x2={getX(hoverIndex)}
                y2={height - paddingY}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                className="text-primary/60"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(data[hoverIndex].value)}
                r={5}
                fill={primaryColor}
                stroke="#ffffff"
                strokeWidth={2}
              />
              {data[hoverIndex].secondaryValue !== undefined && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getY(data[hoverIndex].secondaryValue!)}
                  r={4}
                  fill={secondaryColor}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
            </g>
          )}

          {/* X Axis Labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={getX(i)}
              y={height - 6}
              textAnchor="middle"
              className={cn(
                "text-[11px] font-semibold transition-colors",
                hoverIndex === i
                  ? "fill-primary font-bold"
                  : "fill-muted-foreground"
              )}
            >
              {d.label}
            </text>
          ))}

          {/* Invisible interactive hover columns */}
          {data.map((_, i) => {
            const colWidth = chartWidth / data.length;
            const x = getX(i) - colWidth / 2;
            return (
              <rect
                key={i}
                x={x}
                y={paddingY}
                width={colWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default LineChart;

