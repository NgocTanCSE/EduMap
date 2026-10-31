"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnimatedThemeTogglerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function AnimatedThemeToggler({
  className,
  size = "md",
}: AnimatedThemeTogglerProps) {
  const [isDark, setIsDark] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Check initial theme from document or localStorage
    const savedTheme = localStorage.getItem("edumap_theme");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialDark = savedTheme === "dark" || (!savedTheme && systemDark);

    if (initialDark) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextDark = !isDark;

    const applyTheme = () => {
      setIsDark(nextDark);
      if (nextDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("edumap_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("edumap_theme", "light");
      }
      window.dispatchEvent(new CustomEvent("edumap_theme_changed", { detail: { isDark: nextDark } }));
    };

    // Use document.startViewTransition for the viral Magic UI circular wave effect
    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      buttonRef.current
    ) {
      const rect = buttonRef.current.getBoundingClientRect();
      const { left, top, width, height } = rect;
      const x = left + width / 2;
      const y = top + height / 2;
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = (document as any).startViewTransition(() => {
        applyTheme();
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 450,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      }).catch(() => {
        applyTheme();
      });
    } else {
      applyTheme();
    }
  }, [isDark]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggleTheme}
      className={cn(
        "group relative flex items-center justify-center rounded-xl border border-border/80 bg-card p-2 text-foreground shadow-xs transition-all duration-200 hover:border-primary/50 hover:bg-secondary/70 hover:shadow-pop active:scale-95",
        size === "sm" && "h-8 w-8",
        size === "md" && "h-10 w-10",
        size === "lg" && "h-12 w-12",
        className
      )}
      title={isDark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
      aria-label="Chuyển đổi giao diện Sáng / Tối"
    >
      <Sun
        className={cn(
          "h-4 w-4 transition-all duration-300",
          isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100 text-primary"
        )}
      />
      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          isDark ? "scale-100 rotate-0 opacity-100 text-accent" : "scale-0 -rotate-90 opacity-0"
        )}
      />
    </button>
  );
}

export default AnimatedThemeToggler;
