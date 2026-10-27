import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Shared <select> — Desert Dusk form system.
 *
 * Native selects render a square-cornered dropdown arrow in most browsers.
 * This component applies the `.form-select` token (rounded-lg + custom
 * chevron via CSS background-image) so every dropdown lines up with
 * the Input / Textarea components.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return (
      <select
        className={cn("form-select", className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Select.displayName = "Select"

export { Select }
