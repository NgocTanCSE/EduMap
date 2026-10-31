/**
 * PinTheme — Centralized pin / marker visual system for the EduMap Map Hub.
 *
 * Three pin shapes:
 *  - `poi`      — tear-drop, for regular educational POIs (schools, labs, …)
 *  - `featured` — 5-point star, for "ghim" featured pins (stem, green, summer, wifi, donate, market)
 *  - `analysis` — rounded circle, for analysis-tool markers (survey candidates, safe-route origins)
 *
 * Each category maps to a colour token + a lucide icon rendered as inline SVG,
 * with optional badge support (verified checkmark, new dot, progress ring).
 *
 * All icons are rendered to static HTML via renderToStaticMarkup so they work
 * inside Leaflet divIcons without an icon-font dependency.
 */
"use client";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import {
  GraduationCap, BookOpen, Atom, Leaf, ShoppingCart, Heart,
  Wifi, Home as HomeIcon, MapPin, Shield, Target, Star,
  CheckCircle2, Clock, Construction, type LucideIcon,
} from "lucide-react";

// ── Shape definitions ───────────────────────────────────────────────────────

/** The three pin glyph shapes supported by the theme. */
export type PinShape = "poi" | "featured" | "analysis";

/** Pin size variants — used for visual hierarchy (e.g. selected, cluster hover). */
export type PinSize = "sm" | "md" | "lg";

const PIN_SIZE_PX: Record<PinSize, number> = { sm: 22, md: 28, lg: 34 };

// ── Badge definitions ───────────────────────────────────────────────────────

export type BadgeType = "verified" | "new" | "progress" | "amount" | "none";

export interface PinBadge {
  type: BadgeType;
  /** Value for `progress` (0–100) or `amount` (formatted string). */
  value?: number | string;
}

// ── Category → theme mapping ────────────────────────────────────────────────

export interface PinThemeDef {
  /** Tailwind colour token for the pin fill. */
  color: string;
  /** Lucide icon rendered inside the pin. */
  icon: LucideIcon;
  /** Default shape for this category. */
  shape: PinShape;
  /** Default size. */
  size: PinSize;
  /** Whether the pin should display a badge area (top-right of glyph). */
  badgeSlot?: boolean;
}

/**
 * Central registry: every map category → its pin styling.
 *
 * Categories are derived from `FeatureLink` / `getFeaturedPins` category values.
 * Keep this in sync with `FEATURE_LINK_MAP` in map.service.ts.
 */
export const PIN_THEMES: Record<string, PinThemeDef> = {
  // ── Featured pins (ghim) — star shape ──
  stem:      { color: "text-destructive",    icon: Atom,              shape: "featured", size: "md", badgeSlot: true },
  green:     { color: "text-green-600",      icon: Leaf,             shape: "featured", size: "md", badgeSlot: true },
  summer:    { color: "text-orange-500",     icon: GraduationCap,    shape: "featured", size: "md", badgeSlot: true },
  wifi:      { color: "text-amber-400",      icon: Wifi,             shape: "featured", size: "md", badgeSlot: true },
  market:    { color: "text-primary",        icon: ShoppingCart,     shape: "featured", size: "md", badgeSlot: true },
  donate:    { color: "text-red-500",        icon: Heart,            shape: "featured", size: "md", badgeSlot: true },

  // ── Regular POIs — tear-drop shape ──
  university: { color: "text-accent",       icon: GraduationCap,    shape: "poi", size: "md" },
  school:     { color: "text-accent",       icon: GraduationCap,    shape: "poi", size: "md" },
  library:    { color: "text-primary",       icon: BookOpen,         shape: "poi", size: "md" },
  bookstore:  { color: "text-destructive",   icon: BookOpen,         shape: "poi", size: "md" },
  lab:        { color: "text-primary",       icon: Atom,             shape: "poi", size: "md" },
  stem_poi:   { color: "text-destructive",   icon: Atom,             shape: "poi", size: "md" },
  green_poi:  { color: "text-green-600",     icon: Leaf,             shape: "poi", size: "md" },
  park:       { color: "text-green-600",     icon: Leaf,             shape: "poi", size: "md" },
  cafe:       { color: "text-orange-500",    icon: HomeIcon,         shape: "poi", size: "md" },
  restaurant: { color: "text-primary",       icon: HomeIcon,         shape: "poi", size: "md" },
  market_poi: { color: "text-primary",       icon: ShoppingCart,     shape: "poi", size: "md" },
  convenience:{ color: "text-amber-400",     icon: ShoppingCart,     shape: "poi", size: "md" },

  // ── Analysis / tool markers — circle shape ──
  survey:     { color: "text-purple-500",    icon: Target,           shape: "analysis", size: "md", badgeSlot: true },
  route_origin: { color: "text-blue-500",    icon: MapPin,           shape: "analysis", size: "md" },
  route_dest:   { color: "text-red-500",     icon: MapPin,           shape: "analysis", size: "md" },
  hazard:      { color: "text-destructive",   icon: Shield,           shape: "analysis", size: "md", badgeSlot: true },
  gap:         { color: "text-muted-foreground", icon: Construction,  shape: "analysis", size: "md" },

  // ── Fallback ──
  _default:    { color: "text-muted-foreground", icon: MapPin, shape: "poi", size: "md" },
};

