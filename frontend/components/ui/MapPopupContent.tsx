"use client";

/**
 * MapPopupContent — reusable popup body for both regular POI markers and
 * featured "ghim" pins.
 *
 * Fixes:
 *   - Width capped at 420px (was 720px — too wide for the content, leaving
 *     blank space on the right while text was tiny).
 *   - Text scale bumped to readable sizes:
 *       title     text-base → was text-sm
 *       address   text-xs   → was text-[11px]
 *       amenities text-xs   → was text-[9px]
 *       body      text-sm   → was text-[10px]
 *       list      text-sm   → was text-[10px]
 *       buttons   text-xs   → was text-[9px]
 *   - Nearby facilities list uses max-h + overflow so it can't balloon the
 *     popup beyond the viewport.
 *
 * The component receives pre-resolved data (not raw point objects) so it can
 * be unit-tested in isolation and re-used from InteractiveMap's two popup
 * variants (POI marker + featured pin).
 */
import React from "react";
import { ShieldCheck, Star } from "lucide-react";

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
  icon?: React.ComponentType<{ className?: string }>;
}

export interface MapPopupContentProps {
  /** POI or featured-pin name — shown as the title */
  title: string;
  /** Physical address / district */
  address?: string;
  /** Longer description text */
  description?: string;
  /** Own amenities (wifi, parking, toilets…) — compact icon+label chips */
  amenities?: PoiAmenity[];
  /** Nearby facilities within 1 km, with a route-to action */
  nearbyPoints?: NearbyFacility[];
  /** True when this POI is the currently selected point (shows nearby list) */
  showNearby?: boolean;
  /** Route user to a nearby facility */
  onRouteNearby?: (p: NearbyFacility) => void;
  /** Route user to this POI itself */
  onRouteHere?: () => void;
  /** Verified badge — always shown for POI popups */
  showVerified?: boolean;
  /** Featured-pin category tag (e.g. "STEM", "WiFi") */
  categoryTag?: string;
  /** Featured-pin "Đến" (visit) button — when provided, links to featureLink */
  featureLink?: string;
  /** Custom icon for a nearby facility when the caller resolved one */
  facilityIcons?: Record<string, React.ComponentType<{ className?: string }>>;
}

function AmenityLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground/80">
      <span aria-hidden="true">{icon.replace(/[{}]/g, "")}</span>
      <span>{label}</span>
    </span>
  );
}

export function MapPopupContent({
  title,
  address,
  description,
  amenities,
  nearbyPoints,
  showNearby = false,
  onRouteNearby,
  onRouteHere,
  showVerified = false,
  categoryTag,
  featureLink,
  facilityIcons,
}: MapPopupContentProps) {
  const hasNearby = showNearby && nearbyPoints && nearbyPoints.length > 0;
  const hasActions = onRouteHere || (featureLink && categoryTag);

  return (
    <div className="map-popup max-w-[420px] bg-card text-foreground font-sans">
      {/* Title */}
      <h4 className="text-base font-bold text-foreground leading-tight mb-1">
        {title}
      </h4>

      {/* Address */}
      {address && (
        <p className="text-xs text-muted-foreground/70 mb-2">{address}</p>
      )}

      {/* Own amenities */}
      {amenities && amenities.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {amenities.map((a) => (
            <AmenityLabel key={a.icon} icon={a.icon} label={a.label} />
          ))}
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground/80 leading-snug mb-2 line-clamp-3">
          {description}
        </p>
      )}

      {/* Nearby facilities (≤1km) */}
      {hasNearby && (
        <div className="pt-2 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
            Tiện ích xung quanh (≤1km)
          </p>
          <ul className="space-y-1 max-h-44 overflow-y-auto">
            {nearbyPoints!.map((f) => {
              const Fi = facilityIcons?.[f.category] ?? f.icon;
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-1 text-xs text-muted-foreground/70"
                >
                  <span className="flex items-center gap-1 truncate">
                    {Fi && React.createElement(Fi, { className: "w-3.5 h-3.5 text-accent" })}
                    <span>{f.name}</span>
                  </span>
                  {onRouteNearby && (
                    <button
                      onClick={() => onRouteNearby(f)}
                      className="underline text-xs font-bold text-accent hover:text-accent/80"
                    >
                      Đến
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Footer actions */}
      {hasActions && (
        <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
          {showVerified && (
            <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-accent">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified</span>
            </div>
          )}
          {categoryTag && (
            <span className="text-xs font-bold uppercase text-primary/80">
              Ghim {categoryTag}
            </span>
          )}
          <div className="flex items-center gap-2">
            {onRouteHere && (
              <button
                onClick={onRouteHere}
                className="bg-card text-foreground text-xs font-bold px-2.5 py-1 rounded hover:bg-primary/20 transition-colors"
              >
                Dẫn đường
              </button>
            )}
            {featureLink && (
              <button
                onClick={() => (window.location.href = featureLink)}
                className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded hover:bg-primary/80 transition-colors flex items-center gap-1"
              >
                <Star className="w-3 h-3 fill-current" />
                Đến
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** CSS class applied to the popup content — overrides Leaflet's default
    zero-padding/margin (set in globals.css `.leaflet-popup-content`). */
export const POPUP_CONTENT_CLASS = "p-2";
