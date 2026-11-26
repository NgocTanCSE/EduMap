import * as React from "react";
import { cn } from "@/src/lib/utils";
import { Check } from "lucide-react";
export interface CheckboxProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    id?: string;
    "aria-label"?: string;
    className?: string;
}
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(({ className, checked, onCheckedChange, disabled, id, "aria-label": ariaLabel }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (disabled)
            return;
        onCheckedChange(!checked);
    };
    return (<button ref={ref} id={id} type="button" role="checkbox" aria-checked={checked} aria-label={ariaLabel} disabled={disabled} onClick={handleClick} className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50", checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/60", className)}>
      {checked && <Check className="h-3 w-3" aria-hidden="true"/>}
    </button>);
});
Checkbox.displayName = "Checkbox";
export { Checkbox };