/** Get theme for a category, falling back to `_default`. */
export function getPinTheme(category: string): PinThemeDef {
  const key = (category || "_default").toLowerCase();
  return PIN_THEMES[key] || PIN_THEMES["_default"];
}

// ── SVG glyph definitions ───────────────────────────────────────────────────
// These are the shape outlines rendered behind the category icon.
// `fill="currentColor"` makes the shape follow the category colour token.

/** Tear-drop shape glyph (regular POI pin). */
const TEAR_DROP_SVG =
  `<svg viewBox="0 0 24 24" class="absolute inset-0 w-full h-full" fill="none"><path fill="currentColor" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;

/** 5-point star glyph (featured "ghim" pin). */
const STAR_SVG =
  `<svg viewBox="0 0 24 24" class="absolute inset-0 w-full h-full"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.94L12 17.77l-6.18 3.31 1.18-6.94-5-4.97L8.91 8.26z"/></svg>`;

/** Rounded circle glyph (analysis / tool markers). */
const CIRCLE_SVG =
  `<svg viewBox="0 0 24 24" class="absolute inset-0 w-full h-full"><circle fill="currentColor" cx="12" cy="12" r="10"/></svg>`;

function getShapeGlyph(shape: PinShape): string {
  switch (shape) {
    case "featured": return STAR_SVG;
    case "analysis": return CIRCLE_SVG;
    default: return TEAR_DROP_SVG;
  }
}

// ── Badge SVG glyphs ────────────────────────────────────────────────────────

const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="%23ffffff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 15 13l-1.41-1.42z"/></svg>`;

function renderBadgeHtml(badge: PinBadge, sizePx: number): string {
  const badgeR = Math.max(5, sizePx * 0.28);
  const x = sizePx - badgeR;
  const y = badgeR;
  const badgeColor = "#ffffff";

  switch (badge.type) {
    case "verified":
      return `<svg viewBox="0 0 24 24" class="absolute" style="width:${badgeR * 1.4}px;height:${badgeR * 1.4}px;top:${y - badgeR * 0.7}px;right:${x - badgeR * 0.4}px"><circle fill="%2310b981" cx="12" cy="12" r="${badgeR}"/><path fill="${badgeColor}" d="${CHECK_SVG.match(/d="([^"]+)"/)?.[1] || "M9 16.17L4.83 12l-1.42 1.41L9 19 15 13l-1.41-1.42z"}"/></svg>`;
    case "new":
      return `<svg viewBox="0 0 24 24" class="absolute" style="width:${badgeR * 1.4}px;height:${badgeR * 1.4}px;top:${y - badgeR * 0.7}px;right:${x - badgeR * 0.4}px"><circle fill="%23ef4444" cx="12" cy="12" r="${badgeR}"/></svg>`;
    case "progress": {
      const pct = Math.max(0, Math.min(100, badge.value as number || 0));
      const offset = 28.3 * 2; // circumference of r=9 circle (2πr ≈ 56.55)
      const dash = (pct / 100) * offset;
      return `<svg viewBox="0 0 24 24" class="absolute" style="width:${badgeR * 1.4}px;height:${badgeR * 1.4}px;top:${y - badgeR * 0.7}px;right:${x - badgeR * 0.4}px"><circle cx="12" cy="12" r="9" fill="none" stroke="%23ffffff" stroke-width="4" stroke-dasharray="${dash} ${offset}" transform="rotate(-90 12 12)"/></svg>`;
    }
    case "amount":
      return `<div class="absolute" style="top:${y - badgeR * 0.5}px;right:${x - badgeR}px;background:rgba(0,0,0,0.75);color:#fff;border-radius:50%;padding:2px 4px;font-size:${Math.max(6, badgeR * 0.8)}px;line-height:1">${String(badge.value).slice(0, 5)}</div>`;
    default:
      return "";
  }
}

