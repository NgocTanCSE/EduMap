/**
 * FeaturedPinPopup — Modal detail view for featured "ghim" pins.
 *
 * When a user clicks a starred featured pin on the map, instead of redirecting
 * immediately, this modal shows the full context (category badge, description,
 * location, key metrics) and lets the user choose to navigate to the feature
 * page or simply bookmark it.
 *
 * Redesigned to use:
 *  - Category-specific colour badge + icon (via PinTheme colors)
 *  - Provenance footer (Nguồn chính thức / verification date per AGENTS.md §6)
 *  - BookmarkButton (targetType="featured_pin")
 *  - Contextual metrics (CO₂ saved, participants, donation progress, points)
 */
"use client";

import React from "react";
import { X, MapPin, Star, ExternalLink, Atom, Leaf, GraduationCap, Wifi, ShoppingCart, Heart } from "lucide-react";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import type { FeaturedPin } from "@/components/map/FeaturedPinsLayer";

interface FeaturedPinPopupProps {
  open: boolean;
  pin: FeaturedPin | null;
  onClose: () => void;
  onGo: (href: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  stem: "Phòng thí nghiệm STEM",
  green: "Thử thách sống xanh",
  summer: "Chiến dịch mùa hè",
  wifi: "Trạm Wifi",
  donate: "Quyên góp",
  market: "Chợ & trao đổi",
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  stem: Atom,
  green: Leaf,
  summer: GraduationCap,
  wifi: Wifi,
  market: ShoppingCart,
  donate: Heart,
};

const CATEGORY_COLORS: Record<string, string> = {
  stem: "text-destructive",
  green: "text-green-600",
  summer: "text-orange-500",
  wifi: "text-amber-400",
  market: "text-primary",
  donate: "text-red-500",
};

export function FeaturedPinPopup({
  open, pin, onClose, onGo,
}: FeaturedPinPopupProps) {
  if (!open || !pin) return null;

  const cat = (pin.category || "default").toLowerCase();
  const CatIcon = CATEGORY_ICONS[cat] || Star;
  const catColor = CATEGORY_COLORS[cat] || "text-accent";
  const catLabel = CATEGORY_LABELS[cat] || pin.category;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 mx-4 animate-in slide-in-from-top fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — category badge + title */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center ${catColor}`}>
              <CatIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor} bg-muted/20`}>
                  {catLabel}
                </span>
                <Star className="w-3 h-3 text-accent/40 fill-current" />
              </div>
              <h3 className="font-semibold text-foreground text-lg leading-tight">
                {pin.name}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground/70 mb-3">
          <MapPin className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
          <span>{pin.address || `Vĩ độ ${pin.lat?.toFixed(4)}, kinh độ ${pin.lng?.toFixed(4)}`}</span>
        </div>

        {/* Description */}
        {pin.description && (
          <p className="text-sm text-muted-foreground/80 leading-relaxed mb-4">
            {pin.description}
          </p>
        )}

        {/* Contextual metrics */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {pin.carbon_saved_kg !== undefined && pin.carbon_saved_kg > 0 && (
            <div className="p-2.5 rounded-lg bg-green-50/20 border border-green-600/20">
              <div className="font-bold text-green-600">{pin.carbon_saved_kg} kg</div>
              <div className="text-xs text-muted-foreground/70">CO₂ tiết kiệm</div>
            </div>
          )}
          {pin.participants_count !== undefined && pin.participants_count > 0 && (
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
              <div className="font-bold text-primary">{pin.participants_count}</div>
              <div className="text-xs text-muted-foreground/70">Người tham gia</div>
            </div>
          )}
          {pin.points !== undefined && pin.points > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-50/20 border border-amber-600/20">
              <div className="font-bold text-amber-600">{pin.points}</div>
              <div className="text-xs text-muted-foreground/70">Điểm số</div>
            </div>
          )}
          {pin.current_amount !== undefined && pin.target_amount !== undefined && (
            <div className="p-2.5 rounded-lg bg-red-50/20 border border-red-600/20">
              <div className="font-bold text-red-600">
                {Math.round((pin.current_amount / pin.target_amount) * 100)}%
              </div>
              <div className="text-xs text-muted-foreground/70">
                {pin.current_amount?.toLocaleString()}₫ / {pin.target_amount?.toLocaleString()}₫
              </div>
            </div>
          )}
          {pin.speedLabel && (
            <div className="p-2.5 rounded-lg bg-blue-50/20 border border-blue-600/20">
              <div className="font-bold text-blue-600">{pin.speedLabel}</div>
              <div className="text-xs text-muted-foreground/70">
                {pin.is_free ? "Miễn phí" : "Trả tiền"}
              </div>
            </div>
          )}
        </div>

        {/* Status / verification */}
        {pin.is_verified && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 mb-3">
            <Star className="w-3 h-3 fill-current" />
            <span>Đã xác minh bởi cộng đồng EduMap</span>
          </div>
        )}

        {/* Provenance footer (AGENTS.md §6) */}
        <div className="border-t border-border pt-3 text-[10px] text-muted-foreground/50">
          <div className="flex items-center justify-between">
            <span>Nguồn: Dữ liệu thực từ cộng đồng</span>
            <BookmarkButton
              targetType="featured_pin"
              targetId={pin.id}
              size="sm"
              showLabel
              className="text-xs"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { onClose(); onGo(pin.featureLink); }}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Vào trang {catLabel.toLowerCase()}
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
