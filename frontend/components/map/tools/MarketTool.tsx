"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ShoppingCart, MapPin, Loader2, RefreshCw, AlertCircle, Search, Plus, MessageSquare, BookOpen, Package } from "lucide-react";
import { toast } from "@/src/lib/toast";
import { Marker, Popup, Tooltip, Circle, useMap } from "react-leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";
import { createPinIcon } from "../PinTheme";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { shareService, SharedItem } from "@/src/services/share.service";
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
function focusItem(lat: number, lng: number) {
    if (mapRef && Number.isFinite(lat) && Number.isFinite(lng)) {
        mapRef.flyTo([lat, lng], 16, { duration: 0.6 });
    }
}
interface MarketItem extends SharedItem {
    lat?: number;
    lng?: number;
    address?: string;
}
const CATEGORY_LABELS: Record<string, string> = {
    "": "Tất cả",
    book: "Sách",
    tool: "Dụng cụ",
    electronic: "Điện tử",
};
function itemCoords(item: MarketItem): [number, number] | null {
    const lat = Number(item?.lat);
    const lng = Number(item?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return [lat, lng];
    }
    return null;
}
function MarketPanel({ viewport, result, onResult, loading, setLoading, error, setError, active }: ToolPanelProps) {
    const [items, setItems] = useState<MarketItem[]>([]);
    const [category, setCategory] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [borrowingItem, setBorrowingItem] = useState<MarketItem | null>(null);
    const [message, setMessage] = useState("");
    const [requesting, setRequesting] = useState(false);
    const [showShareForm, setShowShareForm] = useState(false);
    const [shareForm, setShareForm] = useState({ name: "", description: "", category: "book" });
    const [sharing, setSharing] = useState(false);
    const fetchItems = useCallback(async (cat: string) => {
        try {
            setLoading(true);
            setError(null);
            const data: any = await shareService.getItems(cat || undefined);
            const list: MarketItem[] = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.data)
                        ? data.data
                        : [];
            setItems(list);
            onResult(list);
        }
        catch (err: any) {
            setError(err?.message || "Không thể tải danh sách tài liệu");
            toast.error("Không thể tải danh sách tài liệu");
        }
        finally {
            setLoading(false);
        }
    }, [setLoading, setError, onResult]);
    useEffect(() => {
        if (!active || result !== null)
            return;
        void fetchItems("");
    }, [active]);
    const filtered = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        if (!needle)
            return items;
        return items.filter((item) => [item.name, item.description, item.address]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle)));
    }, [items, searchTerm]);
    const handleCategory = (cat: string) => {
        setCategory(cat);
        void fetchItems(cat);
    };
    const openBorrow = (item: MarketItem) => {
        if (!authService.isLoggedIn()) {
            toast.error("Vui lòng đăng nhập để mượn");
            return;
        }
        setBorrowingItem(item);
        setMessage("");
    };
    const handleBorrow = async () => {
        if (!borrowingItem)
            return;
        if (!message.trim()) {
            toast.error("Vui lòng nhập lời nhắn");
            return;
        }
        try {
            setRequesting(true);
            const res = await shareService.requestItem(borrowingItem.id, message);
            toast.success(res.message || "Đã gửi yêu cầu mượn!");
            setBorrowingItem(null);
            setMessage("");
        }
        catch (err: any) {
            toast.error(err?.message || "Lỗi khi mượn");
        }
        finally {
            setRequesting(false);
        }
    };
    const handleShare = async () => {
        if (!authService.isLoggedIn()) {
            toast.error("Vui lòng đăng nhập để chia sẻ");
            return;
        }
        if (!shareForm.name.trim()) {
            toast.error("Vui lòng nhập tên tài liệu");
            return;
        }
        try {
            setSharing(true);
            const bb = viewport;
            const hasCoords = !!bb
                && Number.isFinite(bb.minLat) && Number.isFinite(bb.maxLat)
                && Number.isFinite(bb.minLng) && Number.isFinite(bb.maxLng)
                && Math.abs(bb.minLat) <= 90 && Math.abs(bb.minLng) <= 180;
            const centerLat = hasCoords ? (bb.minLat + bb.maxLat) / 2 : undefined;
            const centerLng = hasCoords ? (bb.minLng + bb.maxLng) / 2 : undefined;
            await shareService.createItem(shareForm.name, shareForm.description, shareForm.category, centerLat, centerLng);
            toast.success(hasCoords
                ? "Đã chia sẻ tài liệu thành công! Ghim sẽ hiện ở giữa vùng bản đồ đang xem."
                : "Đã chia sẻ tài liệu thành công! (Chưa có vị trí — tài liệu sẽ không hiện ghim trên bản đồ)");
            setShowShareForm(false);
            setShareForm({ name: "", description: "", category: "book" });
            void fetchItems(category);
        }
        catch (err: any) {
            toast.error(err?.message || "Lỗi khi chia sẻ");
        }
        finally {
            setSharing(false);
        }
    };
    if (!active)
        return null;
    return (<div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ShoppingCart className="w-4 h-4 text-primary"/> Chợ chia sẻ
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowShareForm(!showShareForm)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50" title="Đăng tài liệu">
            <Plus className="w-3 h-3"/>
          </button>
          <button onClick={() => fetchItems(category)} disabled={loading} className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50" title="Làm mới">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}/>
          </button>
        </div>
      </div>

      {showShareForm ? (<div className="card-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Đăng tài liệu mới</p>
            <button onClick={() => setShowShareForm(false)} className="rounded p-1 text-muted-foreground hover:bg-muted/50" title="Đóng">
              <AlertCircle className="h-3 w-3"/>
            </button>
          </div>
          <input type="text" placeholder="Tên tài liệu / học cụ" value={shareForm.name} onChange={(e) => setShareForm({ ...shareForm, name: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"/>
          <select value={shareForm.category} onChange={(e) => setShareForm({ ...shareForm, category: e.target.value })} className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary">
            <option value="book">Sách &amp; giáo trình</option>
            <option value="tool">Dụng cụ học tập</option>
            <option value="electronic">Thiết bị điện tử</option>
          </select>
          <textarea rows={2} placeholder="Tình trạng & mô tả" value={shareForm.description} onChange={(e) => setShareForm({ ...shareForm, description: e.target.value })} className="form-textarea mt-2 text-xs"/>
          <button onClick={handleShare} disabled={sharing} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {sharing ? <Loader2 className="h-3 w-3 animate-spin"/> : <Plus className="h-3 w-3"/>}
            Đăng tài liệu
          </button>
        </div>) : borrowingItem ? (<div className="card-surface p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{borrowingItem.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {CATEGORY_LABELS[borrowingItem.category] || borrowingItem.category}
                {borrowingItem.address ? ` · ${borrowingItem.address}` : ""}
              </p>
            </div>
            <button onClick={() => setBorrowingItem(null)} className="rounded p-1 text-muted-foreground hover:bg-muted/50" title="Hủy">
              <AlertCircle className="h-3 w-3"/>
            </button>
          </div>
          <textarea rows={3} placeholder="Lời nhắn gửi người chia sẻ" value={message} onChange={(e) => setMessage(e.target.value)} className="form-textarea text-xs"/>
          <button onClick={handleBorrow} disabled={requesting} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {requesting ? <Loader2 className="h-3 w-3 animate-spin"/> : <MessageSquare className="h-3 w-3"/>}
            Gửi yêu cầu mượn
          </button>
        </div>) : (<>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"/>
            <input type="text" placeholder="Tìm sách, học cụ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary"/>
          </div>

          <div className="flex flex-wrap gap-1">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (<button key={key} type="button" onClick={() => handleCategory(key)} className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${category === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
                {label}
              </button>))}
          </div>

          {loading && items.length === 0 ? (<div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin"/> Đang tải...
            </div>) : filtered.length === 0 ? (<p className="py-4 text-xs text-muted-foreground/60">Chưa có tài liệu nào trong chuyên mục này.</p>) : (<div className="max-h-72 space-y-1 overflow-y-auto scrollbar-hide">
              {filtered.map((item) => (<div key={item.id} className="rounded-lg border border-border p-2 text-xs transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => {
                        const c = itemCoords(item);
                        if (c)
                            focusItem(c[0], c[1]);
                    }} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <BookOpen className="h-3 w-3 shrink-0 text-primary"/>
                        <span className="line-clamp-2">{item.name}</span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <span className="rounded bg-muted/60 px-1 py-0.5">{CATEGORY_LABELS[item.category] || item.category}</span>
                        {item.address && (<span className="truncate">{item.address}</span>)}
                      </p>
                    </button>
                    <BookmarkButton targetType="shared_item" targetId={item.id} size="sm"/>
                  </div>
                  {item.description && (<p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground/70">{item.description}</p>)}
                  <button type="button" onClick={() => openBorrow(item)} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md bg-primary py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90">
                    <MessageSquare className="h-2.5 w-2.5"/>
                    Mượn tài liệu
                  </button>
                </div>))}
            </div>)}
        </>)}

      {error && (<div className="flex items-center gap-1.5 rounded-lg bg-muted/10 p-2 text-xs text-muted-foreground/60">
          <AlertCircle className="h-3 w-3"/>
          {error}
        </div>)}
    </div>);
}
function MarketOverlay({ result }: ToolOverlayProps) {
    const items: MarketItem[] = Array.isArray(result) ? result : [];
    return (<>
      <MapBridge />
      {items.map((item) => {
            const coords = itemCoords(item);
            if (!coords)
                return null;
            const [lat, lng] = coords;
            return (<React.Fragment key={item.id}>
            <Circle center={[lat, lng]} radius={150} pathOptions={{
                    color: "#8b5cf6",
                    fillColor: "#8b5cf6",
                    fillOpacity: 0.07,
                    weight: 1.5,
                    dashArray: "5 3",
                }}/>
            <Marker position={[lat, lng]} icon={createPinIcon("market")}>
              <Tooltip direction="top" offset={[0, -34]} opacity={1} className="market-tooltip">
                <div className="flex items-center gap-1.5 text-xs">
                  <Package className="h-3 w-3 text-primary"/>
                  <span className="font-bold">{item.name}</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="max-w-xs space-y-1">
                  <div className="text-sm font-medium">{item.name}</div>
                  <p className="text-xs text-muted-foreground/70">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </p>
                  {item.address && (<p className="flex items-center gap-1 text-xs text-muted-foreground/70">
                      <MapPin className="h-3 w-3"/> {item.address}
                    </p>)}
                  {item.description && <p className="line-clamp-3 text-xs text-muted-foreground/70">{item.description}</p>}
                  <div className="border-t border-border pt-1">
                    <BookmarkButton targetType="shared_item" targetId={item.id} size="sm" showLabel/>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>);
        })}
    </>);
}
const MarketTool = {
    id: "market",
    label: "Chợ chia sẻ",
    longLabel: "Chợ chia sẻ & trao đổi",
    icon: ShoppingCart,
    description: "Tài liệu, sách và học cụ cộng đồng đang được chia sẻ trên bản đồ.",
    longDescription: "Xem sách, học cụ được cộng đồng chia sẻ theo vị trí, gửi yêu cầu mượn hoặc đăng tài liệu mới ngay trong panel bản đồ.",
    authRequired: false,
    hideBaseLayers: false,
    Panel: MarketPanel,
    Overlay: MarketOverlay,
};
export { MarketPanel, MarketOverlay };
export default MarketTool;