// ── Icon rendering ──────────────────────────────────────────────────────────

const _iconHtmlCache = new Map<string, string>();

/** Render a lucide icon to an HTML string (cached per icon+class combo). */
function renderIconComponentToHtml(Component: LucideIcon, className = "w-3 h-3"): string {
  const cacheKey = `${Component?.name || "_unknown"}:${className}`;
  const cached = _iconHtmlCache.get(cacheKey);
  if (cached) return cached;

  const Resolved = (Component && (Component as any).default) ? (Component as any).default : Component;
  if (!Resolved) return "";
  try {
    const html = renderToStaticMarkup(React.createElement(Resolved, { className }));
    _iconHtmlCache.set(cacheKey, html);
    return html;
  } catch {
    return "";
  }
}

// ── divIcon construction ────────────────────────────────────────────────────

const _divIconCache = new Map<string, L.divIcon>();

/**
 * Build (or retrieve from cache) a Leaflet `L.divIcon` for a given pin theme.
 *
 * @param category  — theme category key
 * @param badge     — optional badge overlay (verified, new, progress, amount)
 * @param size      — pin size variant (default from theme)
 */
export function createPinIcon(
  category: string,
  badge?: PinBadge,
  size?: PinSize,
): L.divIcon {
  const theme = getPinTheme(category);
  const sz = size || theme.size;
  const px = PIN_SIZE_PX[sz];
  const shapeGlyph = getShapeGlyph(theme.shape);
  const iconSvg = renderIconComponentToHtml(theme.icon, "w-3 h-3 text-white");
  const badgeHtml = theme.badgeSlot && badge && badge.type !== "none"
    ? renderBadgeHtml(badge, px)
    : "";

  const cacheKey = `${category}:${sz}:${badge?.type || "none"}:${badge?.value || ""}`;
  const cached = _divIconCache.get(cacheKey);
  if (cached) return cached;

  const html = `
    <div class="${theme.color} relative flex items-center justify-center" style="width:${px}px;height:${px}px">
      ${shapeGlyph}
      <span class="relative flex items-center justify-center w-3 h-3 text-white">
        ${iconSvg}
      </span>
      ${badgeHtml}
    </div>
  `;

  const icon = L.divIcon({
    className: `edumap-pin edumap-pin-${theme.shape} edumap-pin-${category}`,
    html,
    iconSize: [px, px],
    iconAnchor: [px / 2, px],   // base of the pin sits on the coordinate
    popupAnchor: [0, -px - 4],
    tooltipAnchor: [0, -px - 4],
  });

  _divIconCache.set(cacheKey, icon);
  return icon;
}

// ── Cluster icon ─────────────────────────────────────────────────────────────

const _clusterIconCache = new Map<string, L.divIcon>();

/**
 * Create a cluster icon with a count badge, using the project's colour theme.
 * Returns a cached divIcon per count-threshold bucket.
 */
