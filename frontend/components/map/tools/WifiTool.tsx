/**
 * Wifi Tool — Wifi hotspot layer on the unified Map Hub.
 *
 * Previously a standalone page at `/wifi`; now the `wifi` tab on `/map`.
 * Fetches Wifi locations from `/api/wifi/locations` and renders markers
 * on the shared InteractiveMap.
 *
 * Panel: toggle layer, nearby search, quick stats, free/paid breakdown.
 * Overlay: signal range circles (enhanced rendering). The star-shaped pin
 * markers are owned by FeaturedPinsLayer and hidden when this tool is active;
 * the overlay here only renders signal-range circles + a subtle ring marker
 * so there is zero duplication.
 */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Wifi, MapPin, Navigation, Eye, EyeOff, RefreshCw, AlertCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";
import { Marker, Popup, Circle, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";
import { createPinIcon, type PinBadge } from "./PinTheme";

interface WifiLocation {
  id: string;
  name: string;
  ssid?: string;
  description?: string;
  address?: string;
  is_free?: boolean;
  is_verified?: boolean;
  speedLabel?: string;
  lat?: number;
  lng?: number;
  location?: { type: string; coordinates: [number, number] };
  coordinates?: [number, number];
}

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
 */
function deriveWifiMeta(loc: WifiLocation): { isFree: boolean; speedLabel: string } {
  const text = `${loc?.name || ""} ${loc?.description || ""}`.toLowerCase();
  const isFree = /free|miễn phí/i.test(text);
  let speedLabel = "Ổn định";
  if (/cáp quang|fiber|siêu tốc/i.test(text)) speedLabel = "Rất nhanh";
  else if (/tốc độ cao|high-speed/i.test(text)) speedLabel = "Nhanh";
  return { isFree, speedLabel };
}

function withWifiMeta(locs: WifiLocation[]): WifiLocation[] {
  return (Array.isArray(locs) ? locs : []).map((w) => {
    const meta = deriveWifiMeta(w);
    return { ...w, is_free: meta.isFree, speedLabel: meta.speedLabel };
  });
}

/** Resolve the badge for a wifi location. */
function wifiBadge(loc: WifiLocation): PinBadge | undefined {
  if (loc.is_verified) return { type: "verified" };
  if (loc.is_free) return { type: "new" };
  return undefined;
}

// ─── Color / radius helpers ──────────────────────────────────────────────────

const SPEED_COLOR: Record<string, string> = {
  "Rất nhanh": "#22c55e",  // green — fastest
  "Nhanh":     "#3b82f6",  // blue
  "Ổn định":   "#f59e0b",  // amber — default
};

const SPEED_RADIUS: Record<string, number> = {
  "Rất nhanh": 400,
  "Nhanh":     300,
  "Ổn định":   200,
};

const getSpeedColor = (label?: string): string => SPEED_COLOR[label || ""] || "#f59e0b";
const getSpeedRadius = (label?: string): number => SPEED_RADIUS[label || ""] || 200;
const getFreeColor = (isFree: boolean): string => isFree ? "#10b981" : "#f59e0b";

// ─── Panel ──────────────────────────────────────────────────────────────────

export function WifiPanel({
  viewport, result, onResult, loading, setLoading, error, setError,
  active, user,
}: ToolPanelProps) {
  const [wifiLocations, setWifiLocations] = useState<WifiLocation[]>([]);
  const [showLayer, setShowLayer] = useState(true);
  const [nearby, setNearby] = useState(false);

  useEffect(() => {
    if (!active) return;
    fetchWifiLocations();
  }, [active]);

  const fetchWifiLocations = useCallback(async () => {
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
  }, [setLoading, setError, onResult]);

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
        const locations = unwrapApiResponse<any>(data);
        const raw = Array.isArray(data?.data) ? data.data : Array.isArray(locations) ? locations : [];
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

  const freeCount = wifiLocations.filter((w) => w.is_free).length;
  const paidCount = wifiLocations.length - freeCount;
  const verifiedCount = wifiLocations.filter((w) => w.is_verified).length;
  const fastCount = wifiLocations.filter((w) => w.speedLabel === "Rất nhanh").length;

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

      {/* Action buttons */}
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

      {/* Category summary chips */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="px-1.5 py-0.5 rounded bg-green-100/30 text-green-600">
          Miễn phí: {freeCount}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-orange-100/30 text-orange-600">
          Trả tiền: {paidCount}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-blue-100/30 text-blue-600">
          Tốc độ cao: {fastCount}
        </span>
        {verifiedCount > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent">
            <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> Đã xác minh: {verifiedCount}
          </span>
        )}
      </div>

      {/* Speed legend */}
      <div className="flex gap-2 text-[10px] text-muted-foreground/60">
        <span>• Rất nhanh: <MapPin className="w-2 h-2 inline text-green-500" /> 400m</span>
        <span>• Nhanh: <MapPin className="w-2 h-2 inline text-blue-500" /> 300m</span>
        <span>• Ổn định: <MapPin className="w-2 h-2 inline text-amber-500" /> 200m</span>
      </div>

      {/* Location list */}
      {wifiLocations.length > 0 ? (
        <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide">
          {wifiLocations.map((w) => (
            <div key={w.id} className="text-xs p-2 rounded-lg border border-border hover:bg-muted/30">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {w.is_verified && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                {w.name || w.ssid}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  w.is_free ? "bg-green-100/30 text-green-600" : "bg-orange-100/30 text-orange-600"
                }`}>
                  {w.is_free ? "Miễn phí" : "Trả tiền"}
                </span>
                <span className="text-muted-foreground/60">• {w.speedLabel}</span>
              </div>
              {w.address && <p className="text-muted-foreground/60 mt-0.5">{w.address}</p>}
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

// ─── Overlay ─────────────────────────────────────────────────────────────────

function WifiOverlay({ result }: ToolOverlayProps) {
  const locations: WifiLocation[] = result || [];

  if (!locations.length) return null;

  /** Coords are already pre-resolved by withWifiMeta in the panel. */
  const getCoords = (loc: WifiLocation): [number, number] | null => {
    // Primary: pre-resolved lat/lng
    if (Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng))) {
      return [Number(loc.lat), Number(loc.lng)];
    }
    // Fallback: GeoJSON location (top-level coordinates [lng, lat])
    if (loc.location?.coordinates) {
      return [loc.location.coordinates[1], loc.location.coordinates[0]];
    }
    // Legacy: loc.lat/lng (already covered above)
    return null;
  };

  return (
    <>
      {locations.map((loc) => {
        const coords = getCoords(loc);
        if (!coords) return null;
        const [lat, lng] = coords;
        const speedColor = getSpeedColor(loc.speedLabel);
        const radius = getSpeedRadius(loc.speedLabel);
        const icon = createPinIcon("wifi", wifiBadge(loc));

        return (
          <React.Fragment key={loc.id || `${lat}-${lng}`}>
            {/* Signal range circle — the overlay's primary visual contribution.
                The star glyph marker is hidden here since FeaturedPinsLayer
                renders green/wifi pins; this overlay adds the signal halo. */}
            <Circle
              center={[lat, lng]}
              radius={radius}
              pathOptions={{
                color: speedColor,
                fillColor: speedColor,
                fillOpacity: 0.07,
                weight: 1.5,
                dashArray: "5 3",
              }}
            />
            {/* Subtle ring marker at the center so the hotspot is still
                clickable for the popup even though the star is rendered by
                the featured-pins layer (or shown here when no featured layer). */}
            <Marker position={[lat, lng]} icon={icon}>
              <Tooltip direction="top" offset={[0, -30]} opacity={1} className="wifi-tooltip">
                <div className="flex items-center gap-1.5 text-xs">
                  <Wifi className="w-3 h-3 text-amber-400" />
                  <span className="font-bold">{loc.name || loc.ssid}</span>
                  <span className="text-muted-foreground/70">• {loc.is_free ? "Miễn phí" : "Trả tiền"}</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="space-y-1 max-w-xs">
                  <div className="font-medium text-sm">{loc.name || loc.ssid}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      loc.is_free ? "bg-green-100/30 text-green-600" : "bg-orange-100/30 text-orange-600"
                    }`}>
                      {loc.is_free ? "Miễn phí" : "Trả tiền"}
                    </span>
                    <span className="text-xs text-muted-foreground/70">• {loc.speedLabel}</span>
                  </div>
                  {loc.address && <p className="text-xs text-muted-foreground/70">{loc.address}</p>}
                  {loc.is_verified && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="w-3 h-3" /> Đã xác minh
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
}

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

export { WifiPanel, WifiOverlay };
export default WifiTool;
