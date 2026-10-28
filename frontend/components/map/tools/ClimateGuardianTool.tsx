/**
 * Climate Guardian Tool (Idea #11 — AI Climate Learning Guardian)
 *
 * Merged into the unified Map Hub. Previously a standalone page at
 * `/climate-guardian`; now the `climate` tab on `/map`.
 *
 * Panel: bbox controls + date + risk ranking + alternatives search.
 * Overlay: risk heatmap (leaflet.heat) + risk-zone GeoJSON + safe-alternative
 *   markers + fit bounds.
 */
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  CloudRain, MapPin, BarChart3, RefreshCw,
  AlertCircle, Info, ExternalLink, CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";

import {
  GeoJSON, Marker, Popup, Circle, useMap,
} from "react-leaflet";
import L from "leaflet";
import HeatmapLayer from "@/components/map/HeatmapLayer";
import type { ToolPanelProps, ToolOverlayProps } from "./types";

// Biên Hòa / Đồng Nai default view (real educational region).
const DEFAULT_CENTER = { lat: 10.9525, lng: 106.8778 };
const DEFAULT_BBOX = { minLat: 10.75, maxLat: 11.20, minLng: 106.60, maxLng: 107.20 };

const CATEGORY_OPTIONS = [
  { label: "Tất cả", value: "" },
  { label: "Trường Đại học", value: "university" },
  { label: "Trường THPT", value: "school" },
  { label: "Thư viện", value: "library" },
  { label: "Wifi miễn phí", value: "wifi_hotspot" },
  { label: "Lab STEM", value: "lab" },
  { label: "Không gian học tập", value: "study_space" },
];

function formatPct(v: number): string {
  return `${Number(v).toFixed(1)}%`;
}

