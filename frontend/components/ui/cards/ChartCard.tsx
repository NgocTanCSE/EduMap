"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  controls?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  badge?: string;
}

export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  controls,
  children,
  footer,
  className,
  headerClassName,
  contentClassName,
  badge,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[22px] border border-border/70 bg-card shadow-orvel transition-all duration-200 hover:border-border hover:shadow-pop",
        className
      )}
    >
      {/* Separated Header */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 border-b border-border/40 px-6 py-5 sm:px-7",
          headerClassName
        )}
      >
        <div className="flex items-center gap-3.5">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-border/60 bg-secondary/80 text-primary shadow-sm">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                {title}
              </h3>
              {badge && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {controls && (
          <div className="flex items-center gap-2 shrink-0">{controls}</div>
        )}
      </div>

      {/* Main Content Area with generous breathing room */}
      <div className={cn("flex-1 p-6 sm:p-7", contentClassName)}>
        {children}
      </div>

      {/* Optional Card Footer */}
      {footer && (
        <div className="border-t border-border/40 bg-secondary/20 px-6 py-4 sm:px-7 rounded-b-[22px]">
          {footer}
        </div>
      )}
    </div>
  );
}

export default ChartCard;

