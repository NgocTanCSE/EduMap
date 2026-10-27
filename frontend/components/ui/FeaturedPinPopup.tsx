"use client";

import React from 'react';
import { X, MapPin, Star, ExternalLink, Save } from 'lucide-react';
import { BookmarkButton } from '@/components/ui/BookmarkButton';

interface FeaturedPinPopupProps {
  open: boolean;
  pin: { id: string; name: string; category: string; lat: number; lng: number; description?: string; address?: string; featureLink: string } | null;
  onClose: () => void;
  onGo: (href: string) => void;
}

/**
 * Popup chi tiết ghim đặc trưng — thay vì redirect ngay ra trang riêng,
 * hiển thị thông tin trong modal và để người dùng chọn vào trang.
 */
export function FeaturedPinPopup({
  open, pin, onClose, onGo,
}: FeaturedPinPopupProps) {
  if (!open || !pin) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 animate-in slide-in-from-top fade-in duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-foreground">{pin.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <MapPin className="w-3.5 h-3.5" />
          <span>{pin.address || `Vĩ độ ${pin.lat.toFixed(4)}, kinh độ ${pin.lng.toFixed(4)}`}</span>
        </div>

        {pin.description && (
          <p className="text-sm text-muted-foreground/80 leading-relaxed mb-6">
            {pin.description}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => { onClose(); onGo(pin.featureLink); }}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> Vào trang
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium"
          >
            Đóng
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <BookmarkButton
            targetType="featured_pin"
            targetId={pin.id}
            size="sm"
            showLabel
            className="text-sm"
          />
          <span className="text-xs text-muted-foreground/60">
            Lưu ghim để truy cập sau
          </span>
        </div>
      </div>
    </div>
  );
}
