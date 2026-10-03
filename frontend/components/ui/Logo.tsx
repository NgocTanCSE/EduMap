import { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * EduMap logo — a clean, geometric mark that combines a stylised
 * graduation cap and a location pin into a single icon.
 *
 * Design rationale:
 * - No emoji — a proper vector mark that reads at any size.
 * - The cap silhouette signals "education"; the pin base signals "mapping".
 * - Single-path, no frivolous detail — stays crisp at 16px or 128px.
 * - Colour is inherited from the parent (theme tokens), not hardcoded,
 *   so it works in both light and dark modes.
 */
export function EduMapLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
      {...props}
    >
      {/* Cap body + tassel — single shape */}
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      {/* Location pin base */}
      <path d="M12 17c-2.65 0-4.82-1.99-5-4.52 0-.06.02-.12.05-.17C6.66 10.75 7 9.67 7 8.5 7 6.67 8.34 5 10 5c1.66 0 3 1.34 3 3 0 1.17.34 2.25.9 3.16.04.08.08.17.1.25A3.51 3.51 0 0 0 17 8.5c0 1.17-.34 2.25-.9 3.16A5.01 5.01 0 0 1 12 17Z" />
    </svg>
  );
}

/**
 * Brand wordmark — "EduMap" with the cap icon inline.
 * Use wherever the logo text + icon appears together (footer, login pages, etc.).
 */
export function EduMapWordmark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <EduMapLogo className={cn("h-6 w-6 shrink-0", iconClassName)} />
      <span className="ml-2 font-bold">
        Edu<span className="text-primary">Map</span>
      </span>
    </span>
  );
}
