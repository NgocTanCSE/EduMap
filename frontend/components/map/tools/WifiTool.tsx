/**
 * Wifi Tool — Wifi hotspot layer on the unified Map Hub.
 *
 * Previously a standalone page at `/wifi`; now the `wifi` tab on `/map`.
 * Fetches Wifi locations from `/api/wifi/locations` and renders markers on
 * the shared InteractiveMap.
 *
 * Panel: toggle layer, nearby search, quick stats.
 * Overlay: Wifi markers (color-coded: free=green, paid=orange), signal
 * strength circles, and click-to-detail popups.
 */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Wifi, MapPin, Navigation, Eye, EyeOff, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";
import { Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";

/**
 * Derive display-friendly wifi metadata from the real row data.
 *
 * The `locations` table has NO dedicated `is_free` / `speed_mbps` columns, so
 * the Wifi panel previously rendered "Trả tiền • Mbps" for *every* entry —
 * including genuine "Free Wifi …" hotspots whose `is_free`/`speed_mbps`
 * fields don't exist. That made the list look uniform and meaningless.
 *
 * The dedicated wifi_hotspot rows (category_id = 6) encode this info in their
 * name/description seed text ("Free Wifi … miễn phí", "cáp quang siêu tốc",
 * "tốc độ cao", "ổn định"), so we derive an honest free/paid flag and a
 * qualitative speed tier from those strings instead of inventing numbers.
 * See backend WifiService (filter now `category_id = 6`, not `description LIKE '%wifi%'`).
 */
function deriveWifiMeta(loc: any): { isFree: boolean; speedLabel: string } {
  const text = `${loc?.name || ""} ${loc?.description || ""}`.toLowerCase();
  const isFree = /free|miễn phí/i.test(text);
  let speedLabel = "Ổn định"; // default qualitative tier when description is silent
  if (/cáp quang|fiber|siêu tốc/i.test(text)) speedLabel = "Rất nhanh";
  else if (/tốc độ cao|high-speed/i.test(text)) speedLabel = "Nhanh";
  return { isFree, speedLabel };
}

function withWifiMeta(locs: any[]): any[] {
  return (Array.isArray(locs) ? locs : []).map((w) => {
    const meta = deriveWifiMeta(w);
    return { ...w, is_free: meta.isFree, speedLabel: meta.speedLabel };
  });
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const _wifiIcon = typeof window !== "undefined" ? L.icon({
  iconUrl: "data:image/svg+xml;base64," + btoa("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981'><path d='M12 1C7.03 1 3 5.03 3 10c0 4.97 4 9 9 9s9-4.03 9-9S16.97 1 12 1zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z'/><path d='M12 5c-2.76 0-5 2.24-5 5h2c0-1.66 1.34-3 3-3s3 1.34 3 3c0 1.03-.38 1.97-1.03 2.67l1.41 1.42C17.12 10.35 19 8.32 19 6c0-1.1-.19-2.16-.53-3.14L18.17 4.07C17.53 5.41 16.42 6.41 15.07 6.93.67 6.42 0 7.16 0 8c0 3.31 2.69 6 6 6h1v-2H6c-2.76 0-5-2.24-5-5S3.24 2 6 2c1.66 0 3 1.34 3 3v1h2V5c0-2.76-2.24-5-5-5S1 2.24 1 5v1h2v1H3c-.55 0-1 .45-1 1v1h2v2H2c-.55 0-1 .45-1 1v1.17C1 10.61 1 12.31 2 14c1.1 2.07 3.13 3.57 5.5 3.9V18h5v-2.1c2.37-.33 4.5-1.83 5.5-4.15.36-.72.6-1.51.6-2.35 0-1.66-.81-3.11-2.05-4.03-.84.53-1.83.83-2.95.68-.02.08-.05.16-.05.24v1H9V8c0-.55-.45-1-1-1s-1 .45-1 1v1.17H6.05c.93-.33 1.79-.93 2.47-1.71L9 7.57V6.2c-.3-.27-.52-.65-.66-1.1-.51.43-.9 1-1.19 1.62-.14-.07-.29-.12-.45-.12-.36-.11-.74-.2-1.11-.2-.17 0-.33.01-.5.03C4.78 7.16 4 6.43 4 5.5 4 4.67 4.67 4 5.54 4c.63 0 1.19.39 1.42 1 .39-2 .85-3.91 1.42-5.78C6.95 1.54 6 2.67 6 4c0 2.21 1.79 4 4 4l1 4 1-4c2.21 0 4-1.79 4-4 0-1.46-1.12-2.68-2.56-2.95.57 1.87 1.03 3.78 1.27 5.74.44-.15.87-.29 1.31-.29.55 0 1.08.12 1.56.33Z' fill='%23ffffff'/></svg>"),
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -28],
}) : L.divIcon({
  html: "<div style='width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#10b981;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3)'><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff' width='14' height='14'><path d='M12 1C7.03 1 3 5.03 3 10c0 4.97 4 9 9 9s9-4.03 9-9S16.97 1 12 1zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z'/><path d='M12 5c-2.76 0-5 2.24-5 5h2c0-1.66 1.34-3 3-3s3 1.34 3 3c0 1.03-.38 1.97-1.03 2.67l1.41 1.42C17.12 10.35 19 8.32 19 6c0-1.1-.19-2.16-.53-3.14L18.17 4.07C17.53 5.41 16.42 6.41 15.07 6.93.67 6.42 0 7.16 0 8c0 3.31 2.69 6 6 6h1v-2H6c-2.76 0-5-2.24-5-5S3.24 2 6 2c1.66 0 3 1.34 3 3v1h2V5c0-2.76-2.24-5-5-5S1 2.24 1 5v1h2v1H3c-.55 0-1 .45-1 1v1h2v2H2c-.55 0-1 .45-1 1v1.17C1 10.61 1 12.31 2 14c1.1 2.07 3.13 3.57 5.5 3.9V18h5v-2.1c2.37-.33 4.5-1.83 5.5-4.15.36-.72.6-1.51.6-2.35 0-1.66-.81-3.11-2.05-4.03-.84.53-1.83.83-2.95.68-.02.08-.05.16-.05.24v1H9V8c0-.55-.45-1-1-1s-1 .45-1 1v1.17H6.05c.93-.33 1.79-.93 2.47-1.71L9 7.57V6.2c-.3-.27-.52-.65-.66-1.1-.51.43-.9 1-1.19 1.62-.14-.07-.29-.12-.45-.12-.36-.11-.74-.2-1.11-.2-.17 0-.33.01-.5.03C4.78 7.16 4 6.43 4 5.5 4 4.67 4.67 4 5.54 4c.63 0 1.19.39 1.42 1 .39-2 .85-3.91 1.42-5.78C6.95 1.54 6 2.67 6 4c0 2.21 1.79 4 4 4l1 4 1-4c2.21 0 4-1.79 4-4 0-1.46-1.12-2.68-2.56-2.95.57 1.87 1.03 3.78 1.27 5.74.44-.15.87-.29 1.31-.29.55 0 1.08.12 1.56.33Z' fill='%23ffffff'/></svg></div>",
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -28],
});