function riskLabelColor(score: number): string {
  if (score >= 0.75) return "#ef4444";
  if (score >= 0.5) return "#f59e0b";
  if (score >= 0.3) return "#fb923c";
  if (score >= 0.15) return "#38bdf8";
  return "#22c57e";
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function ClimateGuardianPanel({
  viewport, result, onResult, loading, setLoading, error, setError, active, user,
}: ToolPanelProps) {
  const [bbox, setBbox] = useState(DEFAULT_BBOX);
  const [dateStr, setDateStr] = useState("");

  // Alternatives state
  const [altCenter, setAltCenter] = useState(DEFAULT_CENTER);
  const [altRadius, setAltRadius] = useState(10);
  const [altCategory, setAltCategory] = useState("");
  const [altResult, setAltResult] = useState<any>(null);
  const [altLoading, setAltLoading] = useState(false);

  const fetchRisk = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("minLat", String(bbox.minLat));
      params.set("maxLat", String(bbox.maxLat));
      params.set("minLng", String(bbox.minLng));
      params.set("maxLng", String(bbox.maxLng));
      if (dateStr) params.set("date", dateStr);
      const res = await fetchWithRetry(`/api/map/climate-risk?${params.toString()}`, { retries: 2 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      onResult({ ...data, alternatives: altResult });
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || "Dữ liệu khí hậu đang trong chế độ giảm tốc.");
      }
    } catch (err: any) {
      logger.error("Climate risk error", err);
      setError(err?.message || "Không thể tải bản đồ rủi ro khí hậu.");
      toast.error("Tải bản đồ rủi ro thất bại — vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [bbox, dateStr, active, altResult, onResult, setLoading, setError]);

  const fetchAlternatives = useCallback(async () => {
    if (!active) return;
    setAltLoading(true);
    try {
      const res = await fetchWithRetry("/api/map/climate/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: altCenter.lat,
          lng: altCenter.lng,
          radiusKm: altRadius,
          category: altCategory || null,
        }),
        retries: 2,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      setAltResult(data);
      onResult((prev: any) => ({ ...(prev || {}), alternatives: data }));
      if (data?.metadata?.degraded) {
        toast.warning("Chế độ giảm tốc cho phương án thay thế.");
      }
    } catch (err: any) {
      logger.error("Climate alternatives error", err);
      toast.error("Tải phương án thay thế thất bại.");
    } finally {
      setAltLoading(false);
    }
  }, [altCenter, altRadius, altCategory, active, onResult]);

  // Auto-fetch on mount + when bbox/date changes.
  useEffect(() => {
    if (active) fetchRisk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox, dateStr, active]);

  useEffect(() => {
    if (active) fetchAlternatives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [altCenter, altRadius, altCategory, active]);

  // Merge result + altResult for overlay
  const riskResult = result || null;
  const meta = useMemo(() => riskResult?.metadata || {}, [riskResult]);
  const riskRanking = useMemo(() => riskResult?.risk_ranking || [], [riskResult]);
  const safeAlts = useMemo(() => (altResult?.features || []), [altResult]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Kết hợp bản đồ ngập lũ tĩnh (dữ liệu lịch sử sông Đồng Nai, Cửu Long,
        miền Trung) + thời tiết (OpenWeatherMap) + độ cao địa hình để đưa ra
        bản đồ rủi ro và đề xuất nơi học tập an toàn.
      </p>

      {/* ── BBox controls ── */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Vùng (bounding box)</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <input
              type="number" step="0.001" value={bbox.minLat}
              onChange={(e) => setBbox({ ...bbox, minLat: parseFloat(e.target.value) || 0 })}
              className="form-input text-xs"
              placeholder="minLat"
            />
            <input
              type="number" step="0.001" value={bbox.maxLat}
              onChange={(e) => setBbox({ ...bbox, maxLat: parseFloat(e.target.value) || 0 })}
              className="form-input text-xs"
              placeholder="maxLat"
            />
            <input
              type="number" step="0.001" value={bbox.minLng}
              onChange={(e) => setBbox({ ...bbox, minLng: parseFloat(e.target.value) || 0 })}
              className="form-input text-xs"
              placeholder="minLng"
            />
            <input
              type="number" step="0.001" value={bbox.maxLng}
              onChange={(e) => setBbox({ ...bbox, maxLng: parseFloat(e.target.value) || 0 })}
              className="form-input text-xs"
              placeholder="maxLng"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Ngày (tùy chọn)</label>
          <input
            type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)}
            className="form-select mt-1 text-sm"
          />
        </div>

        <button
          onClick={fetchRisk} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang tính toán…
            </>
          ) : (
            <>
              <CloudRain className="w-4 h-4" /> Cập nhật bản đồ rủi ro
            </>
          )}
        </button>
      </div>

      {/* Degraded banner */}
      {meta.degraded && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{meta.reason || "Dữ liệu khí hậu đang trong chế độ giảm tốc — kết quả chỉ mang tính tham khảo."}</span>
        </div>
      )}

      {/* Methodology transparency */}
      {riskResult && (
        <div className="p-3 rounded-lg bg-muted/20 border border-border">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
            <Info className="w-3.5 h-3.5" />
            <span>Công thức rủi ro</span>
          </div>
          <div className="text-[10px] text-muted-foreground/80 space-y-0.5">
            <div>risk_score = 0.35·flood_risk + 0.35·weather_risk + 0.30·access_risk</div>
            <div>• flood_risk: khoảng cách đến vùng ngập + mùa lũ</div>
            <div>• weather_risk: cường độ mưa/gió (OpenWeatherMap, nếu có key)</div>
            <div>• access_risk: khoảng cách đến cơ sở giáo dục gần nhất</div>
            <div className="pt-1">
              Cache: {meta.cached ? "cache" : "mới"} · Nguồn: {meta.data_source || "static"} ·
              Tháng: {meta.month} ({meta.season}) · Vùng ngập: {meta.flood_zones_loaded || 0}
            </div>
            {meta.has_weather && (
              <div className="flex items-center gap-1 pt-1 text-accent">
                <CheckCircle2 className="h-3 w-3" /> Weather API (OpenWeatherMap) đang hoạt động
              </div>
            )}
            {!meta.has_weather && (
              <div className="flex items-center gap-1 pt-1 text-primary">
                <AlertCircle className="h-3 w-3" /> Dùng bản đồ ngập tĩnh (thiếu OWM_API_KEY)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk ranking */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <CloudRain className="w-3.5 h-3.5" />
          <span>Bảng xếp hạng khu vực nguy cơ</span>
        </div>
        {riskRanking.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/65">Chưa có dữ liệu.</p>
        ) : (
          <div className="space-y-1">
            {riskRanking.slice(0, 10).map((r: any, i: number) => (
              <div key={`${r.lat}:${r.lng}:${i}`} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-muted-foreground/60 text-right">{i + 1}.</span>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskLabelColor(r.risk_score) }} />
                <div className="flex-1">
                  <span className="font-medium text-foreground truncate">
                    {r.area || r.nearest_facility || "Vùng nguy cơ"}
                  </span>
                </div>
                <span className="font-bold" style={{ color: riskLabelColor(r.risk_score) }}>
                  {formatPct(r.risk_score * 100)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Alternatives section ── */}
      <div className="border-t border-border pt-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="w-4 h-4 text-green-400" />
          <span>Địa chỉ học an toàn</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <input
            type="number" step="0.001" value={altCenter.lat}
            onChange={(e) => setAltCenter({ ...altCenter, lat: parseFloat(e.target.value) || 0 })}
            className="form-input text-xs"
            placeholder="lat"
          />
          <input
            type="number" step="0.001" value={altCenter.lng}
            onChange={(e) => setAltCenter({ ...altCenter, lng: parseFloat(e.target.value) || 0 })}
            className="form-input text-xs"
            placeholder="lng"
          />
          <input
            type="number" step="1" value={altRadius}
            onChange={(e) => setAltRadius(Math.max(1, parseInt(e.target.value) || 10))}
            className="form-input text-xs"
            placeholder="km"
          />
          <select
            value={altCategory}
            onChange={(e) => setAltCategory(e.target.value)}
            className="form-select text-sm"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchAlternatives} disabled={altLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/80 disabled:opacity-60"
        >
          {altLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang tìm…
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" /> Tìm nơi học an toàn
            </>
          )}
        </button>

        {safeAlts.length > 0 ? (
          <div className="space-y-1">
            {safeAlts.slice(0, 8).map((f: any) => {
              const props = f.properties || {};
              return (
                <div key={props.id || `${props.lat}:${props.lng}`} className="p-2 rounded border border-green-500/20 bg-green-500/5">
                  <div className="font-medium text-foreground text-xs">{props.name}</div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {props.category} · An toàn: {formatPct(props.safety_score * 100)} ·
                    Cách: {props.distance_km} km ({props.walk_time_min} phút)
                    {props.elevation_m && ` · ${props.elevation_m} m`}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/65">
            {altResult ? "Không tìm thấy nơi nào an toàn trong bán kính." : "Nhấn \"Tìm nơi học an toàn\" để bắt đầu."}
          </p>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ── Overlay ─────────────────────────────────────────────────────────────────

function ClimateGuardianOverlayMap({ result, points }: { result: any; points: any[] }) {
  const map = useMap();
  const data = useMemo(() => result || null, [result]);
  const alternatives = useMemo(() => result?.alternatives || null, [result]);
  const heatPoints = useMemo(() => data?.heat_points || [], [data]);

  const fitPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    (data?.features || []).forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[0] === "number") {
        if (Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
          const ring = coords[0];
          const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
          const lng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
          pts.push({ lat, lng });
        } else if (typeof coords[1] === "number") {
          pts.push({ lat: coords[1], lng: coords[0] });
        }
      }
    });
    (alternatives?.features || []).forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[1] === "number") {
        pts.push({ lat: coords[1], lng: coords[0] });
      }
    });
    return pts;
  }, [data, alternatives]);

  useEffect(() => {
    if (fitPoints.length > 0) {
      const group = L.featureGroup();
      fitPoints.forEach((ll) => group.addLayer(L.marker([ll.lat, ll.lng], {})));
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      group.clearLayers();
    }
  }, [fitPoints, map]);

  if (!data && !alternatives) return null;

  return (
    <>
      {/* Flood/weather risk heatmap (leaflet.heat) */}
      {heatPoints.length > 0 && (
        <HeatmapLayer
          points={heatPoints.map((p: any) => ({
            lat: Number(p[0]),
            lng: Number(p[1]),
            intensity: Number(p[2] || 0),
          }))}
        />
      )}

      {/* Risk-zone GeoJSON */}
      {data?.features?.length > 0 ? (
        <GeoJSON
          data={data}
          pathOptions={{
            color: "#0ea5e3",
            weight: 1,
            opacity: 0.6,
            fillColor: "#0ea5e3",
            fillOpacity: 0.12,
          }}
          pointToLayer={(feature: any, latlng: L.LatLngExpression) => {
            const props = feature.properties || {};
            const score = props.risk_score || 0;
            return L.circleMarker(latlng, {
              radius: 4 + score * 8,
              color: riskLabelColor(score),
              fillColor: riskLabelColor(score),
              fillOpacity: 0.4 + score * 0.3,
            });
          }}
          onEachFeature={(feature: any, layer: L.Layer) => {
            const props = feature.properties || {};
            const score = props.risk_score_pct ?? (props.risk_score * 100).toFixed(1);
            const level = props.risk_level || "rất thấp";
            const color = riskLabelColor(props.risk_score || 0);
            const colorHex = color.replace("#", "");
            layer.bindPopup(`
              <div class="font-sans text-xs text-foreground">
                <strong class="block" style="color:${color}">Rủi ro ${score}% (${level})</strong>
                <span class="block opacity-80 mt-0.5">
                  Ngập: ${props.flood_risk ? (props.flood_risk * 100).toFixed(0) : 0}% ·
                  Thời tiết: ${props.weather_risk ? (props.weather_risk * 100).toFixed(0) : 0}% ·
                  Truy cận: ${props.access_risk ? (props.access_risk * 100).toFixed(0) : 0}%
                </span>
                ${props.elevation_m !== null && props.elevation_m !== undefined ? `<span class="block opacity-60">Độ cao: ${props.elevation_m} m</span>` : ""}
                ${props.nearest_facility ? `<span class="block opacity-60">Gần nhất: ${props.nearest_facility}</span>` : ""}
              </div>
            `);
          }}
        />
      ) : null}

      {/* Safe alternative locations (green markers). */}
      {alternatives?.features?.length > 0 ? (
        (alternatives.features as any[]).map((f: any, idx: number) => {
          const coords = f.geometry?.coordinates;
          if (!coords || typeof coords[1] !== "number") return null;
          const props = f.properties || {};
          return (
            <Marker
              key={`alt-${idx}`}
              position={[coords[1], coords[0]]}
              icon={L.divIcon({
                className: "edumap-climate-marker shadow",
                html: `<div class="relative flex items-center justify-center bg-green-500/20 rounded-full" style="width:26px;height:26px"><svg viewBox="0 0 24 24" class="w-5 h-5 text-green-400 fill-current"><path d="M20 6L9 17l-4-4"/></svg></div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 27],
                popupAnchor: [0, -32],
              })}
            >
              <Popup>
                <div className="font-sans text-xs text-foreground">
                  <strong className="block text-green-400">{props.name}</strong>
                  <span className="block opacity-80 mt-0.5">
                    An toàn: {(props.safety_score * 100).toFixed(0)}% ·
                    Cách: {props.distance_km} km ({props.walk_time_min} phút đi bộ)
                  </span>
                  {props.elevation_m && (
                    <span className="block opacity-60">Độ cao: {props.elevation_m} m</span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })
      ) : null}
    </>
  );
}

export function ClimateGuardianOverlay({ result, points, onFeatureSelect }: ToolOverlayProps) {
  return <ClimateGuardianOverlayMap result={result} points={points} />;
}

const ClimateGuardianTool = {
  id: "climate",
  label: "Bảo vệ khí hậu",
  longLabel: "AI Bảo Vệ Khí Hậu",
  icon: CloudRain,
  description: "Bản đồ rủi ro lũ lũng + nơi học an toàn.",
  longDescription: "Kết hợp bản đồ ngập lũ tĩnh + thời tiết (OpenWeatherMap) + độ cao địa hình để đưa ra bản đồ rủi ro và đề xuất nơi học tập an toàn.",
  authRequired: true,
  hideBaseLayers: false,
  defaultCenter: { lat: 10.9525, lng: 106.8778 },
  Panel: ClimateGuardianPanel,
  Overlay: ClimateGuardianOverlay,
};

export default ClimateGuardianTool;
