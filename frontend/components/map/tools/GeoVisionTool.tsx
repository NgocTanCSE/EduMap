/**
 * GeoVision AI Tool (Idea #10 — satellite imagery facility detection)
 *
 * Merged into the unified Map Hub. Previously a standalone page at
 * `/map/geo-vision`; now the `geo-vision` tab on `/map`.
 *
 * Panel: bbox selector (draw or current viewport) + tile source + labels +
 *   detect button + detection list.
 * Overlay: detection markers (known=north-blue / new=red) + bbox Rectangle +
 *   known POI markers.
 */
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  BrainCircuit, RefreshCw, AlertCircle, Info, Target,
  MapPin, Camera, Layers, ExternalLink, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";
import {
  MapContainer, TileLayer, GeoJSON, Marker, Popup, Rectangle, useMap,
} from "react-leaflet";
import L from "leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";

type TileSource = "osm" | "esri" | "bing";
const TILE_SOURCES: { value: TileSource; label: string; desc: string }[] = [
  { value: "osm", label: "OSM (miễn phí)", desc: "OSM standard — footprint tòa nhà phù hợp" },
  { value: "esri", label: "Esri ảnh (miễn phí)", desc: "Ảnh vệ tinh – rate-limited" },
  { value: "bing", label: "Bing ảnh (cần key)", desc: "Bing Maps – cần BING_MAPS_API_KEY" },
];

const DEFAULT_LABELS = "school, university, educational institution, college, building, campus, library";

const DEFAULT_BBOX = {
  min_lat: 10.92,
  max_lat: 11.00,
  min_lng: 106.78,
  max_lng: 106.90,
};

