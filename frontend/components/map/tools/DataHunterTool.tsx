/**
 * Data Hunter Tool (Idea #6 — Missing Data Hunter)
 *
 * Merged into the unified Map Hub. Previously a standalone page at
 * `/map/data-hunter`; now accessible as the `data-hunter` tab on `/map`.
 *
 * Panel: grid-based coverage analysis controls + gap list + attribute report.
 * Overlay: gap-cell polygons graded by gap_score + existing POI context circles.
 */
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  BrainCircuit, RefreshCw, AlertCircle, Info, List,
  BarChartHorizontal, Target, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";
import {
  MapContainer, TileLayer, GeoJSON, Circle, useMap,
} from "react-leaflet";
import L from "leaflet";
import HeatmapLayer from "@/components/map/HeatmapLayer";
import type { ToolPanelProps, ToolOverlayProps } from "./types";

// ── Constants (mirrors the original standalone page) ────────────────────────

const GRID_SIZE_OPTIONS = [
  { value: 0.5, label: "0.5 km" },
  { value: 1.0, label: "1 km" },
  { value: 2.0, label: "2 km" },
  { value: 5.0, label: "5 km" },
];

function priorityBadge(level: string) {
  if (level === "high") return { bg: "bg-red-500/15", border: "border-red-500/30", text: "text-red-400", dot: "bg-red-400" };
  if (level === "medium") return { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400", dot: "bg-amber-400" };
  return { bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400", dot: "bg-blue-400" };
}

function formatPct(v: number): string {
  return `${Number(v).toFixed(1)}%`;
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function DataHunterPanel({
  viewport, result, onResult, loading, setLoading, error, setError, active,
}: ToolPanelProps) {
  const [gridSizeKm, setGridSizeKm] = useState(1.0);
  const [topN, setTopN] = useState(50);
  const [categories, setCategories] = useState<string>("");

  const fetchGaps = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("grid_size_km", String(gridSizeKm));
      params.set("top_n", String(topN));
      if (categories) params.set("categories", categories);
      if (viewport) {
        params.set("min_lat", String(viewport.minLat));
        params.set("max_lat", String(viewport.maxLat));
        params.set("min_lng", String(viewport.minLng));
        params.set("max_lng", String(viewport.maxLng));
      }
      const res = await fetchWithRetry(`/api/map/data-gaps?${params.toString()}`, { retries: 2 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      onResult(data);
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || "Dữ liệu đang trong chế độ giảm tốc.");
      } else {
        toast.success(`Phân tích ${data?.summary?.gap_cells || 0} ô chưa có dữ liệu.`);
      }
    } catch (err: any) {
      logger.error("Data gaps error", err);
      setError(err?.message || "Không thể tải phân tích khoảng trống dữ liệu.");
      toast.error("Tải phân tích thất bại — vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [gridSizeKm, topN, categories, viewport, active, onResult, setLoading, setError]);

  // Auto-fetch when the tool becomes active.
  useEffect(() => {
    if (active && !result) fetchGaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const gapFeatures = useMemo(() => (result?.features || []).slice(0, topN), [result, topN]);
  const topGaps = useMemo(() => gapFeatures.slice(0, 12), [gapFeatures]);
  const attributeGaps = useMemo(() => result?.attribute_gaps || {}, [result]);
  const summary = useMemo(() => result?.summary || {}, [result]);
  const meta = useMemo(() => result?.metadata || {}, [result]);

  const attrGapEntries = useMemo(() => {
    return Object.entries(attributeGaps)
      .filter(([_, v]: [string, any]) => v && typeof v === "object" && "pct" in v)
      .map(([k, v]: [string, any]) => ({ attr: k, ...v }))
      .sort((a: any, b: any) => b.pct - a.pct);
  }, [attributeGaps]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Phân tích độ bao phủ lưới (grid-based) + phát hiện thuộc tính chưa đủ trên
        POI. Các ô chưa có dữ liệu được đánh dấu đỏ — ứng cử viên khảo sát ưu tiên.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Kích thước ô lưới</label>
          <select
            value={gridSizeKm}
            onChange={(e) => setGridSizeKm(parseFloat(e.target.value))}
            className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {GRID_SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Số ô gap tối đa: {topN}</label>
          <input
            type="range" min={5} max={200} step={5} value={topN}
            onChange={(e) => setTopN(parseInt(e.target.value, 10))}
            className="mt-1 w-full h-2 bg-muted rounded-full accent-primary"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Lọc category (phân cách bằng dấu phẩy)</label>
          <input
            type="text" value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="VD: school, university, library"
            className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        <button
          onClick={fetchGaps} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang phân tích…
            </>
          ) : (
            <>
              <BrainCircuit className="w-4 h-4" /> Phân tích lại
            </>
          )}
        </button>
      </div>

      {/* Degraded banner */}
      {meta.degraded && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{meta.reason || "Dữ liệu hiếm — kết quả chỉ mang tính tham khảo."}</span>
        </div>
      )}

      {/* Summary stats */}
      {result && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="text-2xl font-bold text-destructive">{summary.gap_cells || 0}</div>
            <div className="text-[10px] text-muted-foreground">Ô chưa có dữ liệu</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="text-2xl font-bold text-primary">{summary.total_points || 0}</div>
            <div className="text-[10px] text-muted-foreground">POI đã nạp</div>
          </div>
        </div>
      )}

      {/* Attribute gap report */}
      {attrGapEntries.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <BarChartHorizontal className="w-3.5 h-3.5" />
            <span>Thuộc tính cần bổ sung</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide">
            {attrGapEntries.map((entry: any) => (
              <div key={entry.attr} className="flex items-center gap-2 text-xs">
                <span className="w-24 text-muted-foreground truncate">{entry.attr}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${entry.pct}%` }} />
                </div>
                <span className="w-10 text-right text-muted-foreground">{formatPct(entry.pct)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority gap list */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <List className="w-3.5 h-3.5" />
          <span>Danh sách ưu tiên khảo sát ({topGaps.length})</span>
        </div>
        {topGaps.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/65">Chưa có dữ liệu. Nhấn "Phân tích lại".</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-hide">
            {topGaps.map((f: any, i: number) => {
              const props = f.properties || {};
              const b = priorityBadge(props.priority || "low");
              return (
                <div key={`${props.cell_id || i}`} className={`p-2 rounded border ${b.bg} ${b.border} text-xs`}>
                  <div className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full ${b.dot} shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <div className="font-medium text-foreground truncate">{props.area || `Ô ${props.cell_id}`}</div>
                      <div className="text-muted-foreground/70 mt-0.5">
                        Điểm: {formatPct(props.gap_score * 100)} · Ưu tiên: <b className={b.text}>{props.priority}</b>
                      </div>
                      {props.nearest_poi_distance_km != null && (
                        <div className="text-muted-foreground/60">Gần nhất: {props.nearest_poi_distance_km} km</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Methodology */}
      {result && (
        <div className="p-3 rounded-lg bg-muted/20 border border-border text-[10px] text-muted-foreground/80">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
            <Info className="w-3.5 h-3.5" />
            <span>Phương pháp</span>
          </div>
          <div>• Grid-based coverage: ô {summary.grid_size_km}km²</div>
          <div>• Attribute gap: kiểm tra name, address, city, description, rating, website, hours, …</div>
          <div>• Cache: {meta.cached ? "cache" : "mới"} · {summary.gap_cells} ô thiếu hụt / {summary.total_cells} tổng ô</div>
        </div>
      )}

      {error && !result && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ── Overlay ─────────────────────────────────────────────────────────────────

function gapFillColor(score: number): string {
  const t = Math.max(0, Math.min(1, score));
  const r = Math.round(239 + (4 - 239) * t);
  const g = Math.round(166 + (120 - 166) * t);
  const b = Math.round(83 + (10 - 83) * t);
  return `rgba(${r}, ${g}, ${b}, 0.25)`;
}

const GAP_COLOR = "#ef4444";

function DataHunterOverlayMap({ data, points }: { data: any; points: any[] }) {
  const map = useMap();
  const [geoMapCenter, setGeoMapCenter] = useState<[number, number]>([10.957, 106.843]);
  const fitPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    (data?.features || []).forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[0] === "number") {
        pts.push({ lat: coords[1], lng: coords[0] });
      }
    });
    points.forEach((p) => {
      if (p.lat != null && p.lng != null) pts.push({ lat: p.lat, lng: p.lng });
    });
    return pts;
  }, [data, points]);

  useEffect(() => {
    const feats = data?.features || [];
    if (feats.length > 0) {
      const first = feats[0];
      if (first?.geometry?.coordinates) {
        setGeoMapCenter([first.geometry.coordinates[1], first.geometry.coordinates[0]]);
      }
    }
  }, [data]);

  // Auto-fit
  useEffect(() => {
    if (fitPoints.length > 0) {
      const group = L.featureGroup();
      fitPoints.forEach((ll) => group.addLayer(L.marker([ll.lat, ll.lng], {})));
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      group.clearLayers();
    }
  }, [fitPoints, map]);

  if (!data?.features?.length) return null;

  return (
    <>
      {/* Gap cell polygons (GeoJSON) */}
      <GeoJSON
        data={data}
        pathOptions={{
          color: GAP_COLOR,
          weight: 2,
          opacity: 0.8,
          fillColor: GAP_COLOR,
          fillOpacity: 0.25,
        }}
        style={(feature: any) => {
          const score = feature.properties?.gap_score || 0;
          const t = Math.max(0, Math.min(1, score));
          const r = Math.round(239 + (4 - 239) * t);
          const g = Math.round(166 + (120 - 166) * t);
          const b = Math.round(83 + (10 - 83) * t);
          return {
            fillColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
            color: GAP_COLOR,
            weight: 2,
            fillOpacity: 0.3,
          };
        }}
        onEachFeature={(feature: any, layer: L.Layer) => {
          const props = feature.properties || {};
          layer.bindPopup(`
            <div class="font-sans text-xs text-foreground">
              <strong class="block text-red-400">${props.area || "Khu vực chưa biết"}</strong>
              <span class="block opacity-80 mt-0.5">Điểm khoảng trống: ${Number(props.gap_score * 100).toFixed(1)}%</span>
              <span class="block opacity-70">Ưu tiên: <b>${props.priority}</b></span>
              ${props.nearest_poi_distance_km != null ? `<span class="block opacity-70 mt-0.5">Gần nhất: ${props.nearest_poi_distance_km} km</span>` : ""}
            </div>
          `);
        }}
      />

      {/* Gap cell centroid circles */}
      {data.features.slice(0, 200).map((f: any, idx: number) => {
        const coords = f.geometry?.coordinates;
        if (!coords) return null;
        let centerLat = coords[1];
        let centerLng = coords[0];
        if (f.geometry.type === "Polygon") {
          const ring = f.geometry.coordinates[0];
          centerLat = ring.reduce((a: number, c: number[]) => a + c[1], 0) / ring.length;
          centerLng = ring.reduce((a: number, c: number[]) => a + c[0], 0) / ring.length;
        }
        const score = f.properties?.gap_score || 0;
        const radius = 4 + score * 8;
        return (
          <Circle
            key={`gap-ctr-${idx}`}
            center={[centerLat, centerLng]}
            radius={radius * 100}
            pathOptions={{
              color: GAP_COLOR,
              fillColor: gapFillColor(score),
              weight: 1,
              fillOpacity: 0.35,
            }}
          />
        );
      })}

      {/* Existing POI context circles */}
      {points.map((poi) => {
        if (poi.lat == null || poi.lng == null) return null;
        return (
          <Circle
            key={`poi-${poi.id || poi.name}`}
            center={[poi.lat, poi.lng]}
            radius={30}
            pathOptions={{
              color: "#647490",
              fillColor: "#647494",
              weight: 1,
              fillOpacity: 0.5,
            }}
          />
        );
      })}
    </>
  );
}

export function DataHunterOverlay({ result, points }: ToolOverlayProps) {
  return <DataHunterOverlayMap data={result} points={points} />;
}

// ── Tool definition ─────────────────────────────────────────────────────────

const DataHunterTool = {
  id: "data-hunter",
  label: "Truy đuổi dữ liệu",
  longLabel: "Truy đuổi Dữ liệu Thiếu",
  icon: Target,
  description: "Phân tích độ bao phủ lưới, phát hiện ô chưa có dữ liệu.",
  longDescription: "Phân tích độ bao phủ lưới (grid-based) + phát hiện thuộc tính chưa đủ trên các POI. Các ô chưa có dữ liệu được đánh dấu đỏ — ứng cử viên khảo sát ưu tiên.",
  authRequired: true,
  hideBaseLayers: true,
  defaultCenter: { lat: 10.957, lng: 106.843 },
  Panel: DataHunterPanel,
  Overlay: DataHunterOverlay,
};

export default DataHunterTool;
