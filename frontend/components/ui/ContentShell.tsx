import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tight, centered content shell for feature pages.
 * Replaces the scattered `max-w-7xl mx-auto ... space-y-12 p-8` wrappers that
 * left too much whitespace ("rộng rộng") between sections.
 *
 * Uses `max-w-8xl` (1536px) — wider than the old `max-w-7xl` (1280px) so
 * widescreen screens don't get 320px of wasted side gutters — with a tighter
 * 1.5rem vertical rhythm (`space-y-6` / `py-6`). Pages that need to consume
 * the full width (e.g. the /green, /wifi listing hubs) can drop the cap with
 * `<ContentShell className="max-w-none">`.
 *
 * Defined so every feature page shares ONE page frame; override per-page with
 * className where full-width is preferred.
 */
export default function ContentShell({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-8xl space-y-6 px-4 sm:px-6 py-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
