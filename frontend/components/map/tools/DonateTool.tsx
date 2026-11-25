"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Heart, MapPin, Loader2, RefreshCw, AlertCircle, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { Marker, Popup, Tooltip, Circle } from "react-leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";
import { createPinIcon } from "../PinTheme";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { donateService, DonationCampaign } from "@/src/services/donate.service";
import { authService } from "@/src/services/auth.service";
function parsePoint(point?: string): [number, number] | null {
    if (!point)
        return null;
    const wkt = point.match(/POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (wkt) {
        const lng = Number(wkt[1]);
        const lat = Number(wkt[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng))
            return [lat, lng];
    }
    return null;
}
const QUICK_AMOUNTS = [50000, 100000, 500000];
function formatVnd(value: number | string): string {
    const amount = Number(value);
    if (!Number.isFinite(amount))
        return "0₫";
    if (amount >= 1000000000)
        return `${(amount / 1000000000).toFixed(1)} tỷ`;
    if (amount >= 1000000)
        return `${(amount / 1000000).toFixed(1)} tr`;
    if (amount >= 1000)
        return `${Math.round(amount / 1000)}k`;
    return `${amount}₫`;
}
function DonatePanel({ result, onResult, loading, setLoading, error, setError, active, onFocusMap }: ToolPanelProps) {
    const [campaigns, setCampaigns] = useState<DonationCampaign[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [donatingTo, setDonatingTo] = useState<DonationCampaign | null>(null);
    const [amount, setAmount] = useState("");
    const [anonymous, setAnonymous] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const fetchCampaigns = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data: any = await donateService.getAllCampaigns();
            const list: DonationCampaign[] = Array.isArray(data)
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
            toast.error("Không thể tải danh sách chiến dịch quyên góp");
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
        return campaigns.filter((c) => `${c.title} ${c.address || ""}`.toLowerCase().includes(needle));
    }, [campaigns, searchTerm]);
    const handleDonate = async () => {
        if (!donatingTo)
            return;
        if (!authService.isLoggedIn()) {
            toast.error("Vui lòng đăng nhập để quyên góp");
            return;
        }
        const value = Number(amount.replace(/[^0-9]/g, ""));
        if (!value || value <= 0) {
            toast.error("Vui lòng nhập số tiền hợp lệ");
            return;
        }
        try {
            setSubmitting(true);
            const res = await donateService.processDonation(donatingTo.id, value, anonymous);
            toast.success(res.message || "Quyên góp thành công! Cảm ơn bạn.");
            setDonatingTo(null);
            setAmount("");
            void fetchCampaigns();
        }
        catch (err: any) {
            toast.error(err?.message || "Có lỗi xảy ra trong quá trình quyên góp");
        }
        finally {
            setSubmitting(false);
        }
    };
    if (!active)
        return null;
    return (<div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Heart className="w-4 h-4 text-destructive"/> Quyên góp
        </h3>
        <button onClick={fetchCampaigns} disabled={loading} className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50" title="Làm mới">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}/>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"/>
        <input type="text" placeholder="Tìm chiến dịch..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary"/>
      </div>

      {donatingTo ? (<div className="card-surface p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{donatingTo.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatVnd(donatingTo.current_amount)} / {formatVnd(donatingTo.target_amount)}
              </p>
            </div>
            <button onClick={() => setDonatingTo(null)} className="rounded p-1 text-muted-foreground hover:bg-muted/50" title="Hủy">
              <X className="h-3 w-3"/>
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_AMOUNTS.map((v) => (<button key={v} type="button" onClick={() => setAmount(String(v))} className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${amount === String(v) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/40"}`}>
                {formatVnd(v)}
              </button>))}
          </div>
          <input type="number" min={1000} placeholder="Số tiền (VND)" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"/>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)}/>
            Quyên góp ẩn danh
          </label>
          <button onClick={handleDonate} disabled={submitting} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {submitting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Heart className="h-3 w-3"/>}
            Xác nhận quyên góp
          </button>
          <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-primary"/> Giao dịch được ghi nhận minh bạch
          </p>
        </div>) : (<>
          {loading && campaigns.length === 0 ? (<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin"/> Đang tải...
            </div>) : filtered.length === 0 ? (<p className="py-4 text-xs text-muted-foreground/60">Chưa có chiến dịch nào.</p>) : (<div className="max-h-72 space-y-1 overflow-y-auto scrollbar-hide">
              {filtered.map((camp) => {
                const progress = camp.target_amount > 0 ? Math.min(100, Math.round((camp.current_amount / camp.target_amount) * 100)) : 0;
                return (<div key={camp.id} className="rounded-lg border border-border p-2 text-xs transition-colors hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => {
                            const c = parsePoint(camp.location_point);
                            if (c && onFocusMap)
                                onFocusMap(c[0], c[1], 14);
                        }} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Heart className="h-3 w-3 shrink-0 text-destructive"/>
                          <span className="line-clamp-2">{camp.title}</span>
                        </div>
                        {camp.address && (<p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                            <MapPin className="h-2.5 w-2.5 shrink-0 text-primary"/>
                            <span className="truncate">{camp.address}</span>
                          </p>)}
                      </button>
                      <BookmarkButton targetType="donate_campaign" targetId={camp.id} size="sm"/>
                    </div>
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-primary">{progress}% hoàn thành</span>
                        <span className="text-muted-foreground/70">
                          {formatVnd(camp.current_amount)} / {formatVnd(camp.target_amount)}
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }}/>
                      </div>
                    </div>
                    <button type="button" onClick={() => {
                        setDonatingTo(camp);
                        setAmount("");
                        setAnonymous(false);
                    }} disabled={camp.status !== "active"} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md bg-primary py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                      <Heart className="h-2.5 w-2.5"/>
                      {camp.status === "active" ? "Ủng hộ ngay" : "Đã kết thúc"}
                    </button>
                  </div>);
            })}
            </div>)}
        </>)}

      {error && (<div className="flex items-center gap-1.5 rounded-lg bg-muted/10 p-2 text-xs text-muted-foreground/60">
          <AlertCircle className="h-3 w-3"/>
          {error}
        </div>)}
    </div>);
}
function DonateOverlay({ result }: ToolOverlayProps) {
    const campaigns: DonationCampaign[] = Array.isArray(result) ? result : [];
    return (<>
      {campaigns.map((camp) => {
            const coords = parsePoint(camp.location_point);
            if (!coords)
                return null;
            const [lat, lng] = coords;
            const progress = camp.target_amount > 0 ? Math.min(100, Math.round((camp.current_amount / camp.target_amount) * 100)) : 0;
            return (<React.Fragment key={camp.id}>
            <Circle center={[lat, lng]} radius={500} pathOptions={{
                    color: "#ef4444",
                    fillColor: "#ef4444",
                    fillOpacity: 0.06,
                    weight: 1.5,
                    dashArray: "5 3",
                }}/>
            <Marker position={[lat, lng]} icon={createPinIcon("donate", { type: "progress", value: progress })}>
              <Tooltip direction="top" offset={[0, -34]} opacity={1} className="donate-tooltip">
                <div className="flex items-center gap-1.5 text-xs">
                  <Heart className="h-3 w-3 text-destructive"/>
                  <span className="font-bold">{camp.title}</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="max-w-xs space-y-1">
                  <div className="text-sm font-medium">{camp.title}</div>
                  {camp.address && (<p className="flex items-center gap-1 text-xs text-muted-foreground/70">
                      <MapPin className="h-3 w-3"/> {camp.address}
                    </p>)}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-primary">{progress}%</span>
                    <span className="text-muted-foreground/70">
                      {formatVnd(camp.current_amount)} / {formatVnd(camp.target_amount)}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }}/>
                  </div>
                  <div className="border-t border-border pt-1">
                    <BookmarkButton targetType="donate_campaign" targetId={camp.id} size="sm" showLabel/>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>);
        })}
    </>);
}
const DonateTool = {
    id: "donate",
    label: "Quyên góp",
    longLabel: "Chiến dịch quyên góp",
    icon: Heart,
    description: "Chiến dịch quyên góp và ủng hộ ngay trên bản đồ.",
    longDescription: "Xem tiến độ các chiến dịch quyên góp theo địa điểm và ủng hộ trực tiếp trong panel bản đồ.",
    authRequired: false,
    hideBaseLayers: false,
    Panel: DonatePanel,
    Overlay: DonateOverlay,
};
export { DonatePanel, DonateOverlay };
export default DonateTool;