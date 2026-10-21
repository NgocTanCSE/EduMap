import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Compact page header: title + optional subtitle, single small icon, no
 * `text-5xl font-black` / `Sparkles` / giant `opacity-5` watermark blocks.
 */
export default function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  right?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4",
        className
      )}
    >
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5">
          {Icon && <Icon className="w-5 h-5 text-primary" />}
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-foreground/55 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
