"use client";
import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/src/lib/utils";
interface DetailPopupProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    contentClassName?: string;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
}
const MAX_WIDTH_CLASS = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
} as const;
export function DetailPopup({ open, onClose, title, subtitle, children, contentClassName, maxWidth = "2xl", }: DetailPopupProps) {
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                onClose();
        };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "overflow-hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={cn("fixed inset-y-0 right-0 z-[100] w-full bg-card border-l border-border shadow-2xl transform transition-transform duration-300 ease-out flex flex-col", MAX_WIDTH_CLASS[maxWidth], maxWidth === "2xl" ? "max-w-[40rem]" : "")} onClick={(e) => e.stopPropagation()} style={{
            width: "min(100% - 2rem, var(--popup-w, 640px))",
            maxWidth: "var(--popup-w, 640px)",
        }}>
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1">
            {title && (<h3 className="text-lg font-bold text-foreground truncate">
                {title}
              </h3>)}
            {subtitle && (<div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                {subtitle}
              </div>)}
          </div>
          <button onClick={onClose} className="ml-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0" aria-label="Đóng">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className={cn("flex-1 overflow-y-auto scrollbar-hide p-6 space-y-4", contentClassName)}>
          {children}
        </div>
      </div>
    </div>);
}