function detectionIcon(isKnown: boolean, score: number): L.DivIcon {
  const key = `geo-${isKnown ? "known" : "new"}-${score}`;
  const bg = isKnown ? "#38bdf8" : "#ef4444";
  const html = `<div class="relative flex items-center justify-center ${isKnown ? "bg-sky-500/20" : "bg-red-500/20"} rounded-full" style="width:24px;height:24px"><div class="w-2 h-2 rounded-full" style="background:${bg}"></div></div>`;
  return L.divIcon({
    className: "edumap-geo-detection shadow",
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -28],
  });
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function GeoVisionPanel({
  viewport, result, onResult, loading, setLoading, error, setError, active,
}: ToolPanelProps) {
  const [tileSource, setTileSource] = useState<TileSource>("osm");
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [bbox, setBbox] = useState(DEFAULT_BBOX);
  const [useViewport, setUseViewport] = useState(true);

  const detect = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const effectiveBbox = useViewport && viewport
        ? {
          min_lat: viewport.minLat, max_lat: viewport.maxLat,
          min_lng: viewport.minLng, max_lng: viewport.maxLng,
        }
        : bbox;

      const res = await fetchWithRetry("/api/geo/vision-detect", {
        method: "POST",
        retries: 2,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bbox: [
            effectiveBbox.min_lng, effectiveBbox.min_lat,
            effectiveBbox.max_lng, effectiveBbox.max_lat,
          ],
          zoom: 18,
          source: tileSource,
          labels: labels.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      onResult(data);
      if (data?.degraded) {
        toast.warning(data.error || "Không thể phát hiện — đang dùng dữ liệu dự phòng.");
      } else {
        toast.success(`Phát hiện ${data?.detections?.length || 0} đối tượng.`);
      }
    } catch (err: any) {
      logger.error("GeoVision detect error", err);
      setError(err?.message || "Không thể chạy phát hiện vệ tinh.");
      toast.error("Phát hiện thất bại — vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [tileSource, labels, bbox, useViewport, viewport, active, onResult, setLoading, setError]);

  useEffect(() => {
    if (active && !result) detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const detections = useMemo(() => result?.detections || [], [result]);
  const knownCount = useMemo(() => detections.filter((d: any) => d.match === "known").length, [detections]);
  const newCount = useMemo(() => detections.filter((d: any) => d.match === "new").length, [detections]);
  const meta = useMemo(() => result?.metadata || {}, [result]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Thu thập ảnh vệ tinh (tối đa 8×8 = 64 ô tile), ghép lại và chạy
        zero-shot detection (OwlV2) để tìm cơ sở giáo dục chưa được ghi nhận.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Nguồn ảnh</label>
          <select
            value={tileSource}
            onChange={(e) => setTileSource(e.target.value as TileSource)}
            className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {TILE_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground/65 mt-0.5">
            {TILE_SOURCES.find((s) => s.value === tileSource)?.desc}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox" id="use-viewport" checked={useViewport}
            onChange={(e) => setUseViewport(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="use-viewport" className="text-sm text-foreground">
            Dùng khung bản đồ hiện tại
          </label>
        </div>

        {!useViewport && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><label className="text-muted-foreground">min_lat</label>
              <input type="number" step={0.001} value={bbox.min_lat}
                onChange={(e) => setBbox({ ...bbox, min_lat: parseFloat(e.target.value) })}
                className="w-full rounded bg-background border border-border" /></div>
            <div><label className="text-muted-foreground">max_lat</label>
              <input type="number" step={0.001} value={bbox.max_lat}
                onChange={(e) => setBbox({ ...bbox, max_lat: parseFloat(e.target.value) })}
                className="w-full rounded bg-background border border-border" /></div>
            <div><label className="text-muted-foreground">min_lng</label>
              <input type="number" step={0.001} value={bbox.min_lng}
                onChange={(e) => setBbox({ ...bbox, min_lng: parseFloat(e.target.value) })}
                className="w-full rounded bg-background border border-border" /></div>
            <div><label className="text-muted-foreground">max_lng</label>
              <input type="number" step={0.001} value={bbox.max_lng}
                onChange={(e) => setBbox({ ...bbox, max_lng: parseFloat(e.target.value) })}
                className="w-full rounded bg-background border border-border" /></div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-foreground">Tìm kiếm nhãn</label>
          <input
            type="text" value={labels}
            onChange={(e) => setLabels(e.target.value)}
            className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <p className="text-[10px] text-muted-foreground/65 mt-0.5">
            Tách biệt bằng dấu phẩy.
          </p>
        </div>

        <button
          onClick={detect} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang quét vệ tinh…
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" /> Chạy phát hiện
            </>
          )}
        </button>
      </div>

      {/* Degraded banner */}
      {result?.degraded && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{result.error || "Không thể phát hiện — đang dùng dữ liệu dự phòng."}</span>
        </div>
      )}

      {/* Cache notice */}
      {meta.cached && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <Info className="w-3.5 h-3.5" />
          <span>Kết quả từ cache (24h). Tắt để cập nhật mới nhất.</span>
        </div>
      )}

      {/* Summary */}
      {result && (
        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="p-2 rounded-lg bg-muted/20 border border-border">
            <div className="text-xl font-bold text-foreground">{detections.length}</div>
            <div className="text-muted-foreground">Tổng phát hiện</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20 border border-border">
            <div className="text-xl font-bold text-sky-400">{knownCount}</div>
            <div className="text-muted-foreground">Đã biết</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20 border border-border">
            <div className="text-xl font-bold text-red-400">{newCount}</div>
            <div className="text-muted-foreground">Mới (chưa ghi nhận)</div>
          </div>
        </div>
      )}

      {/* Detection list */}
      {detections.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Target className="w-3.5 h-3.5" />
            <span>Danh sách phát hiện</span>
          </div>
          {detections.slice(0, 20).map((d: any, i: number) => {
            const isNew = d.match === "new";
            return (
              <div key={`det-${i}`} className="p-2 rounded border text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isNew ? "bg-red-400" : "bg-sky-400"}`} />
                  <span className={isNew ? "text-red-300" : "text-sky-300"}>
                    {isNew ? "MỚI" : "ĐÃ BIẾT"}
                  </span>
                  <span className="font-medium text-foreground truncate flex-1">{d.label}</span>
                  <span className="text-muted-foreground/70">{d.score}%</span>
                </div>
                {d.nearest_poi && (
                  <div className="text-muted-foreground/60 mt-0.5">Gần nhất: {d.nearest_poi}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Methodology */}
      {result && (
        <div className="p-3 rounded-lg bg-muted/20 border border-border text-[10px] text-muted-foreground/80">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
            <Info className="w-3.5 h-3.5" />
            <span>Thông tin</span>
          </div>
          <div>• Model: facebook/owlv2-base-c (zero-shot trên HF Inference)</div>
          <div>• Lưới tile: ≤ 8×8 = 64 ô (max 2048×2048 px tại z=18)</div>
          <div>• Cache ảnh: 24h</div>
          <div>• Phát hiện trong 80m của POI → "đã biết", còn lại → "mới"</div>
        </div>
      )}

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

function GeoVisionOverlayMap({ data, points }: { data: any; points: any[] }) {
  const map = useMap();
  const detections = useMemo(() => data?.detections || [], [data]);
  const bbox = data?.bbox;

  const fitPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    detections.forEach((d: any) => {
      if (d.lat != null && d.lng != null) pts.push({ lat: d.lat, lng: d.lng });
    });
    return pts;
  }, [detections]);

  useEffect(() => {
    if (fitPoints.length > 0) {
      const group = L.featureGroup();
      fitPoints.forEach((ll) => group.addLayer(L.marker([ll.lat, ll.lng], {})));
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      group.clearLayers();
    }
  }, [fitPoints, map]);

  if (!bbox) return null;

  const bounds: L.LatLngBoundsExpression = [
    [bbox[1], bbox[0]],
    [bbox[3], bbox[2]],
  ];

  return (
    <>
      {/* Bbox rectangle */}
      <Rectangle
        bounds={bounds}
        pathOptions={{ color: "#0ea5e3", weight: 2, fillColor: "#0ea5e3", fillOpacity: 0.08, dashArray: "4 4" }}
      />

      {/* Known POI markers (blue) */}
      {points.slice(0, 500).map((poi) => {
        if (poi.lat == null || poi.lng == null) return null;
        // Only show POIs within bbox
        const inBbox = poi.lat >= bbox[1] && poi.lat <= bbox[3] && poi.lng >= bbox[0] && poi.lng <= bbox[2];
        if (!inBbox) return null;
        return (
          <Marker
            key={`poi-${poi.id || poi.name}`}
            position={[poi.lat, poi.lng]}
            icon={L.divIcon({
              className: "edumap-known-poi shadow",
              html: `<div class="flex items-center justify-center text-sky-500" style="width:20px;height:20px"><svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 22],
            })}
          >
            <Popup>
              <div className="font-sans text-xs text-foreground">
                <strong className="block text-sky-400">{poi.name}</strong>
                <span className="block opacity-70 mt-0.5">Đã biết (POI)</span>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Detection markers */}
      {detections.slice(0, 64).map((d: any, i: number) => {
        const isNew = d.match === "new";
        return (
          <Marker
            key={`det-${i}`}
            position={[d.lat, d.lng]}
            icon={detectionIcon(isNew, d.score)}
          >
            <Popup>
              <div className="font-sans text-xs text-foreground">
                <strong className="block" style={{ color: isNew ? "#ef4444" : "#38bdf8" }}>
                  {d.label}
                </strong>
                <span className="block opacity-80 mt-0.5">
                  {isNew ? "MỚI" : "ĐÃ BIẾT"} — điểm: {d.score}%
                </span>
                {d.nearest_poi && (
                  <span className="block opacity-70 mt-0.5">Gần nhất: {d.nearest_poi}</span>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export function GeoVisionOverlay({ result, points }: ToolOverlayProps) {
  return <GeoVisionOverlayMap data={result} points={points} />;
}

const GeoVisionTool = {
  id: "geo-vision",
  label: "GeoVision AI",
  longLabel: "GeoVision AI — Phát hiện từ ảnh vệ tinh",
  icon: Camera,
  description: "Zero-shot phát hiện cơ sở giáo dục từ ảnh vệ tinh.",
  longDescription: "Thu thập ảnh vệ tinh (tối đa 8×8 = 64 ô tile), ghép lại và chạy zero-shot detection (OwlV2) để tìm cơ sở giáo dục chưa được ghi nhận.",
  authRequired: true,
  hideBaseLayers: false,
  defaultCenter: { lat: 10.957, lng: 106.843 },
  Panel: GeoVisionPanel,
  Overlay: GeoVisionOverlay,
};

export default GeoVisionTool;
