"use client";
import React from "react";
import { ShieldCheck, Star } from "lucide-react";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
export interface PoiAmenity {
    icon: string;
    label: string;
}
export interface NearbyFacility {
    id: string;
    name: string;
    category: string;
    lat: number;
    lng: number;
    icon?: React.ComponentType<{
        className?: string;
    }>;
}
export interface MapPopupContentProps {
    title: string;
    address?: string;
    description?: string;
    amenities?: PoiAmenity[];
    nearbyPoints?: NearbyFacility[];
    showNearby?: boolean;
    onRouteNearby?: (p: NearbyFacility) => void;
    onRouteHere?: () => void;
    showVerified?: boolean;
    categoryTag?: string;
    featureLink?: string;
    facilityIcons?: Record<string, React.ComponentType<{
        className?: string;
    }>>;
    poiId?: string;
    carbonSaved?: number;
    participants?: number;
    points?: number;
    currentAmount?: number;
    targetAmount?: number;
    speedLabel?: string;
    isFree?: boolean;
}
function AmenityLabel({ icon, label }: {
    icon: string;
    label: string;
}) {
    return (<span className="flex items-center gap-1 text-xs text-muted-foreground/80">
      <span aria-hidden="true">{icon.replace(/[{}]/g, "")}</span>
      <span>{label}</span>
    </span>);
}
export function MapPopupContent({ title, address, description, amenities, nearbyPoints, showNearby = false, onRouteNearby, onRouteHere, showVerified = false, categoryTag, featureLink, facilityIcons, poiId, carbonSaved, participants, points, currentAmount, targetAmount, speedLabel, isFree, }: MapPopupContentProps) {
    const hasNearby = showNearby && nearbyPoints && nearbyPoints.length > 0;
    const hasActions = onRouteHere || (featureLink && categoryTag);
    return (<div className="map-popup max-w-[420px] bg-card text-foreground font-sans">
      <h4 className="text-base font-bold text-foreground leading-tight mb-1">
        {title}
      </h4>

      {address && (<p className="text-xs text-muted-foreground/70 mb-2">{address}</p>)}

      {amenities && amenities.length > 0 && (<div className="flex items-center gap-2 flex-wrap mb-2">
          {amenities.map((a) => (<AmenityLabel key={a.icon} icon={a.icon} label={a.label}/>))}
        </div>)}

      {description && (<p className="text-sm text-muted-foreground/80 leading-snug mb-2 line-clamp-3">
          {description}
        </p>)}

      {carbonSaved !== undefined && carbonSaved > 0 && (<p className="text-xs text-muted-foreground/60 mb-1">
          • CO₂ tiết kiệm: <b className="text-green-600">{carbonSaved} kg</b>
        </p>)}
      {participants !== undefined && participants > 0 && (<p className="text-xs text-muted-foreground/60 mb-1">
          • {participants} người tham gia
        </p>)}
      {points !== undefined && (<p className="text-xs text-muted-foreground/60 mb-1">
          • {points} điểm
        </p>)}
      {speedLabel && (<p className="text-xs text-muted-foreground/60 mb-1">
          • Tốc độ: {speedLabel} {isFree !== undefined && (isFree ? "· Miễn phí" : "· Trả tiền")}
        </p>)}
      {currentAmount !== undefined && targetAmount !== undefined && (<p className="text-xs text-muted-foreground/60 mb-1">
          • Quyên góp: <b className="text-primary">{currentAmount?.toLocaleString()}₫</b> / {targetAmount?.toLocaleString()}₫
        </p>)}

      {hasNearby && (<div className="pt-2 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
            Tiện ích xung quanh (≤1km)
          </p>
          <ul className="space-y-1 max-h-44 overflow-y-auto">
            {nearbyPoints!.map((f) => {
                const Fi = facilityIcons?.[f.category] ?? f.icon;
                return (<li key={f.id} className="flex items-center justify-between gap-1 text-xs text-muted-foreground/70">
                  <span className="flex items-center gap-1 truncate">
                    {Fi && React.createElement(Fi, { className: "w-3.5 h-3.5 text-accent" })}
                    <span>{f.name}</span>
                  </span>
                  {onRouteNearby && (<button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRouteNearby(f); }} className="underline text-xs font-bold text-accent hover:text-accent/80">
                      Đến
                    </button>)}
                </li>);
            })}
          </ul>
        </div>)}

      {hasActions && (<div className="flex items-center justify-between pt-2 border-t border-border mt-2">
          {showVerified && (<div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-accent">
              <ShieldCheck className="w-3.5 h-3.5"/>
              <span>Đã xác minh</span>
            </div>)}
          {categoryTag && (<span className="text-xs font-bold uppercase text-primary/80">
              Ghim {categoryTag}
            </span>)}
          <div className="flex items-center gap-2">
            {poiId && (<BookmarkButton targetType="poi" targetId={poiId} size="sm" className="h-6 w-6 p-0"/>)}
            {onRouteHere && (<button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRouteHere(); }} className="bg-card text-foreground text-xs font-bold px-2.5 py-1 rounded hover:bg-primary/20 transition-colors">
                Dẫn đường
              </button>)}
            {featureLink && (<button onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = featureLink; }} className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded hover:bg-primary/80 transition-colors flex items-center gap-1">
                <Star className="w-3 h-3 fill-current"/>
                Đến
              </button>)}
          </div>
        </div>)}
    </div>);
}
export const POPUP_CONTENT_CLASS = "p-2";
