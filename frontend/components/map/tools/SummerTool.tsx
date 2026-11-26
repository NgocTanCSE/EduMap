"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sun, MapPin, Users, Loader2, RefreshCw, AlertCircle, TrendingUp, HeartHandshake, Activity, Search, X } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { Marker, Popup, Tooltip, Circle, useMap } from "react-leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";
import { createPinIcon } from "../PinTheme";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { summerService, SummerCampaign } from "@/src/services/summer.service";
import { authService } from "@/src/services/auth.service";
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
function focusCampaign(lat: number, lng: number) {
    if (mapRef && Number.isFinite(lat) && Number.isFinite(lng)) {
        mapRef.flyTo([lat, lng], 12, { duration: 0.6 });
    }
}
function campaignCoords(camp: SummerCampaign): [number, number] | null {
    const lat = Number(camp?.lat);
    const lng = Number(camp?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return [lat, lng];
    }
    return null;
}
const STATUS_LABEL: Record<string, string> = {
    active: "Đang tuyển quân",
    completed: "Đã kết thúc",
    upcoming: "Sắp mở",
};
function SummerPanel({ result, onResult, loading, setLoading, error, setError, active }: ToolPanelProps) {
    const [campaigns, setCampaigns] = useState<SummerCampaign[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [registeringId, setRegisteringId] = useState<string | null>(null);
    const [reportFor, setReportFor] = useState<SummerCampaign | null>(null);
    const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
    const [reportData, setReportData] = useState<any>(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [visibleCampaigns, setVisibleCampaigns] = useState(30);
    const [visibleReports, setVisibleReports] = useState(15);
    const fetchCampaigns = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data: any = await summerService.getCampaigns();
            const list: SummerCampaign[] = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.data)
                        ? data.data
                        : [];
            setCampaigns(list);
            onResult(list);
        }
        catch (err: any) {
            setError(err?.message || "Không thể tải danh sách chiến dịch");
            toast.error("Không thể tải danh sách chiến dịch");
        }
        finally {
            setLoading(false);
        }
    }, [setLoading, setError, onResult]);
    useEffect(() => {
        if (!active || result !== null)
            return;
        void fetchCampaigns();
    }, [active]);
    const filtered = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        if (!needle)
            return campaigns;
        return campaigns.filter((c) => `${c.name} ${c.location}`.toLowerCase().includes(needle));
    }, [campaigns, searchTerm]);
    useEffect(() => {
        setVisibleCampaigns(30);
    }, [searchTerm]);
    useEffect(() => {
        setVisibleReports(15);
    }, [reportData]);
    const handleRegister = async (camp: SummerCampaign) => {
        if (!authService.isLoggedIn()) {
            toast.error("Vui lòng đăng nhập để đăng ký");
            return;
        }
        try {
            setRegisteringId(camp.id);
            const res = await summerService.registerVolunteer(camp.id);
            toast.success(res.message || "Đăng ký tham gia thành công!");
        }
        catch (err: any) {
            toast.error(err?.message || "Lỗi đăng ký");
        }
        finally {
            setRegisteringId(null);
        }
    };
    const loadReport = async (camp: SummerCampaign, date: string) => {
        try {
            setLoadingReport(true);
            const data = await summerService.getDailyReport(camp.id, date);
            setReportData((data as any)?.data ?? data);
        }
        catch {
            toast.error("Lỗi khi tải báo cáo");
            setReportData(null);
        }
        finally {
            setLoadingReport(false);
        }
    };
    const openReport = (camp: SummerCampaign) => {
        setReportFor(camp);
        setReportData(null);
        void loadReport(camp, reportDate);
    };
    if (!active)
        return null;
    const shownCampaigns = filtered.slice(0, visibleCampaigns);
    const activities = Array.isArray(reportData?.activities) ? reportData.activities : [];
    const shownReports = activities.slice(0, visibleReports);
    return (<div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sun className="w-4 h-4 text-orange-500"/> Mùa hè xanh
        </h3>
        <button onClick={fetchCampaigns} disabled={loading} className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50" title="Làm mới">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}/>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"/>
        <input type="text" placeholder="Tìm chiến dịch, địa bàn..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary"/>
      </div>

      {reportFor ? (<div className="card-surface p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
                <Activity className="h-3 w-3"/> Báo cáo ngày
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{reportFor.name}</p>
            </div>
            <button onClick={() => setReportFor(null)} className="rounded p-1 text-muted-foreground hover:bg-muted/50" title="Đóng">
              <X className="h-3 w-3"/>
            </button>
          </div>
          <input type="date" value={reportDate} onChange={(e) => {
                setReportDate(e.target.value);
                void loadReport(reportFor, e.target.value);
            }} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"/>
          {loadingReport ? (<div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin"/> Đang tải...
            </div>) : reportData ? (<div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-muted/20 p-2">
                  <p className="text-[10px] text-muted-foreground">TNV đăng ký</p>
                  <p className="text-lg font-bold text-primary">{reportData.total_volunteers_approved || 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-2">
                  <p className="text-[10px] text-muted-foreground">Số hoạt động</p>
                  <p className="text-lg font-bold text-accent">{reportData.activity_count || 0}</p>
                </div>
              </div>
              <div className="space-y-1">
                {activities.length > 0 ? shownReports.map((act: any, idx: number) => (<div key={idx} className="rounded-lg border border-border p-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-foreground">{act.title}</span>
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{act.status}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                      <span>{act.hours_spent} giờ</span>
                      <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5"/> {act.volunteer_count} TNV</span>
                    </p>
                  </div>)) : (<p className="py-2 text-center text-[11px] italic text-muted-foreground/60">
                    Chưa có nhật ký hoạt động cho ngày này.
                  </p>)}
                {activities.length > visibleReports ? (<button type="button" onClick={() => setVisibleReports((c) => c + 15)} className="w-full rounded-lg border border-border/70 bg-muted/30 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground">{`Hiện thêm ${Math.min(15, activities.length - visibleReports)} hoạt động (còn ${activities.length - visibleReports})`}</button>) : activities.length > 15 ? (<p className="py-1 text-center text-[10px] text-muted-foreground/60">{`Đã hiện tất cả ${activities.length} hoạt động`}</p>) : null}
              </div>
            </div>) : (<p className="mt-2 text-center text-[11px] text-muted-foreground/60">Không có dữ liệu báo cáo.</p>)}
        </div>) : (<>
          {loading && campaigns.length === 0 ? (<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin"/> Đang tải...
            </div>) : filtered.length === 0 ? (<p className="py-4 text-xs text-muted-foreground/60">Chưa có chiến dịch nào.</p>) : (<div className="space-y-1">
              {shownCampaigns.map((camp) => {
                const isActive = camp.status === "active";
                return (<div key={camp.id} className="rounded-lg border border-border p-2 text-xs transition-colors hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => {
                            const c = campaignCoords(camp);
                            if (c)
                                focusCampaign(c[0], c[1]);
                        }} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${isActive ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                            {STATUS_LABEL[camp.status] || camp.status}
                          </span>
                          <span className="truncate">{camp.name}</span>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                          <MapPin className="h-2.5 w-2.5 shrink-0 text-primary"/>
                          <span className="truncate">{camp.location}</span>
                        </p>
                      </button>
                      <BookmarkButton targetType="summer" targetId={camp.id} size="sm"/>
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      <button type="button" onClick={() => openReport(camp)} className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border py-1 text-[10px] font-medium hover:bg-muted/40">
                        <TrendingUp className="h-2.5 w-2.5 text-primary"/> Báo cáo
                      </button>
                      <button type="button" onClick={() => handleRegister(camp)} disabled={!isActive || registeringId === camp.id} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                        {registeringId === camp.id ? <Loader2 className="h-2.5 w-2.5 animate-spin"/> : <HeartHandshake className="h-2.5 w-2.5"/>}
                        {isActive ? "Đăng ký" : "Đã đóng"}
                      </button>
                    </div>
                  </div>);
            })}
              {filtered.length > visibleCampaigns ? (<button type="button" onClick={() => setVisibleCampaigns((c) => c + 50)} className="w-full rounded-lg border border-border/70 bg-muted/30 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground">{`Hiện thêm ${Math.min(50, filtered.length - visibleCampaigns)} chiến dịch (còn ${filtered.length - visibleCampaigns})`}</button>) : filtered.length > 30 ? (<p className="py-1 text-center text-[10px] text-muted-foreground/60">{`Đã hiện tất cả ${filtered.length} chiến dịch`}</p>) : null}
            </div>)}
        </>)}

      {error && (<div className="flex items-center gap-1.5 rounded-lg bg-muted/10 p-2 text-xs text-muted-foreground/60">
          <AlertCircle className="h-3 w-3"/>
          {error}
        </div>)}
    </div>);
}
function SummerOverlay({ result }: ToolOverlayProps) {
    const campaigns: SummerCampaign[] = Array.isArray(result) ? result : [];
    return (<>
      <MapBridge />
      {campaigns.map((camp) => {
            const coords = campaignCoords(camp);
            if (!coords)
                return null;
            const [lat, lng] = coords;
            const color = camp.status === "active" ? "#f97316" : "#94a3b8";
            return (<React.Fragment key={camp.id}>
            <Circle center={[lat, lng]} radius={1200} pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.06,
                    weight: 1.5,
                    dashArray: "5 3",
                }}/>
            <Marker position={[lat, lng]} icon={createPinIcon("summer")}>
              <Tooltip direction="top" offset={[0, -34]} opacity={1} className="summer-tooltip">
                <div className="flex items-center gap-1.5 text-xs">
                  <Sun className="h-3 w-3 text-orange-500"/>
                  <span className="font-bold">{camp.name}</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="max-w-xs space-y-1">
                  <div className="text-sm font-medium">{camp.name}</div>
                  <p className="text-xs text-muted-foreground/70">
                    {STATUS_LABEL[camp.status] || camp.status} · {camp.year}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground/70">
                    <MapPin className="h-3 w-3"/> {camp.location}
                  </p>
                  {camp.description && <p className="line-clamp-3 text-xs text-muted-foreground/70">{camp.description}</p>}
                  <div className="border-t border-border pt-1">
                    <BookmarkButton targetType="summer" targetId={camp.id} size="sm" showLabel/>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>);
        })}
    </>);
}
const SummerTool = {
    id: "summer",
    label: "Mùa hè",
    longLabel: "Chiến dịch mùa hè",
    icon: Sun,
    description: "Chiến dịch tình nguyện mùa hè và đăng ký tham gia trên bản đồ.",
    longDescription: "Xem chiến dịch Mùa hè xanh theo địa bàn, báo cáo hoạt động hằng ngày và đăng ký tham gia ngay trong panel bản đồ.",
    authRequired: false,
    hideBaseLayers: false,
    Panel: SummerPanel,
    Overlay: SummerOverlay,
};
export { SummerPanel, SummerOverlay };
export default SummerTool;