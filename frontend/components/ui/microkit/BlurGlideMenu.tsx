"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  onClick?: () => void;
  active?: boolean;
}

export interface BlurGlideMenuProps {
  items: MenuItem[];
  className?: string;
  activeId?: string;
  onSelect?: (id: string) => void;
}

export function BlurGlideMenu({
  items,
  className,
  activeId,
  onSelect,
}: BlurGlideMenuProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <nav
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/80 bg-card/85 p-1.5 shadow-pop backdrop-blur-xl",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeId ? activeId === item.id : item.active;
        const isHovered = hoveredId === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => {
              if (item.onClick) item.onClick();
              if (onSelect) onSelect(item.id);
            }}
            className={cn(
              "group relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 sm:h-11 sm:w-11",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            )}
            title={item.label}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-transform duration-200",
                isHovered && "scale-115",
                isActive && "scale-105"
              )}
            />

            {item.badge !== undefined && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white shadow-sm">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default BlurGlideMenu;

