import * as React from "react";
import { cn } from "@/src/lib/utils";
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ElementType;
}
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, icon: Icon, ...props }, ref) => {
    return (<div className="relative w-full">
        {Icon && (<Icon className="input-icon text-muted-foreground/60" aria-hidden="true"/>)}
        <input type={type} className={cn("form-input", Icon && "input-with-icon", className)} ref={ref} {...props}/>
      </div>);
});
Input.displayName = "Input";
export { Input };