export function createClusterIcon(count: number): L.divIcon {
  const tier = count < 10 ? "sm" : count < 100 ? "md" : "lg";
  const key = `cluster-${tier}-${count}`;
  const cached = _clusterIconCache.get(key);
  if (cached) return cached;

  const size = tier === "sm" ? 40 : tier === "md" ? 50 : 60;
  const bg = count < 10 ? "bg-primary/90" : count < 100 ? "bg-primary/85" : "bg-destructive/90";
  const countColor = count < 10 ? "text-xs" : "text-sm";

  const html = `
    <div class="${bg} flex items-center justify-center text-primary-foreground rounded-full shadow-lg border-2 border-background"
       style="width:${size}px;height:${size}px">
      <span class="font-bold ${countColor}">${count}</span>
    </div>
  `;

  const icon = L.divIcon({
    className: "edumap-cluster-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size - 4],
  });

  _clusterIconCache.set(key, icon);
  return icon;
}

// ── Legend definitions ──────────────────────────────────────────────────────

export interface PinLegendItem {
  category: string;
  label: string;
  icon: LucideIcon;
  color: string;
  shape: PinShape;
}

/**
 * The canonical legend for all featured-pin categories.
 * Used by the map's legend control and category filters.
 */
export const PIN_LEGEND: PinLegendItem[] = [
  { category: "stem",   label: "Phòng thí nghiệm STEM", icon: Atom,             color: "text-destructive",     shape: "featured" },
  { category: "green",  label: "Thử thách sống xanh",   icon: Leaf,             color: "text-green-600",       shape: "featured" },
  { category: "summer", label: "Chiến dịch mùa hè",    icon: GraduationCap,     color: "text-orange-500",      shape: "featured" },
  { category: "wifi",   label: "Trạm Wifi",             icon: Wifi,              color: "text-amber-400",       shape: "featured" },
  { category: "donate", label: "Quyên góp",             icon: Heart,             color: "text-red-500",         shape: "featured" },
  { category: "market", label: "Chợ & trao đổi",        icon: ShoppingCart,     color: "text-primary",         shape: "featured" },
];

/**
 * Legend for regular POI categories (tear-drop pins).
 */
export const POI_LEGEND: PinLegendItem[] = [
  { category: "university", label: "Đại học",          icon: GraduationCap, color: "text-accent",      shape: "poi" },
  { category: "school",     label: "Trường học",       icon: GraduationCap, color: "text-accent",      shape: "poi" },
  { category: "library",    label: "Thư viện",         icon: BookOpen,      color: "text-primary",     shape: "poi" },
  { category: "lab",        label: "Lab",              icon: Atom,          color: "text-primary",     shape: "poi" },
  { category: "green_poi",  label: "Không gian xanh",  icon: Leaf,          color: "text-green-600",   shape: "poi" },
  { category: "cafe",       label: "Cà phê",           icon: HomeIcon,      color: "text-orange-500",  shape: "poi" },
  { category: "restaurant", label: "Nhà hàng",         icon: HomeIcon,      color: "text-primary",     shape: "poi" },
  { category: "market_poi", label: "Chợ",             icon: ShoppingCart,  color: "text-primary",     shape: "poi" },
  { category: "convenience",label: "Tiện dịch vụ",     icon: ShoppingCart,  color: "text-amber-400",   shape: "poi" },
  { category: "park",       label: "Công viên",       icon: Leaf,          color: "text-green-600",   shape: "poi" },
];

/**
 * Legend for analysis / tool markers (circle pins).
 */
export const ANALYSIS_LEGEND: PinLegendItem[] = [
  { category: "survey",      label: "Điểm khảo sát",    icon: Target,    color: "text-purple-500",    shape: "analysis" },
  { category: "route_origin", label: "Điểm xuất phát",  icon: MapPin,    color: "text-blue-500",      shape: "analysis" },
  { category: "route_dest",   label: "Điểm đến",        icon: MapPin,    color: "text-red-500",       shape: "analysis" },
  { category: "hazard",       label: "Vùng nguy hiểm",  icon: Shield,    color: "text-destructive",  shape: "analysis" },
  { category: "gap",          label: "Khoảng trống",    icon: Construction, color: "text-muted-foreground", shape: "analysis" },
];
