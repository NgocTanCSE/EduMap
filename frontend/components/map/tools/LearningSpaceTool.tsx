"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BookOpen, MapPin, Navigation, Wifi, Star, Clock, Users, RefreshCw, AlertCircle, Info, Wind, Loader2, Search, X } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { Marker, Popup, Tooltip, Circle, useMap } from "react-leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";
import { createPinIcon } from "../PinTheme";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { learningSpaceService, RecommendParams, ScoredSpot } from "@/src/services/learning-space.service";
let mapRef: any = null;
function MapBridge() {
    const map = useMap();
    useEffect(() => {
        mapRef = map;
        return () => {
            if (mapRef === map)
                mapRef = null;
        };
    }, [map]);
    return null;
}
function focusSpot(lat: number, lng: number) {
    if (mapRef && Number.isFinite(lat) && Number.isFinite(lng)) {
        mapRef.flyTo([lat, lng], 16, { duration: 0.6 });
    }
}
const DEFAULT_CENTER = { lat: 10.957, lng: 106.843 };
const RADIUS_OPTIONS = [1000, 3000, 5000, 10000, 20000];
function ScoreRing({ score }: {
    score: number;
}) {
    const pct = Math.max(0, Math.min(100, Math.round(score)));
    return (<div className="flex shrink-0 flex-col items-center">
      <div className="text-lg font-bold leading-none text-accent">{pct}</div>
      <div className="mt-0.5 h-1 w-10 overflow-hidden rounded-full bg-muted/30">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }}/>
      </div>
    </div>);
}
function LearningSpacePanel({ viewport, result, onResult, loading, setLoading, error, setError, active, }: ToolPanelProps) {
    const [filters, setFilters] = useState<RecommendParams>({
        lat: DEFAULT_CENTER.lat,
        lng: DEFAULT_CENTER.lng,
        radius: 5000,
        has_wifi: true,
        min_rating: 0,
        quietness_min: 1,
        open_now: false,
        limit: 20,
    });
    const [spotCount, setSpotCount] = useState(0);
    const [degraded, setDegraded] = useState(false);
    const [explanation, setExplanation] = useState<{ name: string; text: string } | null>(null);
    const spots: ScoredSpot[] = useMemo(() => (Array.isArray(result) ? result : []), [result]);
    const fetchSpots = useCallback(async (params: RecommendParams) => {
        try {
            setLoading(true);
            setError(null);
            const data = await learningSpaceService.recommendSpots(params);
            const list = data.spots || [];
            setSpotCount(data.total || list.length);
            setDegraded(!!data.degraded);
            onResult(list);
            if (list.length === 0) {
                toast.info("Không tìm thấy nơi học phù hợp với bộ lọc.");
            }
        }
        catch (err: any) {
            setError(err?.message || "Không thể tải địa điểm học tập");
            setDegraded(true);
            toast.error("Không thể tải danh sách địa điểm học tập");
        }
        finally {
            setLoading(false);
        }
    }, [setLoading, setError, onResult]);
    useEffect(() => {
        if (!active || result !== null)
            return;
        const base = viewport
            ? { lat: (viewport.minLat + viewport.maxLat) / 2, lng: (viewport.minLng + viewport.maxLng) / 2 }
            : { lat: filters.lat, lng: filters.lng };
        void fetchSpots({ ...filters, ...base });
    }, [active]);
    const handleUseViewportOrGps = () => {
        if (!navigator.geolocation) {
            toast.error("Trình duyệt không hỗ trợ định vị");
            return;
        }
        toast.loading("Đang lấy vị trí...", { id: "gps" });
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            const next = { ...filters, lat: latitude, lng: longitude };
            setFilters(next);
            toast.success("Đã lấy vị trí", { id: "gps" });
            void fetchSpots(next);
        }, () => {
            toast.error("Không thể lấy vị trí", { id: "gps" });
        });
    };
    const handleExplain = async (entry: ScoredSpot) => {
        if (entry.explanation) {
            setExplanation({ name: entry.spot.name, text: entry.explanation });
            return;
        }
        try {
            const res = await learningSpaceService.explainSpot(entry, filters);
            if (res.explanation)
                setExplanation({ name: entry.spot.name, text: res.explanation });
            else
                toast.error("Không thể lấy giải thích");
        }
        catch {
            toast.error("Không thể lấy giải thích");
        }
    };
    const handleSelect = (entry: ScoredSpot) => {
        const latLng = learningSpaceService.extractLatLng(entry.spot.location);
        if (latLng)
            focusSpot(latLng[0], latLng[1]);
    };
    if (!active)
        return null;
    return (<div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BookOpen className="w-4 h-4 text-accent"/> Nơi học tập
        </h3>
        <button onClick={() => fetchSpots(filters)} disabled={loading} className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50" title="Làm mới">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}/>
        </button>
      </div>

      <div className="rounded-xl border border-border p-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Bán kính</label>
          <select value={filters.radius} onChange={(e) => setFilters({ ...filters, radius: Number(e.target.value) })} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary">
            {RADIUS_OPTIONS.map((r) => (<option key={r} value={r}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</option>))}
          </select>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <input type="checkbox" id="ls-wifi" checked={!!filters.has_wifi} onChange={(e) => setFilters({ ...filters, has_wifi: e.target.checked })}/>
          <label htmlFor="ls-wifi" className="flex cursor-pointer items-center gap-1.5 text-xs">
            <Wifi className="w-3 h-3"/> Có WiFi
          </label>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <input type="checkbox" id="ls-open" checked={!!filters.open_now} onChange={(e) => setFilters({ ...filters, open_now: e.target.checked })}/>
          <label htmlFor="ls-open" className="flex cursor-pointer items-center gap-1.5 text-xs">
            <Clock className="w-3 h-3"/> Đang mở cửa
          </label>
        </div>

        <div className="mt-2">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Điểm tối thiểu: ≥ {filters.min_rating}/5
          </label>
          <input type="range" min={0} max={5} step={0.5} value={filters.min_rating} onChange={(e) => setFilters({ ...filters, min_rating: Number(e.target.value) })} className="w-full"/>
        </div>

        <div className="mt-2">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Độ yên tĩnh: ≥ {filters.quietness_min}/5
          </label>
          <input type="range" min={1} max={5} step={1} value={filters.quietness_min} onChange={(e) => setFilters({ ...filters, quietness_min: Number(e.target.value) })} className="w-full"/>
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={() => fetchSpots(filters)} disabled={loading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Search className="w-3 h-3"/>}
            Tìm
          </button>
          <button onClick={handleUseViewportOrGps} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs hover:bg-muted/30">
            <Navigation className="w-3 h-3"/>
            Vị trí của tôi
          </button>
        </div>
      </div>

      {degraded && (<div className="flex items-center gap-1.5 rounded-lg bg-primary/10 p-2 text-[11px] text-primary">
          <Info className="w-3 h-3 shrink-0"/>
          Một số giải thích từ AI không khả dụng — hiển thị dữ liệu gốc.
        </div>)}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{spotCount} nơi học phù hợp</span>
        <span>xếp theo điểm AI</span>
      </div>

      {loading && spots.length === 0 ? (<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin"/> Đang tìm...
        </div>) : spots.length === 0 ? (<p className="py-4 text-xs text-muted-foreground/60">
          Chưa có địa điểm nào. Điều chỉnh bộ lọc rồi bấm Tìm.
        </p>) : (<div className="max-h-64 space-y-1 overflow-y-auto scrollbar-hide">
          {spots.map((entry) => {
            const s = entry.spot;
            return (<div key={s.id} role="button" tabIndex={0} onClick={() => handleSelect(entry)} onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(entry);
                    }
                }} className="flex w-full cursor-pointer items-start gap-2 rounded-lg border border-border p-2 text-left text-xs transition-colors hover:bg-muted/30">
              <ScoreRing score={entry.score}/>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <span className="truncate">{s.name}</span>
                  {s.rating_avg > 0 && (<span className="flex shrink-0 items-center gap-0.5 text-[10px] text-primary">
                      <Star className="w-2.5 h-2.5 fill-current"/> {s.rating_avg.toFixed(1)}
                    </span>)}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/70">
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5"/> {entry.distance_km.toFixed(2)} km
                  </span>
                  {s.has_wifi && (<span className="flex items-center gap-0.5"><Wifi className="w-2.5 h-2.5"/> WiFi</span>)}
                  {s.total_capacity > 0 && (<span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5"/> {s.total_capacity}</span>)}
                  {s.quietness && (<span className="flex items-center gap-0.5"><Wind className="w-2.5 h-2.5"/> {s.quietness}/5</span>)}
                  {!entry.open_now && <span className="text-destructive">Đóng cửa</span>}
                </div>
              </div>
              <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    void handleExplain(entry);
                }} className="shrink-0 rounded-lg bg-accent/10 p-1 text-accent hover:bg-accent/20" title="Giải thích lý do đề xuất">
                <Info className="w-3 h-3"/>
              </button>
            </div>);
        })}
        </div>)}

      {explanation && (<div className="rounded-lg border border-accent/30 bg-accent/5 p-2 text-[11px]">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-accent">{explanation.name}</p>
            <button type="button" onClick={() => setExplanation(null)} className="rounded p-0.5 text-muted-foreground hover:bg-muted/30" title="Đóng">
              <X className="w-3 h-3"/>
            </button>
          </div>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{explanation.text}</p>
        </div>)}

      {error && (<div className="flex items-center gap-1.5 rounded-lg bg-muted/10 p-2 text-xs text-muted-foreground/60">
          <AlertCircle className="w-3 h-3"/>
          {error}
        </div>)}
    </div>);
}
function LearningSpaceOverlay({ result }: ToolOverlayProps) {
    const spots: ScoredSpot[] = Array.isArray(result) ? result : [];
    return (<>
      <MapBridge />
      {spots.map((entry) => {
            const s = entry.spot;
            const latLng = learningSpaceService.extractLatLng(s.location);
            if (!latLng)
                return null;
            const [lat, lng] = latLng;
            if (!Number.isFinite(lat) || !Number.isFinite(lng))
                return null;
            const best = entry.score >= 70;
            const color = best ? "#10b981" : entry.score >= 45 ? "#3b82f6" : "#f59e0b";
            return (<React.Fragment key={s.id}>
            <Circle center={[lat, lng]} radius={180} pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.07,
                    weight: 1.5,
                    dashArray: "5 3",
                }}/>
            <Marker position={[lat, lng]} icon={createPinIcon(s.type || "library")}>
              <Tooltip direction="top" offset={[0, -30]} opacity={1} className="learning-space-tooltip">
                <div className="flex items-center gap-1.5 text-xs">
                  <BookOpen className="w-3 h-3 text-accent"/>
                  <span className="font-bold">{s.name}</span>
                  <span className="text-muted-foreground/70">• {Math.round(entry.score)} điểm</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="max-w-xs space-y-1">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-current text-primary"/> {s.rating_avg?.toFixed(1) || "—"}
                    </span>
                    <span>{entry.distance_km.toFixed(2)} km</span>
                    <span className="font-semibold text-accent">{Math.round(entry.score)} điểm</span>
                  </div>
                  {s.address && <p className="text-xs text-muted-foreground/70">{s.address}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
                    {s.has_wifi && (<span className="flex items-center gap-0.5"><Wifi className="w-3 h-3"/> WiFi</span>)}
                    {s.total_capacity > 0 && (<span className="flex items-center gap-0.5"><Users className="w-3 h-3"/> {s.total_capacity} chỗ</span>)}
                    {s.quietness && (<span className="flex items-center gap-0.5"><Wind className="w-3 h-3"/> {s.quietness}/5</span>)}
                    <span className={entry.open_now ? "text-green-600" : "text-destructive"}>
                      {entry.open_now ? "Đang mở" : "Đóng cửa"}
                    </span>
                  </div>
                  <div className="border-t border-border pt-1">
                    <BookmarkButton targetType="learning_space" targetId={s.id} size="sm" showLabel/>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>);
        })}
    </>);
}
const LearningSpaceTool = {
    id: "learning-space",
    label: "Nơi học",
    longLabel: "AI gợi ý nơi học",
    icon: BookOpen,
    description: "Tìm không gian học tập phù hợp và giải thích bằng AI.",
    longDescription: "Gợi ý nơi học theo khoảng cách, WiFi, độ yên tĩnh và giờ mở cửa, kèm lý do do AI giải thích.",
    authRequired: false,
    hideBaseLayers: false,
    Panel: LearningSpacePanel,
    Overlay: LearningSpaceOverlay,
};
export { LearningSpacePanel, LearningSpaceOverlay };
export default LearningSpaceTool;