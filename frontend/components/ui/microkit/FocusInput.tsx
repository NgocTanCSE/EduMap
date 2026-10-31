"use client";

import React, { useRef, useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FocusInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  shortcut?: string;
  onClear?: () => void;
  className?: string;
  icon?: React.ElementType;
}

export function FocusInput({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  shortcut = "⌘K",
  onClear,
  className,
  icon: Icon = Search,
  ...props
}: FocusInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Shortcut key listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClear = () => {
    onChange("");
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        "group relative flex w-full items-center rounded-xl border bg-card transition-all duration-200",
        isFocused
          ? "border-primary ring-4 ring-primary/10 shadow-pop"
          : "border-border/70 hover:border-border shadow-sm",
        className
      )}
    >
      {/* Leading Icon */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isFocused && "scale-110 text-primary"
          )}
        />
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="h-11 w-full bg-transparent pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
        {...props}
      />

      {/* Trailing actions: Clear button and shortcut badge */}
      <div className="flex items-center gap-1.5 pr-3">
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Xóa nội dung"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : shortcut ? (
          <kbd className="pointer-events-none hidden items-center rounded border border-border/70 bg-secondary/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-sm sm:inline-flex">
            {shortcut}
          </kbd>
        ) : null}
      </div>
    </div>
  );
}

export default FocusInput;

