"use client";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import type { LucideIcon } from "lucide-react";
import { getPinTheme, type PinShape, type PinSize, type PinBadge, } from "./pin-themes";
export * from "./pin-themes";
const PIN_SIZE_PX: Record<PinSize, number> = { sm: 22, md: 28, lg: 34 };
const TEAR_DROP_SVG = `<svg viewBox="0 0 24 24" class="absolute inset-0 w-full h-full" fill="none"><path fill="currentColor" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;
const STAR_SVG = `<svg viewBox="0 0 24 24" class="absolute inset-0 w-full h-full"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.94L12 17.77l-6.18 3.31 1.18-6.94-5-4.97L8.91 8.26z"/></svg>`;
const CIRCLE_SVG = `<svg viewBox="0 0 24 24" class="absolute inset-0 w-full h-full"><circle fill="currentColor" cx="12" cy="12" r="10"/></svg>`;
function getShapeGlyph(shape: PinShape): string {
    switch (shape) {
        case "featured": return STAR_SVG;
        case "analysis": return CIRCLE_SVG;
        default: return TEAR_DROP_SVG;
    }
}
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="#ffffff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 15 13l-1.41-1.42z"/></svg>`;
function renderBadgeHtml(badge: PinBadge, sizePx: number): string {
    const badgeR = Math.max(5, sizePx * 0.28);
    const x = sizePx - badgeR;
    const y = badgeR;
    const badgeColor = "#ffffff";
    switch (badge.type) {
        case "verified":
            return `<svg viewBox="0 0 24 24" class="absolute" style="width:${badgeR * 1.4}px;height:${badgeR * 1.4}px;top:${y - badgeR * 0.7}px;right:${x - badgeR * 0.4}px"><circle fill="#10b981" cx="12" cy="12" r="${badgeR}"/><path fill="${badgeColor}" d="${CHECK_SVG.match(/d="([^"]+)"/)?.[1] || "M9 16.17L4.83 12l-1.42 1.41L9 19 15 13l-1.41-1.42z"}"/></svg>`;
        case "new":
            return `<svg viewBox="0 0 24 24" class="absolute" style="width:${badgeR * 1.4}px;height:${badgeR * 1.4}px;top:${y - badgeR * 0.7}px;right:${x - badgeR * 0.4}px"><circle fill="#ef4444" cx="12" cy="12" r="${badgeR}"/></svg>`;
        case "progress": {
            const pct = Math.max(0, Math.min(100, badge.value as number || 0));
            const offset = 28.3 * 2;
            const dash = (pct / 100) * offset;
            return `<svg viewBox="0 0 24 24" class="absolute" style="width:${badgeR * 1.4}px;height:${badgeR * 1.4}px;top:${y - badgeR * 0.7}px;right:${x - badgeR * 0.4}px"><circle cx="12" cy="12" r="9" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="${dash} ${offset}" transform="rotate(-90 12 12)"/></svg>`;
        }
        case "amount":
            return `<div class="absolute" style="top:${y - badgeR * 0.5}px;right:${x - badgeR}px;background:rgba(0,0,0,0.75);color:#fff;border-radius:50%;padding:2px 4px;font-size:${Math.max(6, badgeR * 0.8)}px;line-height:1">${String(badge.value).slice(0, 5)}</div>`;
        default:
            return "";
    }
}
const _iconHtmlCache = new Map<string, string>();
function renderIconComponentToHtml(Component: LucideIcon, className = "w-3 h-3"): string {
    const cacheKey = `${Component?.name || "_unknown"}:${className}`;
    const cached = _iconHtmlCache.get(cacheKey);
    if (cached)
        return cached;
    const Resolved = (Component && (Component as any).default) ? (Component as any).default : Component;
    if (!Resolved)
        return "";
    try {
        const html = renderToStaticMarkup(React.createElement(Resolved, { className }));
        _iconHtmlCache.set(cacheKey, html);
        return html;
    }
    catch {
        return "";
    }
}
const _divIconCache = new Map<string, L.DivIcon>();
export function createPinIcon(category: string, badge?: PinBadge, size?: PinSize): L.DivIcon {
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
    if (cached)
        return cached;
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
        iconAnchor: [px / 2, px],
        popupAnchor: [0, -px - 4],
        tooltipAnchor: [0, -px - 4],
    });
    _divIconCache.set(cacheKey, icon);
    return icon;
}
const _clusterIconCache = new Map<string, L.DivIcon>();
export function createClusterIcon(count: number): L.DivIcon {
    const tier = count < 10 ? "sm" : count < 100 ? "md" : "lg";
    const key = `cluster-${tier}-${count}`;
    const cached = _clusterIconCache.get(key);
    if (cached)
        return cached;
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
