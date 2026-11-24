"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { DashboardContent } from "./DashboardContent";
export function DashboardDrawer({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}) {
    useEffect(() => {
        if (!open)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onClose]);
    return (<>
      {open && <div className="fixed inset-0 z-[55]" onClick={onClose} aria-hidden="true"/>}
      <aside role="dialog" aria-modal="true" aria-label="Bảng điều khiển" aria-hidden={!open} className={cn("fixed inset-y-0 right-0 z-[60] flex w-[min(480px,100vw)] flex-col border-l border-border/80 bg-background shadow-pop transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4">
          <h2 className="text-sm font-semibold text-foreground">Bảng điều khiển</h2>
          <button type="button" onClick={onClose} aria-label="Đóng bảng điều khiển" className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/70">
            <X className="h-4 w-4"/>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {open ? <DashboardContent variant="drawer"/> : null}
        </div>
      </aside>
    </>);
}
export default DashboardDrawer;
