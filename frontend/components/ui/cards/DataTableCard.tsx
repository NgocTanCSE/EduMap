"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface DataTableCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  controls?: React.ReactNode;
  children: React.ReactNode;
  pagination?: React.ReactNode;
  totalRecords?: number;
  className?: string;
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
}

export function DataTableCard({
  title,
  subtitle,
  icon: Icon,
  controls,
  children,
  pagination,
  totalRecords,
  className,
  emptyState,
  isEmpty = false,
}: DataTableCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-orvel transition-all duration-200 hover:border-border hover:shadow-pop",
        className
      )}
    >
      {/* Table Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 px-6 py-5 sm:px-7">
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
              {typeof totalRecords === "number" && (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {totalRecords}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {controls && (
          <div className="flex flex-wrap items-center gap-2.5">{controls}</div>
        )}
      </div>

      {/* Table Content */}
      <div className="w-full overflow-x-auto">
        {isEmpty && emptyState ? emptyState : children}
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <div className="border-t border-border/50 bg-secondary/20 px-6 py-3.5 sm:px-7">
          {pagination}
        </div>
      )}
    </div>
  );
}

export default DataTableCard;

