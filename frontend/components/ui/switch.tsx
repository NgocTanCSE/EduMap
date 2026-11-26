import * as React from "react";
import { cn } from "@/src/lib/utils";
export interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    id?: string;
    "aria-label"?: string;
    className?: string;
}
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ checked, onCheckedChange, disabled, id, className, ...props }, ref) => {
    return (<button ref={ref} type="button" role="switch" aria-checked={checked} id={id} disabled={disabled} onClick={(e) => {
            e.preventDefault();
            if (!disabled)
                onCheckedChange(!checked);
        }} className={cn("inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50", checked ? "bg-primary border-primary" : "bg-muted border-border", className)} {...props}>
      <span className={cn("block h-4 w-4 rounded-full shadow transition-transform", checked ? "translate-x-[18px] bg-primary-foreground" : "translate-x-0 bg-foreground/40")}/>
    </button>);
});
Switch.displayName = "Switch";
export { Switch };
