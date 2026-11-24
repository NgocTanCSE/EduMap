"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Banknote, RefreshCw, AlertCircle, Info, Layers, Users } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { logger } from "@/src/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";
import { Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import HeatmapLayer from "@/components/map/HeatmapLayer";
import type { ToolPanelProps, ToolOverlayProps } from "./types";
const BUDGET_OPTIONS = [
    { value: 5, label: "5 triệu" },
    { value: 15, label: "15 triệu" },
    { value: 30, label: "30 triệu" },
    { value: 50, label: "50 triệu" },
    { value: 75, label: "75 triệu" },
    { value: 100, label: "100 triệu" },
];
const COVERAGE_RADIUS_OPTIONS = [
    { value: 0, label: "Theo mặc định từng loại cơ sở" },
    { value: 0.5, label: "0,5 km" },
    { value: 1, label: "1 km" },
    { value: 2, label: "2 km" },
    { value: 3, label: "3 km" },
];
const REGION_RADIUS_OPTIONS = [
    { value: 5, label: "5 km" },
    { value: 10, label: "10 km" },
    { value: 15, label: "15 km" },
    { value: 25, label: "25 km" },
];
const PLAN_COLORS: Record<string, string> = {
    A: "#22c57e",
    B: "#38bdf8",
    C: "#f59e0b",
};
const PLAN_META: Record<string, {
    label: string;
    pct: number;
}> = {
    A: { label: "Cơ sở dữ liệu", pct: 40 },
    B: { label: "Cân bằng", pct: 70 },
    C: { label: "Toàn diện", pct: 100 },
};
const FACILITY_LABELS: Record<string, string> = {
    wifi: "Wi-Fi công cộng",
    computer: "Phòng máy tính",
    library: "Tủ sách / Thư viện",
    study_space: "Không gian học tập",
};
const DEFAULT_RADII = "Wi-Fi 0,6 km · phòng máy 0,3 km · thư viện 0,8 km · không gian học 0,5 km";
export function ResourceOptimizerPanel({ viewport, result, onResult, loading, setLoading, error, setError, active, }: ToolPanelProps) {
    const [budgetMillion, setBudgetMillion] = useState(30);
    const [coverageRadiusKm, setCoverageRadiusKm] = useState(0);
    const [regionRadiusKm, setRegionRadiusKm] = useState(10);
    const fetchOptimization = useCallback(async () => {
        if (!active)
            return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set("budget", String(budgetMillion * 1000000));
            params.set("region_radius_km", String(regionRadiusKm));
            if (coverageRadiusKm > 0)
                params.set("coverage_radius_km", String(coverageRadiusKm));
            if (viewport) {
                params.set("center_lat", String((viewport.minLat + viewport.maxLat) / 2));
                params.set("center_lng", String((viewport.minLng + viewport.maxLng) / 2));
            }
            const res = await fetchWithRetry(`/api/map/resource-optimization?${params.toString()}`, { retries: 2 });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const data = unwrapApiResponse<any>(json);
            onResult(data);
            if (data?.degraded || data?.status === "degraded") {
                toast.warning(data?.reason || "Chưa có điểm nhu cầu thật trong vùng.");
            }
            else {
                toast.success("Đã tính xong kế hoạch phân bổ.");
            }
        }
        catch (err: any) {
            logger.error("Resource optimization error", err);
            setError(err?.message || "Không thể tính tối ưu nguồn lực.");
            toast.error("Tính tối ưu thất bại — vui lòng thử lại.");
        }
        finally {
            setLoading(false);
        }
    }, [budgetMillion, coverageRadiusKm, regionRadiusKm, viewport, active, onResult, setLoading, setError]);
    useEffect(() => {
        if (active && !result)
            fetchOptimization();
    }, [active]);
    const plans = useMemo(() => result?.plans || {}, [result]);
    const summary = useMemo(() => result?.summary || {}, [result]);
    const meta = useMemo(() => result?.metadata || {}, [result]);
    const degraded = !!(result?.degraded || result?.status === "degraded" || summary?.error);
    const degradedReason = result?.reason || summary.error || "Chưa có dữ liệu nhu cầu trong vùng.";
    const solver = plans?.C?.solver || plans?.A?.solver || "unknown";
    const planIds = useMemo(() => Object.keys(PLAN_META).filter((id) => plans[id]), [plans]);
    return (<div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Bài toán MCLP (Maximizing Coverage Location Problem): chọn tổ hợp cơ sở
        giáo dục sao cho phủ được nhiều người học nhất trong ngân sách. Điểm nhu
        cầu lấy từ POI giáo dục thật trong vùng.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Ngân sách: {budgetMillion} triệu VND</label>
          <select value={budgetMillion} onChange={(e) => setBudgetMillion(parseInt(e.target.value, 10))} className="form-select mt-1 w-full text-sm">
            {BUDGET_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Bán kính phủ sóng</label>
          <select value={coverageRadiusKm} onChange={(e) => setCoverageRadiusKm(parseFloat(e.target.value))} className="form-select mt-1 w-full text-sm">
            {COVERAGE_RADIUS_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            Mặc định: {DEFAULT_RADII}
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Bán kính vùng phân tích</label>
          <select value={regionRadiusKm} onChange={(e) => setRegionRadiusKm(parseInt(e.target.value, 10))} className="form-select mt-1 w-full text-sm">
            {REGION_RADIUS_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            Dùng khi cần sinh thêm vị trí ứng viên quanh tâm vùng.
          </p>
        </div>

        <button onClick={fetchOptimization} disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60">
          {loading ? (<>
              <RefreshCw className="w-4 h-4 animate-spin"/> Đang tính...
            </>) : (<>
              <Banknote className="w-4 h-4"/> Tính lại kế hoạch
            </>)}
        </button>
      </div>

      {degraded && (<div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
          <span>{degradedReason}</span>
        </div>)}

      {result && !degraded && (<div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="text-2xl font-bold text-primary">{summary.candidate_count || 0}</div>
            <div className="text-[10px] text-muted-foreground">Vị trí ứng viên</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="text-2xl font-bold text-destructive">{summary.demand_count || 0}</div>
            <div className="text-[10px] text-muted-foreground">Điểm nhu cầu</div>
          </div>
        </div>)}

      {planIds.length > 0 && (<div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Layers className="w-3.5 h-3.5"/>
            <span>So sánh kế hoạch</span>
          </div>
          {planIds.map((planId) => {
            const planData = plans[planId] || {};
            const info = PLAN_META[planId];
            const color = PLAN_COLORS[planId] || "#647493";
            const served = planData.total_served ?? 0;
            const demand = planData.total_demand ?? 0;
            return (<div key={planId} className="p-3 rounded-lg bg-muted/10 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}/>
                    <span className="text-sm font-medium text-foreground">{info.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{info.pct}% ngân sách</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
                  <div>
                    <div className="font-bold text-base text-foreground">{planData.selected ?? 0}</div>
                    <div className="text-muted-foreground/60">Cơ sở chọn</div>
                  </div>
                  <div>
                    <div className="font-bold text-base text-foreground">{(planData.coverage_pct ?? 0).toFixed(0)}%</div>
                    <div className="text-muted-foreground/60">Độ phủ</div>
                  </div>
                  <div>
                    <div className="font-bold text-base text-foreground">{(planData.budget_used_pct ?? 0).toFixed(0)}%</div>
                    <div className="text-muted-foreground/60">Ngân sách dùng</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                  <Users className="w-3 h-3"/>
                  <span>Phục vụ {served}/{demand} điểm nhu cầu</span>
                  <span className="ml-auto">Chi phí {(planData.total_cost || 0).toLocaleString("vi-VN")}₫</span>
                </div>
              </div>);
        })}
          <p className="text-[10px] text-muted-foreground/60">
            Kế hoạch A/B/C lần lượt dùng 40% / 70% / 100% ngân sách (C là toàn diện nhất).
          </p>
        </div>)}

      {result && (<div className="p-3 rounded-lg bg-muted/20 border border-border text-[10px] text-muted-foreground/80 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Info className="w-3.5 h-3.5"/>
            <span>Phương pháp</span>
          </div>
          <div>• MCLP: tối đa hoá số điểm nhu cầu được phủ trong ngân sách.</div>
          <div>• Điểm nhu cầu = POI giáo dục thật (trọng số theo đánh giá); ứng viên = vị trí POI.</div>
          <div>• Đơn giá mỗi cơ sở theo loại hình; bán kính phủ theo cấu hình ở trên.</div>
          <div>• Kết quả: {meta.cached ? "lấy từ cache" : "tính mới"} · bộ giải: {solver}.</div>
        </div>)}

      {error && (<div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
          <span>{error}</span>
        </div>)}
    </div>);
}
function ResourceOptimizerOverlayMap({ data, points }: {
    data: any;
    points: any[];
}) {
    const map = useMap();
    const features = useMemo(() => data?.features || [], [data]);
    const gapFeatures = useMemo(() => data?.gaps?.features || [], [data]);
    const facilityFeatures = useMemo(() => features.filter((f: any) => f.properties?.plan), [features]);
    const fitPoints = useMemo(() => {
        const pts: {
            lat: number;
            lng: number;
        }[] = [];
        facilityFeatures.forEach((f: any) => {
            const coords = f.geometry?.coordinates;
            if (coords && typeof coords[1] === "number") {
                pts.push({ lat: coords[1], lng: coords[0] });
            }
        });
        return pts;
    }, [facilityFeatures]);
    useEffect(() => {
        if (fitPoints.length > 0) {
            const group = L.featureGroup();
            fitPoints.forEach((ll) => group.addLayer(L.marker([ll.lat, ll.lng], {})));
            const bounds = group.getBounds();
            if (bounds.isValid())
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
            group.clearLayers();
        }
    }, [fitPoints, map]);
    if (!facilityFeatures.length && !gapFeatures.length)
        return null;
    return (<>
      <HeatmapLayer points={points
            .filter((p) => p.lat != null && p.lng != null)
            .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), intensity: 0.5 }))}/>

      {gapFeatures.slice(0, 80).map((f: any, idx: number) => {
            const coords = f.geometry?.coordinates;
            if (!coords || typeof coords[1] !== "number")
                return null;
            const demand = Number(f.properties?.demand || 1);
            return (<Circle key={`gap-${idx}`} center={[coords[1], coords[0]]} radius={Math.min(1200, 150 + demand * 4)} pathOptions={{
                    color: "#ef4444",
                    fillColor: "#ef4444",
                    weight: 1,
                    fillOpacity: 0.12,
                }}>
            <Popup>
              <div className="font-sans text-xs text-foreground">
                <strong className="block text-red-500">Chưa được phủ</strong>
                <span className="block opacity-80 mt-0.5">
                  {f.properties?.name || "Điểm nhu cầu"}
                </span>
                {f.properties?.address && (<span className="block opacity-70 mt-0.5">{f.properties.address}</span>)}
              </div>
            </Popup>
          </Circle>);
        })}

      {facilityFeatures.slice(0, 120).map((f: any, idx: number) => {
            const coords = f.geometry?.coordinates;
            if (!coords || typeof coords[1] !== "number")
                return null;
            const planId = f.properties.plan;
            const color = PLAN_COLORS[planId] || "#647493";
            return (<Marker key={`fac-${idx}`} position={[coords[1], coords[0]]} icon={L.divIcon({
                    className: "edumap-facility-marker shadow",
                    html: `<div class="relative flex items-center justify-center" style="width:24px;height:24px"><svg viewBox="0 0 24 24" class="absolute inset-0 w-6 h-6"><path fill="${color}" opacity="0.3" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg><div class="w-3.5 h-3.5 rounded-sm" style="background:${color}"></div></div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 26],
                    popupAnchor: [0, -30],
                })}>
            <Popup>
              <div className="font-sans text-xs text-foreground">
                <strong className="block" style={{ color }}>
                  {f.properties.name || "Đề xuất cơ sở"}
                </strong>
                <span className="block opacity-80 mt-0.5">
                  {FACILITY_LABELS[f.properties.facility_type] || f.properties.facility_type || "Cơ sở"}
                </span>
                <span className="block opacity-80 mt-0.5">
                  Kế hoạch {planId} · phục vụ {f.properties.demand_served ?? 0} điểm nhu cầu
                </span>
                {f.properties.cost != null && (<span className="block opacity-70 mt-0.5">
                    Chi phí: {Number(f.properties.cost).toLocaleString("vi-VN")}₫
                  </span>)}
              </div>
            </Popup>
          </Marker>);
        })}
    </>);
}
export function ResourceOptimizerOverlay({ result, points }: ToolOverlayProps) {
    return <ResourceOptimizerOverlayMap data={result} points={points}/>;
}
const ResourceOptimizerTool = {
    id: "resource-optimizer",
    label: "Tối ưu nguồn lực",
    longLabel: "Tối ưu Nguồn lực Giáo dục",
    icon: Banknote,
    description: "MCLP tối ưu vị trí cơ sở giáo dục trong ngân sách.",
    longDescription: "Tối ưu vị trí cơ sở giáo dục mới bằng MCLP (Maximizing Coverage Location Problem) — tối đa hoá số người được phục vụ trong ngân sách.",
    authRequired: true,
    hideBaseLayers: false,
    defaultCenter: { lat: 10.957, lng: 106.843 },
    Panel: ResourceOptimizerPanel,
    Overlay: ResourceOptimizerOverlay,
};
export default ResourceOptimizerTool;
