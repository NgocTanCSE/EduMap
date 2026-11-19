"use client";
import React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface MapMenuItem {
    id: string;
    label: string;
    icon: React.ComponentType<{
        className?: string;
    }>;
    onClick: () => void;
    active?: boolean;
}

interface MapMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    groups: MapMenuItem[][];
    children: React.ReactNode;
}

export default function MapMenu({ open, onOpenChange, title, groups, children }: MapMenuProps) {
    return (<div className="pointer-events-none absolute inset-y-0 right-0 z-[50] flex items-stretch">
      <div className="pointer-events-auto flex h-full w-14 shrink-0 flex-col items-center gap-1 py-3">
        {groups.map((group, groupIndex) => (<React.Fragment key={groupIndex}>
            {groupIndex > 0 && <span className="my-1 h-px w-6 shrink-0 bg-border/70"/>}
            {group.map((item) => {
                const Icon = item.icon;
                return (<button key={item.id} type="button" onClick={item.onClick} aria-label={item.label} aria-pressed={!!item.active} title={item.label} className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-orvel backdrop-blur transition-all active:scale-95 ${item.active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 bg-card/90 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-foreground"}`}>
                  <Icon className="h-4 w-4"/>
                  <span className="pointer-events-none absolute right-[calc(100%_+_8px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-orvel transition-opacity duration-150 group-hover:opacity-100">
                    {item.label}
                  </span>
                </button>);
            })}
          </React.Fragment>))}
        <button type="button" onClick={() => onOpenChange(!open)} aria-label={open ? "Thu gọn bảng" : "Mở rộng bảng"} title={open ? "Thu gọn bảng" : "Mở rộng bảng"} className="mt-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-orvel backdrop-blur transition-all hover:text-foreground active:scale-95">
          {open ? <ChevronRight className="h-4 w-4"/> : <ChevronLeft className="h-4 w-4"/>}
        </button>
      </div>

      <section className={`pointer-events-auto flex h-full flex-col overflow-hidden border-l bg-card/95 backdrop-blur-md transition-all duration-200 ${open
            ? "w-[380px] max-w-[calc(100vw_-_3.5rem)] border-border/80 opacity-100 shadow-pop"
            : "w-0 border-transparent opacity-0"}`}>
        <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Đóng bảng" className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95">
            <X className="h-4 w-4"/>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          {open ? children : null}
        </div>
      </section>
    </div>);
}