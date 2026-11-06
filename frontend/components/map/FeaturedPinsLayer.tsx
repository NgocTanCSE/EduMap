"use client";
import React from "react";
import { Marker, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Star, MapPin, Atom, Leaf, GraduationCap, Wifi, Heart, ShoppingCart, type LucideIcon, } from "lucide-react";
import { createPinIcon, createClusterIcon, type PinBadge } from "./PinTheme";
export interface FeaturedPin {
    id: string;
    name: string;
    category: string;
    lat: number;
    lng: number;
    description?: string;
    address?: string;
    featureLink: string;
    icon_variant?: string;
    is_verified?: boolean;
    points?: number;
    carbon_saved_kg?: number;
    participants_count?: number;
    current_amount?: number;
    target_amount?: number;
    speed_label?: string;
    is_free?: boolean;
    status?: string;
}
export interface FeaturedPinsLayerProps {
    pins: FeaturedPin[];
    visible?: boolean;
    visibleCategories?: Set<string>;
    hiddenCategories?: Set<string>;
    onPinClick?: (pin: FeaturedPin) => void;
    getBadge?: (pin: FeaturedPin) => PinBadge | undefined;
    showTooltips?: boolean;
}
function defaultBadge(pin: FeaturedPin): PinBadge | undefined {
    const cat = pin.category.toLowerCase();
    if (pin.is_verified)
        return { type: "verified" };
    switch (cat) {
        case "green":
            if (pin.status === "active")
                return { type: "progress", value: 75 };
            if (pin.status === "completed")
                return { type: "verified" };
            return { type: "new" };
        case "summer":
            return { type: "new" };
        case "wifi":
            return pin.is_verified ? { type: "verified" } : undefined;
        case "donate":
            if (pin.target_amount && pin.current_amount) {
                const pct = Math.round((pin.current_amount / pin.target_amount) * 100);
                return { type: "progress", value: pct };
            }
            return undefined;
        case "market":
            return undefined;
        case "stem":
            return pin.is_verified ? { type: "verified" } : { type: "new" };
        default:
            return undefined;
    }
}
function categoryLegendIcon(category: string): LucideIcon {
    switch (category) {
        case "stem": return Atom as LucideIcon;
        case "green": return Leaf as LucideIcon;
        case "summer": return GraduationCap as LucideIcon;
        case "wifi": return Wifi as LucideIcon;
        case "donate": return Heart as LucideIcon;
        case "market": return ShoppingCart as LucideIcon;
        default: return Star as LucideIcon;
    }
}
export function FeaturedPinsLayer({ pins, visible = true, visibleCategories, hiddenCategories, onPinClick, getBadge, showTooltips = true, }: FeaturedPinsLayerProps) {
    const map = useMap();
    const badgeResolver = getBadge || defaultBadge;
    if (!visible || !pins.length)
        return null;
    const filtered = pins.filter((p) => {
        if (!Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng)))
            return false;
        if (hiddenCategories && hiddenCategories.has(p.category))
            return false;
        if (visibleCategories && visibleCategories.size > 0 && !visibleCategories.has(p.category))
            return false;
        return true;
    });
    if (filtered.length === 0)
        return null;
    return (<MarkerClusterGroup chunkedLoading disableClusteringAtZoom={16} iconCreateFunction={(cluster: {
            getChildCount: () => number;
        }) => {
            const count = cluster.getChildCount();
            return createClusterIcon(count);
        }}>
      {filtered.map((pin) => {
            const lat = Number(pin.lat);
            const lng = Number(pin.lng);
            const badge = badgeResolver(pin);
            const icon = createPinIcon(pin.category, badge);
            return (<Marker key={pin.id} position={[lat, lng]} icon={icon} eventHandlers={{
                    click: (e) => {
                        e.originalEvent?.stopPropagation?.();
                        if (onPinClick)
                            onPinClick(pin);
                        map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
                    },
                }}>
            {showTooltips && (<Tooltip direction="top" offset={[0, -30]} opacity={1} className="pin-tooltip">
                <span className="font-bold text-xs text-foreground">{pin.name}</span>
              </Tooltip>)}
          </Marker>);
        })}
    </MarkerClusterGroup>);
}
export type { PinBadge };
const _ = categoryLegendIcon;