const WifiTool = {
  id: "wifi",
  label: "Wifi",
  longLabel: "Trạm Wifi",
  icon: Wifi,
  description: "Hiển thị trạm Wifi miễn phí và trả tiền trên bản đồ.",
  longDescription: "Hiển thị trạm Wifi trên bản đồ với phân màu theo tốc độ và loại (miễn phí/trả tiền).",
  authRequired: false,
  hideBaseLayers: false,
  Panel: WifiPanel,
  Overlay: WifiOverlay,
};

function WifiPanel({
  viewport, result, onResult, loading, setLoading, error, setError,
  active, user,
}: any) {
  const [wifiLocations, setWifiLocations] = useState<any[]>([]);
  const [showLayer, setShowLayer] = useState(true);
  const [nearby, setNearby] = useState(false);

  useEffect(() => {
    if (!active) return;
    fetchWifiLocations();
  }, [active]);

  const fetchWifiLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithRetry("/api/wifi/locations");
      if (!response.ok) throw new Error("Không thể tải danh sách Wifi");
      const data = await response.json();
      const locations = unwrapApiResponse<any>(data);
      const raw = Array.isArray(data?.data) ? data.data : Array.isArray(locations) ? locations : [];
      const locs = withWifiMeta(raw);
      setWifiLocations(locs);
      onResult(locs);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tải Wifi");
      toast.error("Không thể tải danh sách Wifi");
    } finally {
      setLoading(false);
    }
  };

  const getNearbyWifi = async () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        setNearby(true);
        const response = await fetchWithRetry(`/api/wifi/locations/nearby?lat=${latitude}&lng=${longitude}`);
        const data = await response.json();
        // Same shape-tolerant unwrap as fetchWifiLocations(): the BFF returns a
        // raw JSON array, so reading only `data.data` would always yield [].
        const locations2 = unwrapApiResponse<any>(data);
        const raw = Array.isArray(data?.data) ? data.data : Array.isArray(locations2) ? locations2 : [];
        const locs = withWifiMeta(raw);
        setWifiLocations(locs);
        onResult(locs);
      } catch (err: any) {
        toast.error("Không thể tìm Wifi gần đây.");
      } finally {
        setNearby(false);
      }
    });
  };

  if (!active) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Wifi className="w-4 h-4 text-primary" /> Trạm Wifi
        </h3>
        <button
          onClick={() => setShowLayer(!showLayer)}
          className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground/60"
          title={showLayer ? "Ẩn lớp Wifi" : "Hiện lớp Wifi"}
        >
          {showLayer ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={fetchWifiLocations}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
          Tải lại
        </button>
        <button
          onClick={getNearbyWifi}
          disabled={nearby}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted/30"
        >
          {nearby ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
          Gần đây
        </button>
      </div>

      <div className="flex gap-2 text-[10px]">
        <span className="px-1.5 py-0.5 rounded bg-green-100/30 text-green-600">Miễn phí</span>
        <span className="px-1.5 py-0.5 rounded bg-orange-100/30 text-orange-600">Trả tiền</span>
      </div>

      {wifiLocations.length > 0 ? (
        <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide">
          {wifiLocations.map((w: any) => (
            <div key={w.id} className="text-xs p-2 rounded-lg border border-border hover:bg-muted/30">
              <div className="font-medium text-foreground">{w.name || w.ssid}</div>
              <div className="text-muted-foreground/60 mt-0.5">
                {w.is_free ? "Miễn phí" : "Trả tiền"} • {w.speedLabel}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && <p className="text-xs text-muted-foreground/60">Chưa có dữ liệu Wifi.</p>
      )}

      {error && (
        <div className="flex items-center gap-1.5 p-2 text-xs text-muted-foreground/60 bg-muted/10 rounded-lg">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}

function WifiOverlay({ result }: { result: any[]; loading: boolean; points: any[]; viewport: any }) {
  const map = useMap();
  const locations = result || [];

  if (!locations.length) return null;

  const getCoords = (loc: any): [number, number] | null => {
    // Location entity stores GeoJSON at the TOP-LEVEL `coordinates` field:
    //   coordinates: { type: 'Point', coordinates: [lng, lat] }
    // (TypeORM returns the parsed object, not a string, for SQLite `json` cols.)
    const geo = loc?.coordinates;
    if (geo?.coordinates && Array.isArray(geo.coordinates)) {
      return [geo.coordinates[1], geo.coordinates[0]];
    }
    // Legacy/alternate shape: nested location.coordinates
    if (loc?.location?.coordinates) {
      return [loc.location.coordinates[1], loc.location.coordinates[0]];
    }
    if (loc?.lat && loc?.lng) return [Number(loc.lat), Number(loc.lng)];
    return null;
  };

  const getColor = (isFree: boolean) => isFree ? "#10b981" : "#f59e0b";
  // No real numeric speed exists in the store, so scale the circle radius by
  // the qualitative tier derived in deriveWifiMeta().
  const getRadius = (label?: string) => {
    if (label === "Rất nhanh") return 300;
    if (label === "Nhanh") return 220;
    return 140;
  };

  return (
    <>
      {locations.map((loc: any) => {
        const coords = getCoords(loc);
        if (!coords) return null;
        const [lat, lng] = coords;
        return (
          <React.Fragment key={loc.id || `${lat}-${lng}`}>
            <Marker position={[lat, lng]} icon={_wifiIcon}>
              <Popup>
                <div className="space-y-1">
                  <div className="font-medium text-sm">{loc.name || loc.ssid}</div>
                  <div className={`text-xs px-1.5 py-0.5 rounded ${loc.is_free ? "bg-green-100/30 text-green-600" : "bg-orange-100/30 text-orange-600"}`}>
                    {loc.is_free ? "Miễn phí" : "Trả tiền"} • {loc.speedLabel}
                  </div>
                  {loc.address && <p className="text-xs text-muted-foreground/70">{loc.address}</p>}
                  {loc.is_verified && <span className="text-xs text-green-600">✓ Đã xác minh</span>}
                </div>
              </Popup>
            </Marker>
            <Circle
              center={[lat, lng]}
              radius={getRadius(loc.speedLabel)}
              pathOptions={{ color: getColor(loc.is_free), fillColor: getColor(loc.is_free), fillOpacity: 0.1, weight: 1 }}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}

WifiTool.Panel = WifiPanel;
WifiTool.Overlay = WifiOverlay;

export { WifiPanel, WifiOverlay };
export default WifiTool;
