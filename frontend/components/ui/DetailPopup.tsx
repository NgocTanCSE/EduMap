"use client";

/**
 * DetailPopup — overlay modal thay thế cho việc chuyển trang chi tiết.
 *
 * Thay thế pattern `router.push('/detail/${id}')` / `<Link href="/detail/${id}">`
 * trên các trang list (scholarships, opportunities, community posts, events,
 * mentor) bằng một overlay hiển thị nội dung chi tiết tương tự như map pin popup.
 *
 * Usage:
 *   <DetailPopup open={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.name}>
 *     <DetailContent item={selectedItem} />
 *   </DetailPopup>
 *
 * Features:
 *   - Full-viewport overlay (z-50) với backdrop blur
 *   - Right-side slide-in animation
 *   - max-h-[90dvh] + overflow-y-auto để nội dung dài scroll thay vì tràn
 *   - Responsive: full-width mobile (mx-4), max-w-2xl desktop
 *   - Nút đóng ở góc, Esc để đóng, backdrop click để đóng
 *   - Uses Desert Dusk design tokens (card bg, border-border, etc.)
 */
import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailPopupProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Optional subtitle / metadata shown under the title */
  subtitle?: React.ReactNode;
  /** Content body */
  children: React.ReactNode;
  /** Extra classes for the content area */
  contentClassName?: string;
  /** Maximum width — defaults to max-w-2xl (640px) */
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

export function DetailPopup({
  open,
  onClose,
  title,
  subtitle,
  children,
  contentClassName,
  maxWidth = "2xl",
}: DetailPopupProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Prevent body scroll when popup is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "overflow-hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-[100] w-full bg-card border-l border-border shadow-2xl transform transition-transform duration-300 ease-out flex flex-col",
          MAX_WIDTH_CLASS[maxWidth],
          maxWidth === "2xl" ? "max-w-[40rem]" : "",
        )}
        onClick={(e) => e.stopPropagation()}
        style={{
          /* On mobile, use full width with mx-4; on desktop, use the max-width */
          width: "min(100% - 2rem, var(--popup-w, 640px))",
          maxWidth: "var(--popup-w, 640px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-lg font-bold text-foreground truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <div className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className={cn(
            "flex-1 overflow-y-auto scrollbar-hide p-6 space-y-4",
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
