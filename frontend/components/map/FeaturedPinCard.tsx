"use client";
import { X, MapPin, Star, ExternalLink, Navigation } from "lucide-react";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { getPinTheme, PIN_LEGEND } from "@/components/map/pin-themes";
import type { FeaturedPin } from "@/components/map/FeaturedPinsLayer";
interface FeaturedPinCardProps {
    pin: FeaturedPin;
    onClose: () => void;
    onGo: (href: string) => void;
    onOpenTool?: (toolId: string) => void;
    onRoute?: (pin: FeaturedPin) => void;
}
const MAP_TOOL_FOR_CATEGORY: Record<string, string> = {
    wifi: "wifi",
    green: "green",
    stem: "stem",
    summer: "summer",
    donate: "donate",
    market: "market",
};
export function FeaturedPinCard({ pin, onClose, onGo, onOpenTool, onRoute }: FeaturedPinCardProps) {
    const cat = (pin.category || "default").toLowerCase();
    const theme = getPinTheme(cat);
    const CatIcon = theme.icon;
    const catColor = theme.color;
    const catLabel = PIN_LEGEND.find((item) => item.category === cat)?.label || pin.category;
    return (<div className="card-surface p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center shrink-0 ${catColor}`}>
            <CatIcon className="w-4 h-4"/>
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catColor} bg-muted/20`}>
              {catLabel}
            </span>
            <h3 className="font-medium text-foreground text-sm leading-tight truncate mt-0.5">
              {pin.name}
            </h3>
          </div>
        </div>
        <button onClick={onClose} aria-label="Đóng" className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground/60 shrink-0">
          <X className="w-3 h-3"/>
        </button>
      </div>

      <div className="flex items-start gap-1.5 text-xs text-muted-foreground/70 mb-2">
        <MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0"/>
        <span>{pin.address || `Vĩ độ ${pin.lat?.toFixed(4)}, kinh độ ${pin.lng?.toFixed(4)}`}</span>
      </div>

      {pin.description && (<p className="text-xs text-muted-foreground/80 leading-relaxed mb-2 line-clamp-3">
          {pin.description}
        </p>)}

      <div className="grid grid-cols-2 gap-2 mb-2">
        {pin.carbon_saved_kg !== undefined && pin.carbon_saved_kg > 0 && (<div className="p-2 rounded-lg bg-green-50/20 border border-green-600/20">
            <div className="font-bold text-xs text-green-600">{pin.carbon_saved_kg} kg</div>
            <div className="text-[10px] text-muted-foreground/70">CO2 tiết kiệm</div>
          </div>)}
        {pin.participants_count !== undefined && pin.participants_count > 0 && (<div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
            <div className="font-bold text-xs text-primary">{pin.participants_count}</div>
            <div className="text-[10px] text-muted-foreground/70">Người tham gia</div>
          </div>)}
        {pin.points !== undefined && pin.points > 0 && (<div className="p-2 rounded-lg bg-amber-50/20 border border-amber-600/20">
            <div className="font-bold text-xs text-amber-600">{pin.points}</div>
            <div className="text-[10px] text-muted-foreground/70">Điểm số</div>
          </div>)}
        {Number(pin.current_amount) > 0 && Number(pin.target_amount) > 0 && (<div className="p-2 rounded-lg bg-red-50/20 border border-red-600/20">
            <div className="font-bold text-xs text-red-600">
              {Math.min(100, Math.round((Number(pin.current_amount) / Number(pin.target_amount)) * 100))}%
            </div>
            <div className="text-[10px] text-muted-foreground/70">
              {Number(pin.current_amount).toLocaleString()}₫ / {Number(pin.target_amount).toLocaleString()}₫
            </div>
          </div>)}
        {pin.speed_label && (<div className="p-2 rounded-lg bg-blue-50/20 border border-blue-600/20">
            <div className="font-bold text-xs text-blue-600">{pin.speed_label}</div>
            <div className="text-[10px] text-muted-foreground/70">
              {pin.is_free === true ? "Miễn phí" : pin.is_free === false ? "Trả tiền" : "Chưa rõ"}
            </div>
          </div>)}
      </div>

      {pin.is_verified && (<div className="flex items-center gap-1.5 text-[10px] text-green-600 mb-2">
          <Star className="w-3 h-3 fill-current"/>
          <span>Đã xác minh bởi cộng đồng EduMap</span>
        </div>)}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <BookmarkButton targetType="featured_pin" targetId={pin.id} size="sm" showLabel className="text-xs"/>
        <div className="flex items-center gap-1.5">
          {onRoute && (<button onClick={() => onRoute(pin)} className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">
              <Navigation className="w-3 h-3"/>
              Chỉ đường
            </button>)}
          {MAP_TOOL_FOR_CATEGORY[cat] && onOpenTool ? (<button onClick={() => onOpenTool(MAP_TOOL_FOR_CATEGORY[cat])} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              <CatIcon className="w-3 h-3"/>
              Xem trên bản đồ
            </button>) : (<button onClick={() => onGo(pin.featureLink)} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              <ExternalLink className="w-3 h-3"/>
              Mở trang {catLabel.toLowerCase()}
            </button>)}
        </div>
      </div>
    </div>);
}