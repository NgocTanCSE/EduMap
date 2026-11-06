import * as React from "react";
import { cn } from "@/src/lib/utils";
export default function ContentShell({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (<div className={cn("w-full space-y-8 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8", className)} {...props}>
      {children}
    </div>);
}
