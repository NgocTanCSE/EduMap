/**
 * Survey Planner Tool (Idea #20 — Active Learning for Field Survey)
 *
 * Merged into the unified Map Hub. Previously a standalone page at
 * `/map/survey-planner`; now the `survey-planner` tab on `/map`.
 *
 * Panel: location + tunable params + priorities list + next-best point.
 * Overlay: priority pins (colour by label) + gold next-best pin + current
 *   location circle.
 */
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  BrainCircuit, RefreshCw, AlertCircle, Info, Target,
  MapPin, Star, List, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";
import {
  MapContainer, TileLayer, GeoJSON, Marker, Popup, Circle, useMap,
} from "react-leaflet";
import L from "leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";

const DEFAULT_CENTER = { lat: 10.957, lng: 106.843 }; // Biên Hòa, Đồng Nai

function priorityColor(score: number): string {
  if (score > 0.015) return "#ef4444";
  if (score > 0.008) return "#f59e0b";
  if (score > 0.003) return "#38bdf8";
  return "#22c57e";
}

function priorityLabel(score: number): string {
  if (score > 0.015) return "Rất cao";
  if (score > 0.008) return "Cao";
  if (score > 0.003) return "Trung bình";
  return "Thấp";
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function SurveyPlannerPanel({
  viewport, result, onResult, loading, setLoading, error, setError, active,
}: ToolPanelProps) {
  const [currentLat, setCurrentLat] = useState(DEFAULT_CENTER.lat);
  const [currentLng, setCurrentLng] = useState(DEFAULT_CENTER.lng);
  const [gridSizeKm, setGridSizeKm] = useState(1.0);
  const [topN, setTopN] = useState(15);
  const [surveyTimeHours, setSurveyTimeHours] = useState(1.0);
  const [surveyorSpeedKmh, setSurveyorSpeedKmh] = useState(30.0);
  const [autoLocate, setAutoLocate] = useState(false);

  const fetchPriorities = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("current_lat", String(currentLat));
      params.set("current_lng", String(currentLng));
      params.set("grid_size_km", String(gridSizeKm));
      params.set("top_n", String(topN));
      params.set("survey_time_hours", String(surveyTimeHours));
      params.set("surveyor_speed_kmh", String(surveyorSpeedKmh));
      const res = await fetchWithRetry(
        `/api/map/survey/priorities?${params.toString()}`, { retries: 2 },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      onResult(data);
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || "Dữ liệu hiếm — đang dùng ứng cử viên tĩnh.");
      } else {
        toast.success(`Tìm thấy ${data?.summary?.poi_count || 0} điểm khảo sát.`);
      }
    } catch (err: any) {
      logger.error("Survey priorities error", err);
      setError(err?.message || "Không thể tải ưu tiên khảo sát.");
      toast.error("Tải dữ liệu thất bại — vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [currentLat, currentLng, gridSizeKm, topN, surveyTimeHours, surveyorSpeedKmh, active, onResult, setLoading, setError]);

  useEffect(() => {
    if (autoLocate && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentLat(pos.coords.latitude);
        setCurrentLng(pos.coords.longitude);
      });
    }
  }, [autoLocate]);

  useEffect(() => {
    if (active && !result) fetchPriorities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const features = useMemo(() => result?.features || [], [result]);
  const nextPoint = useMemo(() => result?.next_point || null, [result]);
  const meta = useMemo(() => result?.metadata || {}, [result]);
  const summary = useMemo(() => result?.summary || {}, [result]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Chọn điểm khảo sát kế tiếp tối đa hoá lượng thông tin thu được trên
        mỗi đơn vị thời gian. Dựa trên entropy của mật độ khoảng trống và
        chi phí di chuyển.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Tâm điểm khảo sát</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <input
              type="number" step={0.0001} value={currentLat}
              onChange={(e) => setCurrentLat(parseFloat(e.target.value))}
              className="text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <input
              type="number" step={0.0001} value={currentLng}
              onChange={(e) => setCurrentLng(parseFloat(e.target.value))}
              className="text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="checkbox" id="auto-locate" checked={autoLocate}
              onChange={(e) => setAutoLocate(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="auto-locate" className="text-xs text-muted-foreground">
              Dùng vị trí hiện tại
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            Mặc định: Biên Hòa, Đồng Nai (10.957, 106.843)
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Kích thước ô lưới: {gridSizeKm} km</label>
          <select
            value={gridSizeKm}
            onChange={(e) => setGridSizeKm(parseFloat(e.target.value))}
            className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {[0.5, 1.0, 2.0].map((s) => (
              <option key={s} value={s}>{s} km</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Số điểm đề xuất: {topN}</label>
          <select
            value={topN}
            onChange={(e) => setTopN(parseInt(e.target.value, 10))}
            className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {[5, 10, 15, 25, 50].map((n) => (
              <option key={n} value={n}>{n} điểm</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Thời gian khảo sát (giờ)</label>
            <input
              type="number" step={0.5} min={0.5} max={4} value={surveyTimeHours}
              onChange={(e) => setSurveyTimeHours(parseFloat(e.target.value))}
              className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tốc độ di chuyển (km/h)</label>
            <input
              type="number" step={5} min={5} max={60} value={surveyorSpeedKmh}
              onChange={(e) => setSurveyorSpeedKmh(parseFloat(e.target.value))}
              className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        <button
          onClick={fetchPriorities} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang tính toán…
            </>
          ) : (
            <>
              <Target className="w-4 h-4" /> Tính toán ưu tiên
            </>
          )}
        </button>
      </div>

      {/* Degraded banner */}
      {meta.degraded && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{meta.reason || "Dữ liệu hiếm — đang dùng ứng cử viên tĩnh."}</span>
        </div>
      )}

      {/* Cache notice */}
      {meta.cached && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <Info className="w-3.5 h-3.5" />
          <span>Kết quả từ cache (24h).</span>
        </div>
      )}

      {/* Summary */}
      {result && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="text-2xl font-bold text-primary">{summary.poi_count || features.length}</div>
            <div className="text-[10px] text-muted-foreground">Điểm khảo sát đề xuất</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="text-2xl font-bold text-destructive">{topN}</div>
            <div className="text-[10px] text-muted-foreground">Giới hạn trên</div>
          </div>
        </div>
      )}

      {/* Next-best point */}
      {nextPoint && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
            <Star className="w-4 h-4 text-amber-400 fill-current" />
            <span>Điểm khảo sát tiếp theo</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>vĩ độ: {Number(nextPoint.lat).toFixed(6)}, kinh độ: {Number(nextPoint.lng).toFixed(6)}</div>
            {nextPoint.score != null && <div>priority_score: {Number(nextPoint.score).toFixed(4)}</div>}
            {nextPoint.label && <div>nhãn: {nextPoint.label}</div>}
          </div>
        </div>
      )}

      {/* Priorities list */}
      {features.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <List className="w-3.5 h-3.5" />
            <span>Danh sách ưu tiên ({features.length})</span>
          </div>
          {features.slice(0, 25).map((f: any, i: number) => {
            const props = f.properties || {};
            const score = props.priority_score || 0;
            const color = priorityColor(score);
            return (
              <div key={`prio-${i}`} className="p-2 rounded border text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-medium text-foreground truncate">
                    {props.area || `Ô ${props.cell_id || i}`}
                  </span>
                  <span className={`ml-auto font-bold`} style={{ color }}>
                    {Number(score).toFixed(4)}
                  </span>
                </div>
                {props.info_value != null && (
                  <div className="text-muted-foreground/60 mt-0.5">
                    info_value: {Number(props.info_value).toFixed(4)} · cost: {Number(props.cost).toFixed(2)}
                  </div>
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
            <Settings2 className="w-3.5 h-3.5" />
            <span>Tham số</span>
          </div>
          <div>• priority_score = info_value / cost</div>
          <div>• info_value = entropy reduction (uncertainty = entropy of gap-density p_exist)</div>
          <div>• cost = distance_km / speed + survey_time (default {surveyTimeHours}h, {surveyorSpeedKmh}km/h)</div>
          <div>• Influence radius: 2 km</div>
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

const NEXT_PIN_SVG = `<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="#f59e0b" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;
const CUR_PIN_SVG = `<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="#0ea5e3" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;

const _iconCache = new Map<string, L.DivIcon>();

function getPriorityIcon(score: number, isNext: boolean): L.DivIcon {
  const key = `${isNext ? "next" : "prio"}-${score > 0.015 ? "high" : score > 0.008 ? "med" : score > 0.003 ? "low" : "lowest"}`;
  const cached = _iconCache.get(key);
  if (cached) return cached;
  const color = isNext ? "#f59e0b" : priorityColor(score);
  const html = `<div class="flex items-center justify-center border-2 border-white rounded-full" style="width:24px;height:24px;background:${color}20"><svg viewBox="0 0 24 24" class="w-5 h-5"><path fill="${color}" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg></div>`;
  const icon = L.divIcon({
    className: "edumap-survey-marker shadow",
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 26],
    popupAnchor: [0, -30],
  });
  _iconCache.set(key, icon);
  return icon;
}

function SurveyPlannerOverlayMap({ result, points }: { result: any; points: any[] }) {
  const map = useMap();
  const features = useMemo(() => result?.features || [], [result]);
  const nextPoint = useMemo(() => result?.next_point || null, [result]);
  const currentLat = result?.params?.current_lat ?? DEFAULT_CENTER.lat;
  const currentLng = result?.params?.current_lng ?? DEFAULT_CENTER.lng;

  const fitPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    features.forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[1] === "number") pts.push({ lat: coords[1], lng: coords[0] });
    });
    if (nextPoint?.lat != null) pts.push({ lat: nextPoint.lat, lng: nextPoint.lng });
    return pts;
  }, [features, nextPoint]);

  useEffect(() => {
    if (fitPoints.length > 0) {
      const group = L.featureGroup();
      fitPoints.forEach((ll) => group.addLayer(L.marker([ll.lat, ll.lng], {})));
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      group.clearLayers();
    }
  }, [fitPoints, map]);

  if (!features.length && !nextPoint) return null;

  return (
    <>
      {/* Current location circle */}
      <Circle
        center={[currentLat, currentLng]}
        radius={200}
        pathOptions={{ color: "#0ea5e3", fillColor: "#0ea5e3", weight: 2, fillOpacity: 0.15, dashArray: "4 3" }}
      />
      <Marker
        position={[currentLat, currentLng]}
        icon={L.divIcon({
          className: "edumap-current-loc shadow",
          html: `<div class="flex items-center justify-center text-sky-400" style="width:24px;height:24px">${CUR_PIN_SVG}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 26],
        })}
      >
        <Popup>
          <div className="font-sans text-xs text-foreground">
            <strong className="block text-sky-400">Vị trí hiện tại</strong>
            <span className="block opacity-70 mt-0.5">({currentLat.toFixed(4)}, {currentLng.toFixed(4)})</span>
          </div>
        </Popup>
      </Marker>

      {/* Priority pins */}
      {features.slice(0, 100).map((f: any, idx: number) => {
        const coords = f.geometry?.coordinates;
        if (!coords || typeof coords[1] !== "number") return null;
        const props = f.properties || {};
        const score = props.priority_score || 0;
        const isNext = nextPoint?.lat === coords[1] && nextPoint?.lng === coords[0];
        return (
          <Marker
            key={`prio-${idx}`}
            position={[coords[1], coords[0]]}
            icon={getPriorityIcon(score, isNext)}
          >
            <Popup>
              <div className="font-sans text-xs text-foreground">
                <strong className={isNext ? "text-amber-400" : "text-primary"}>
                  {props.area || `Ô ${props.cell_id || idx}`}
                </strong>
                {isNext && <span className="block text-amber-300">→ Tiếp theo</span>}
                <span className="block opacity-80 mt-0.5">
                  priority_score: {Number(score).toFixed(4)}
                </span>
                {props.info_value != null && (
                  <span className="block opacity-70">info_value: {Number(props.info_value).toFixed(4)}</span>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Next-best point (gold star) */}
      {nextPoint && nextPoint.lat != null && (
        <Marker
          position={[nextPoint.lat, nextPoint.lng]}
          icon={L.divIcon({
            className: "edumap-next-point shadow z-10",
            html: `<div class="flex items-center justify-center" style="width:28px;height:28px"><Star className="w-5 h-5" fill="#f59e0b" /></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 30],
            popupAnchor: [0, -34],
          })}
        >
          <Popup>
            <div className="font-sans text-xs text-foreground">
              <strong className="block text-amber-400 flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" /> Điểm kế tiếp
              </strong>
              <span className="block opacity-80 mt-0.5">
                ({Number(nextPoint.lat).toFixed(6)}, {Number(nextPoint.lng).toFixed(6)})
              </span>
              {nextPoint.label && (
                <span className="block opacity-70">nhãn: {nextPoint.label}</span>
              )}
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

export function SurveyPlannerOverlay({ result, points }: ToolOverlayProps) {
  return <SurveyPlannerOverlayMap result={result} points={points} />;
}

const SurveyPlannerTool = {
  id: "survey-planner",
  label: "Kế hoạch khảo sát",
  longLabel: "Kế hoạch Khảo sát AI",
  icon: Target,
  description: "Chọn điểm khảo sát tối đa hoá thông tin thu được.",
  longDescription: "Chọn điểm khảo sát kế tiếp tối đa hoá lượng thông tin thu được trên mỗi đơn vị thời gian. Dựa trên entropy của mật độ khoảng trống và chi phí di chuyển.",
  authRequired: true,
  hideBaseLayers: false,
  defaultCenter: { lat: 10.957, lng: 106.843 },
  Panel: SurveyPlannerPanel,
  Overlay: SurveyPlannerOverlay,
};

export default SurveyPlannerTool;
