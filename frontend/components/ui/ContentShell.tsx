import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Full-width fluid content shell for feature pages.
 * Maximizes available web workspace on high-resolution screens (1920x911)
 * with generous horizontal padding (px-4 sm:px-6 lg:px-8).
 */
export default function ContentShell({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full space-y-8 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
