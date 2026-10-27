import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link" | "secondary"
  size?: "default" | "sm" | "lg" | "icon" | "md"
  /** Icon shown next to the label when not loading.
   *  The icon slot always occupies the same width so swapping the icon
   *  for a spinner (or removing it) never shifts the label. */
  icon?: React.ReactNode
  /** When true a spinner replaces the icon and the button is disabled. */
  loading?: boolean
  /** Optional short text shown exclusively while loading.
   *  Falls back to `children` when not provided. */
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", loading, icon, loadingText, children, disabled, ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      outline: "border border-border bg-background hover:bg-muted text-foreground",
      ghost: "hover:bg-muted text-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    };
    const sizes = {
      sm: "h-9 rounded-lg px-3 text-xs",
      md: "h-10 rounded-lg px-3.5 text-sm",
      default: "h-11 rounded-lg px-4 py-2.5 text-sm font-semibold",
      lg: "h-12 rounded-lg px-6 py-3 text-base font-semibold",
      icon: "h-10 w-10 rounded-lg p-2",
    };

    const showSpinner = !!loading
    // Render the icon (or spinner) in a fixed-width slot so the label
    // never jumps left/right when the button enters a loading state.
    const IconNode = showSpinner ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : icon ? (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
    ) : null

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {IconNode}
        {loading && loadingText ? loadingText : children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
