"use client";

import React from "react";
import { MapPin, X, ExternalLink, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Popup thay vì redirect ra trang riêng — keeps user on current page and lets
 * them open the map tool inside the unified Map Hub (/map?tool=<id>).
 *
 * Used by pages that previously redirected (climate-guardian, voice-search,
 * ai-agent, wifi, map/*, green, talk2map, …) per Image 13 requirement.
 */
interface MapToolRedirectPopupProps {
  open: boolean;
  onClose: () => void;
  /** Map tool id, e.g. "climate", "voice-search", "wifi". */
  toolId: string;
  /** Human-readable label, e.g. "AI Bảo Vệ Khí Hậu". */
  toolLabel: string;
  /** Short description shown in the popup. */
  description?: string;
}

export function MapToolRedirectPopup({
  open,
  onClose,
  toolId,
  toolLabel,
  description,
}: MapToolRedirectPopupProps) {
  const router = useRouter();

  if (!open) return null;

  const handleOpenMap = () => {
    onClose();
    router.push(`/map?tool=${toolId}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 mx-4 animate-in slide-in-from-top fade-in duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">{toolLabel}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {description && (
          <p className="text-sm text-muted-foreground/80 leading-relaxed mb-6">
            {description}
          </p>
        )}

        <div className="text-xs text-muted-foreground/60 mb-6">
          Tính năng này được tích hợp vào Bản đồ EduMap. Nhấn "Mở trên bản đồ"
          để sử dụng.
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleOpenMap}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4" /> Mở trên bản đồ
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
