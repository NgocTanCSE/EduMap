"use client";
import React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useResizable } from "@/src/hooks/useResizable";
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
    const { size: panelSize, onResizeMouseDown: onPanelResizeMouseDown } = useResizable({
        initialSize: { width: 380, height: 600 },
        minWidth: 300,
        maxWidth: 640,
        handleEdge: "left",
    });
    React.useEffect(() => {
        if (typeof document === "undefined")
            return;
        const root = document.documentElement;
        const railWidth = 56;
        const width = open ? panelSize.width + railWidth : railWidth;
        root.style.setProperty("--edumap-map-panel-w", `${width}px`);
        return () => {
            root.style.removeProperty("--edumap-map-panel-w");
        };
    }, [open, panelSize.width]);
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

      <section style={{ width: open ? panelSize.width : 0 }} className={`pointer-events-auto relative flex h-full flex-col overflow-hidden border-l bg-card/95 backdrop-blur-md transition-opacity duration-200 ${open
            ? "max-w-[calc(100vw_-_3.5rem)] border-border/80 opacity-100 shadow-pop"
            : "border-transparent opacity-0"}`}>
        {open && (<div role="separator" aria-orientation="vertical" aria-label="Kéo để đổi độ rộng bảng" title="Kéo để đổi độ rộng bảng" onMouseDown={onPanelResizeMouseDown} className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize select-none transition-colors hover:bg-primary/40"/>)}
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