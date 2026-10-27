import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Minimal Badge component (shadcn-style) — used by the Opportunity Radar and
 * other list pages to render type / confidence / status pills.
 *
 * Implemented without `class-variance-authority` to avoid adding a new
 * dependency; variant classes are resolved inline.
 */

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  variant?: BadgeVariant
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors"
  const variantClass =
    variant === "secondary"
      ? "bg-secondary text-secondary-foreground"
      : variant === "destructive"
      ? "bg-destructive text-destructive-foreground"
      : variant === "outline"
      ? "border border-input bg-background text-foreground"
      : "bg-primary text-primary-foreground"
  return <div className={cn(base, variantClass, className)} {...props} />
}
