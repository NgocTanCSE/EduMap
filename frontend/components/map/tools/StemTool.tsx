"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Atom, MapPin, MonitorSmartphone, Calendar, Loader2, RefreshCw, AlertCircle, Search, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { Marker, Popup, Tooltip, Circle, useMap } from "react-leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";
import { createPinIcon } from "../PinTheme";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { stemService, StemLab } from "@/src/services/stem.service";
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
function focusLab(lat: number, lng: number) {
    if (mapRef && Number.isFinite(lat) && Number.isFinite(lng)) {
        mapRef.flyTo([lat, lng], 16, { duration: 0.6 });
    }
}
function labAddress(lab: StemLab): string {
    const raw: any = lab;
    return raw?.address || raw?.locationPointText || "Chưa cập nhật địa chỉ";
}
function labCoords(lab: StemLab): [number, number] | null {
    const raw: any = lab;
    const wkt: string | undefined = raw?.locationPoint || (typeof raw?.location === "string" ? raw.location : undefined);
    if (wkt) {
        const matched = wkt.match(/POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
        if (matched) {
            const lng = Number(matched[1]);
            const lat = Number(matched[2]);
            if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                return [lat, lng];
            }
        }
    }
    const loc: any = raw?.location;
    const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (loc && typeof loc === "object") {
        if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
            const lng = Number(loc.coordinates[0]);
            const lat = Number(loc.coordinates[1]);
            return valid(lat, lng) ? [lat, lng] : null;
        }
        const lat = Number(loc.lat ?? loc.latitude);
        const lng = Number(loc.lng ?? loc.longitude);
        if (valid(lat, lng))
            return [lat, lng];
    }
    if (typeof loc === "string") {
        try {
            return labCoords({ ...lab, location: JSON.parse(loc) });
        }
        catch {
            return null;
        }
    }
    return null;
}
function StemPanel({ result, onResult, loading, setLoading, error, setError, active }: ToolPanelProps) {
    const [labs, setLabs] = useState<StemLab[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [bookingLab, setBookingLab] = useState<StemLab | null>(null);
    const [equipment, setEquipment] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [duration, setDuration] = useState("2");
    const [booking, setBooking] = useState(false);
    const fetchLabs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data: any = await stemService.getLabs();
            const list: StemLab[] = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.data)
                        ? data.data
                        : [];
            setLabs(list);
            onResult(list);
        }
        catch (err: any) {
            setError(err?.message || "Không thể tải danh sách STEM Lab");
            toast.error("Không thể tải danh sách STEM Lab");
        }
        finally {
            setLoading(false);
        }
    }, [setLoading, setError, onResult]);
    useEffect(() => {
        if (!active || result !== null)
            return;
        void fetchLabs();
    }, [active]);
    const filtered = useMemo(() => labs.filter((lab) => (lab.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lab.address || "").toLowerCase().includes(searchTerm.toLowerCase())), [labs, searchTerm]);
    const openBooking = (lab: StemLab, eq: string) => {
        if (!authService.isLoggedIn()) {
            toast.error("Vui lòng đăng nhập để đặt thiết bị");
            return;
        }
        setBookingLab(lab);
        setEquipment(eq);
        setDate("");
        setTime("");
        setDuration("2");
    };
    const handleBook = async () => {
        if (!bookingLab || !equipment)
            return;
        if (!date || !time) {
            toast.error("Vui lòng chọn ngày và giờ");
            return;
        }
        const start = new Date(`${date}T${time}:00`);
        const end = new Date(start.getTime() + Number(duration) * 60 * 60 * 1000);
        if (start < new Date()) {
            toast.error("Thời gian đặt phải trong tương lai");
            return;
        }
        try {
            setBooking(true);
            const res = await stemService.bookEquipment(bookingLab.id, equipment, start.toISOString(), end.toISOString());
            toast.success(`Đặt thành công! Mã: ${res.booking_id}`);
            setBookingLab(null);
        }
        catch (err: any) {
            toast.error(err?.message || "Đặt thiết bị thất bại");
        }
        finally {
            setBooking(false);
        }
    };
    if (!active)
        return null;
    return (<div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Atom className="w-4 h-4 text-destructive"/> Phòng Lab STEM
        </h3>
        <button onClick={fetchLabs} disabled={loading} className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50" title="Làm mới">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}/>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"/>
        <input type="text" placeholder="Tìm phòng lab, địa chỉ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary"/>
      </div>

      {bookingLab ? (<div className="card-surface p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{bookingLab.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <MonitorSmartphone className="h-3 w-3"/> {equipment}
              </p>
            </div>
            <button onClick={() => setBookingLab(null)} className="rounded p-1 text-muted-foreground hover:bg-muted/50" title="Hủy">
              <AlertCircle className="h-3 w-3"/>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Ngày</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"/>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Giờ nhận</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"/>
            </div>
          </div>
          <div className="mt-2">
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Thời gian sử dụng</label>
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary">
              <option value="1">1 giờ</option>
              <option value="2">2 giờ</option>
              <option value="4">4 giờ</option>
            </select>
          </div>
          <button onClick={handleBook} disabled={booking} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {booking ? <Loader2 className="h-3 w-3 animate-spin"/> : <Calendar className="h-3 w-3"/>}
            Xác nhận đặt lịch
          </button>
          <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-primary"/> Xác thực bằng AI chống trùng lịch
          </p>
        </div>) : (<>
          {loading && labs.length === 0 ? (<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin"/> Đang tải...
            </div>) : filtered.length === 0 ? (<p className="py-4 text-xs text-muted-foreground/60">Không tìm thấy phòng Lab STEM nào phù hợp.</p>) : (<div className="max-h-72 space-y-1 overflow-y-auto scrollbar-hide">
              {filtered.map((lab) => (<div key={lab.id} className="rounded-lg border border-border p-2 text-xs transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => {
                        const c = labCoords(lab);
                        if (c)
                            focusLab(c[0], c[1]);
                    }} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-accent"/>
                        <span className="truncate">{lab.name}</span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <MapPin className="h-2.5 w-2.5 shrink-0 text-primary"/>
                        <span className="truncate">{labAddress(lab)}</span>
                      </p>
                    </button>
                    <BookmarkButton targetType="stem_lab" targetId={lab.id} size="sm"/>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(lab.equipment?.length ? lab.equipment.slice(0, 3) : ["Thiết bị thí nghiệm"]).map((eq) => (<button key={eq} type="button" onClick={() => openBooking(lab, eq)} className="inline-flex max-w-full items-center gap-1 truncate rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-primary hover:text-primary-foreground" title={`Đặt ${eq}`}>
                        <MonitorSmartphone className="h-2.5 w-2.5 shrink-0"/>
                        <span className="truncate">{eq}</span>
                      </button>))}
                  </div>
                </div>))}
            </div>)}
        </>)}

      {error && (<div className="flex items-center gap-1.5 rounded-lg bg-muted/10 p-2 text-xs text-muted-foreground/60">
          <AlertCircle className="h-3 w-3"/>
          {error}
        </div>)}
    </div>);
}
function StemOverlay({ result }: ToolOverlayProps) {
    const labs: StemLab[] = Array.isArray(result) ? result : [];
    return (<>
      <MapBridge />
      {labs.map((lab) => {
            const coords = labCoords(lab);
            if (!coords)
                return null;
            const [lat, lng] = coords;
            return (<React.Fragment key={lab.id}>
            <Circle center={[lat, lng]} radius={200} pathOptions={{
                    color: "#f43f5e",
                    fillColor: "#f43f5e",
                    fillOpacity: 0.07,
                    weight: 1.5,
                    dashArray: "5 3",
                }}/>
            <Marker position={[lat, lng]} icon={createPinIcon("stem_poi")}>
              <Tooltip direction="top" offset={[0, -30]} opacity={1} className="stem-tooltip">
                <div className="flex items-center gap-1.5 text-xs">
                  <Atom className="h-3 w-3 text-destructive"/>
                  <span className="font-bold">{lab.name}</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="max-w-xs space-y-1">
                  <div className="text-sm font-medium">{lab.name}</div>
                  {labAddress(lab) && (<p className="flex items-center gap-1 text-xs text-muted-foreground/70">
                      <MapPin className="h-3 w-3"/> {labAddress(lab)}
                    </p>)}
                  {lab.description && <p className="line-clamp-3 text-xs text-muted-foreground/70">{lab.description}</p>}
                  {lab.equipment?.length > 0 && (<div className="flex flex-wrap gap-1 pt-1">
                      {lab.equipment.slice(0, 4).map((eq) => (<span key={eq} className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px]">
                          {eq}
                        </span>))}
                    </div>)}
                  <div className="border-t border-border pt-1">
                    <BookmarkButton targetType="stem_lab" targetId={lab.id} size="sm" showLabel/>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>);
        })}
    </>);
}
const StemTool = {
    id: "stem",
    label: "STEM Lab",
    longLabel: "Phòng Lab STEM",
    icon: Atom,
    description: "Tìm phòng lab STEM và đặt thiết bị ngay trên bản đồ.",
    longDescription: "Hiển thị phòng lab STEM đối tác, danh sách thiết bị và đặt lịch sử dụng ngay trong panel bản đồ.",
    authRequired: false,
    hideBaseLayers: false,
    Panel: StemPanel,
    Overlay: StemOverlay,
};
export { StemPanel, StemOverlay };
export default StemTool;