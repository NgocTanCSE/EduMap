import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ElementType;
}

/**
 * Shared text input — Desert Dusk form system.
 *
 * Replaces the dozens of hand-rolled `rounded-xl px-4 py-3 border border-border
 * bg-background focus:border-primary` blocks scattered across pages.
 * Radius, padding and focus-ring now come from the `.form-input` token in
 * globals.css so every textbox lines up pixel-for-pixel.
 *
 * Usage:
 *   <Input placeholder="Tìm kiếm..." />
 *   <Input icon={Search} placeholder="..." />   // icon inside, auto-pl
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon: Icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {Icon && (
          <Icon className="input-icon text-muted-foreground/60" aria-hidden="true" />
        )}
        <input
          type={type}
          className={cn(
            "form-input",
            Icon && "input-with-icon",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
