import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tight, centered content shell for feature pages.
 * Replaces the scattered `max-w-7xl mx-auto ... space-y-12 p-8` wrappers that
 * left too much whitespace ("rộng rộng") between sections.
 *
 * Uses the same max-w-7xl (1280px) as `.page-shell` so content widths line
 * up consistently across the app, with a tighter 6rem vertical rhythm.
 */
export default function ContentShell({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 py-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
