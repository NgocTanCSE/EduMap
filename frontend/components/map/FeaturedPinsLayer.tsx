/**
 * FeaturedPinsLayer — Centralised featured-pin ("ghim") rendering on the map.
 *
 * Replaces the inline `<MarkerClusterGroup>` block previously baked into
 * MapComponent. This component owns:
 *   - Star-shaped featured pins for every category (stem, green, summer, wifi, donate, market)
 *   - A dedicated cluster group with custom cluster icons
 *   - Per-category visibility filtering (so a tool overlay like GreenTool /
 *     WifiTool can request that its category be hidden from the featured layer
 *     to avoid duplicate markers)
 *   - Badge assignment (verified, new, progress, amount) via a `getBadge` callback
 *
 * The layer renders NOTHING when `visible` is false (e.g. heatmap is on, or
 * the user toggled off the "ghim" layer).
 */
"use client";

import React from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import {
  Star, MapPin, Atom, Leaf, GraduationCap, Wifi, Heart, ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { createPinIcon, createClusterIcon, type PinBadge } from "./PinTheme";
import { MapPopupContent } from "@/components/ui/MapPopupContent";

export interface FeaturedPin {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description?: string;
  address?: string;
  featureLink: string;
  /** Optional extra fields carried through for richer popups. */
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
  /** All featured pins from the backend. */
  pins: FeaturedPin[];
  /** Whether the whole layer is visible. */
  visible?: boolean;
  /** Set of categories currently visible — others are filtered out. */
  visibleCategories?: Set<string>;
  /** Categories that should be hidden because a tool overlay is rendering them. */
  hiddenCategories?: Set<string>;
  /** Callback when a pin is clicked. */
  onPinClick?: (pin: FeaturedPin) => void;
  /** Optional badge resolver — lets the parent attach per-pin badges. */
  getBadge?: (pin: FeaturedPin) => PinBadge | undefined;
  /** Whether to show tooltips on hover. */
  showTooltips?: boolean;
}

/**
 * Derive a PinBadge for a featured pin based on its category + fields.
 * This is the default badge strategy; callers can override via `getBadge`.
 */
function defaultBadge(pin: FeaturedPin): PinBadge | undefined {
  const cat = pin.category.toLowerCase();

  // Verified badge — always show for verified locations.
  if (pin.is_verified) return { type: "verified" };

  switch (cat) {
    case "green":
      if (pin.status === "active") return { type: "progress", value: 75 };
      if (pin.status === "completed") return { type: "verified" };
      return { type: "new" };
    case "summer":
      return { type: "new" };
    case "wifi":
      // Free wifi gets a "new" dot if not verified; verified gets check.
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

/** Compact SVG icon for the legend (rendered server-side, not as a Lucide import). */
function categoryLegendIcon(category: string): LucideIcon {
  switch (category) {
    case "stem":   return Atom as LucideIcon;
    case "green":  return Leaf as LucideIcon;
    case "summer": return GraduationCap as LucideIcon;
    case "wifi":   return Wifi as LucideIcon;
    case "donate": return Heart as LucideIcon;
    case "market": return ShoppingCart as LucideIcon;
    default:       return Star as LucideIcon;
  }
}

/**
 * FeaturedPinsLayer
 *
 * Renders all featured pins as clustered star-shaped markers. Supports
 * per-category toggling and badge rendering. When a tool overlay is active
 * for a category, pass that category in `hiddenCategories` to suppress the
 * featured pin (the tool renders its own version).
 */
export function FeaturedPinsLayer({
  pins,
  visible = true,
  visibleCategories,
  hiddenCategories,
  onPinClick,
  getBadge,
  showTooltips = true,
}: FeaturedPinsLayerProps) {
  const map = useMap();
  const badgeResolver = getBadge || defaultBadge;

  if (!visible || !pins.length) return null;

  // Filter: must be in visibleCategories (if set), must NOT be in hiddenCategories.
  const filtered = pins.filter((p) => {
    if (!Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) return false;
    if (hiddenCategories && hiddenCategories.has(p.category)) return false;
    if (visibleCategories && visibleCategories.size > 0 && !visibleCategories.has(p.category)) return false;
    return true;
  });

  if (filtered.length === 0) return null;

  // Use the same cluster group — react-leaflet-cluster renders its own
  // cluster icons via the `iconCreateFunction` prop.
  return (
    <MarkerClusterGroup
      chunkedLoading
      disableClusteringAtZoom={16}
      iconCreateFunction={(cluster) => {
        const count = cluster.getChildCount();
        return createClusterIcon(count);
      }}
    >
      {filtered.map((pin) => {
        const lat = Number(pin.lat);
        const lng = Number(pin.lng);
        const badge = badgeResolver(pin);
        const icon = createPinIcon(pin.category, badge);

        return (
          <Marker
            key={pin.id}
            position={[lat, lng]}
            icon={icon}
            eventHandlers={{
              click: () => {
                if (onPinClick) onPinClick(pin);
                // Center the map on the pin for a smooth UX.
                map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
              },
            }}
          >
            {showTooltips && (
              <Tooltip direction="top" offset={[0, -30]} opacity={1} className="pin-tooltip">
                <span className="font-bold text-xs text-foreground">{pin.name}</span>
              </Tooltip>
            )}
            <Popup>
              <MapPopupContent
                title={pin.name}
                address={pin.address}
                description={pin.description}
                categoryTag={pin.category}
                featureLink={pin.featureLink}
                showVerified={pin.is_verified}
                poiId={pin.id}
                // Pass extra data fields for richer popups
                {...(pin.carbon_saved_kg !== undefined && { carbonSaved: pin.carbon_saved_kg })}
                {...(pin.participants_count !== undefined && { participants: pin.participants_count })}
                {...(pin.points !== undefined && { points: pin.points })}
                {...(pin.current_amount !== undefined && pin.target_amount !== undefined && {
                  currentAmount: pin.current_amount,
                  targetAmount: pin.target_amount,
                })}
              />
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}

// Re-export badge type for consumers.
export type { PinBadge };

const _ = categoryLegendIcon; // keep import alive for external legend builders
