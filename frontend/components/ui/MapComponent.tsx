"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, GeoJSON } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShieldCheck, MapPin, Flame, Search, X, ArrowRightLeft, RotateCcw, AlertTriangle, Clock, MapPin as MapPinIcon, Navigation, Wifi, ParkingCircle, Bath, Accessibility, BookOpen, Atom, Leaf, Coffee, GraduationCap, Globe, ShoppingCart, Store, Save, History, Trash2, Star, Heart, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import HeatmapLayer from '@/components/map/HeatmapLayer';
import { RoutePolyline } from '@/components/map/RoutePolyline';
import RoutingPanel from '@/components/map/RoutingPanel';

// EduMap POI markers are themeable CSS divIcons — no external PNG/CDN.
// Each category maps to a Tailwind color token + a Lucide glyph, rendered to
// static markup once and cached per category. The pin fill uses `currentColor` so
// it follows the page dark/light theme; the category glyph is white-on-pin.

const CATEGORY_COLOR: Record<string, string> = {
  university: 'text-accent', school: 'text-accent',
  lab: 'text-destructive', stem: 'text-destructive',
  bookstore: 'text-destructive',
  green: 'text-green-600', park: 'text-green-600',
  cafe: 'text-orange-500',
  wifi: 'text-amber-400', convenience: 'text-amber-400',
  library: 'text-primary', restaurant: 'text-primary', market: 'text-primary',
};
const CATEGORY_ICON: Record<string, LucideIcon> = {
  university: GraduationCap, school: GraduationCap,
  library: BookOpen, bookstore: BookOpen,
  lab: Atom, stem: Atom, green: Leaf, park: Leaf, wifi: Wifi, cafe: Coffee,
  restaurant: Globe, market: ShoppingCart, convenience: Store,
};
/** A featured "ghim" pin that links to a feature page. */
export interface FeaturedPin {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description?: string;
  address?: string;
  featureLink: string;
}

const FEATURED_ICON_COLOR: Record<string, string> = {
  stem: 'text-destructive',
  green: 'text-green-600',
  summer: 'text-orange-500',
  wifi: 'text-amber-400',
  market: 'text-primary',
  donate: 'text-red-500',
};
const FEATURED_ICON: Record<string, LucideIcon> = {
  stem: Atom,
  green: Leaf,
  summer: GraduationCap,
  wifi: Wifi,
  market: ShoppingCart,
  donate: Heart,
};

// Tear-drop pin glyph; fill="currentColor" inherits the category color.
const PIN_GLYPH = `<svg viewBox="0 0 24 24" class="absolute inset-0 w-6 h-6"><path fill="currentColor" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;

const renderIconToHtml = (Component: any, className: string = 'w-3 h-3'): string => {
  if (!Component) return '';
  const Resolved = (Component && Component.default) ? Component.default : Component;
  try {
    return renderToStaticMarkup(React.createElement(Resolved, { className }));
  } catch (e) {
    return '';
  }
};

const _divIconCache = new Map<string, ReturnType<typeof L.divIcon>>();
const getIconForCategory = (categoryName: string) => {
  const cat = (categoryName || '').toLowerCase();
  const key = cat || '_default';
  const cached = _divIconCache.get(key);
  if (cached) return cached;
  const RawIcon = CATEGORY_ICON[cat] || MapPinIcon;
  const color = CATEGORY_COLOR[cat] || 'text-muted-foreground';
  const iconSvg = renderIconToHtml(RawIcon, 'w-3 h-3');
  const html = `<div class="${color} relative flex items-center justify-center" style="width:28px;height:28px">${PIN_GLYPH}<span class="relative text-white flex items-center justify-center w-3 h-3">${iconSvg}</span></div>`;
  const icon = L.divIcon({
    className: 'edumap-poi-marker shadow',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 29],
    popupAnchor: [0, -36],
  });
  _divIconCache.set(key, icon);
  return icon;
}

/** Star-shaped featured-pin icon (distinct from regular tear-drop POI pins). */
const _featuredIconCache = new Map<string, ReturnType<typeof L.divIcon>>();
const getFeaturedIconForCategory = (categoryName: string) => {
  const cat = (categoryName || '').toLowerCase();
  const key = `featured-${cat || '_default'}`;
  const cached = _featuredIconCache.get(key);
  if (cached) return cached;

  const RawIcon = FEATURED_ICON[cat] || Star;
  const color = FEATURED_ICON_COLOR[cat] || 'text-accent';
  const iconSvg = renderIconToHtml(RawIcon, 'w-3 h-3');
  // Star glyph (filled, gold-ish outline) with the category icon centered.
  const starSvg = '<svg viewBox="0 0 24 24" class="absolute inset-0 w-6 h-6"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.94L12 17.77l-6.18 3.31 1.18-6.94-5-4.97L8.91 8.26z"/></svg>';
  const html = `<div class="${color} relative flex items-center justify-center" style="width:28px;height:28px">${starSvg}<span class="relative text-white flex items-center justify-center w-3 h-3">${iconSvg}</span></div>`;
  const icon = L.divIcon({
    className: 'edumap-featured-marker shadow-lg',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 29],
    popupAnchor: [0, -36],
  });
  _featuredIconCache.set(key, icon);
  return icon;
};;

// Mini-icons used inside the popup to label a POI's nearby facilities.
const facilityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  university: GraduationCap,
  school: GraduationCap,
  library: BookOpen,
  bookstore: BookOpen,
  lab: Atom,
  wifi: Wifi,
  green: Leaf,
  park: Leaf,
  cafe: Coffee,
  restaurant: Coffee,
  market: ShoppingCart,
  convenience: Store,
};
const facilityIconFor = (category?: string) => facilityIcons[category?.toLowerCase() ?? ''] ?? MapPinIcon;

// Icons for a POI's OWN amenities (wifi, parking, toilets, wheelchair, opening
// hours) — surfaced inside the POI's pin popup, resolved from elToLocation tags.
const amenityIcons: Record<string, LucideIcon> = {
  wifi: Wifi,
  parking: ParkingCircle,
  toilets: Bath,
  wheelchair: Accessibility,
  hours: Clock,
};
const amenityIconFor = (key: string): LucideIcon => amenityIcons[key] ?? MapPinIcon;

// Origin marker (blue pin)
function OriginMarker({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const iconSvg = renderIconToHtml(Navigation, 'w-3 h-3 text-foreground') ||
      '<svg viewBox="0 0 24 24" class="w-3 h-3 text-foreground" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>';
    const icon = L.divIcon({
      className: 'custom-origin-marker',
      html: `<div class="w-6 h-6 bg-accent border-3 border-border rounded-full shadow-lg flex items-center justify-center">${iconSvg}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
    const marker = L.marker(position, { icon }).addTo(map);
    return () => { map.removeLayer(marker); };
  }, [map, position]);
  return null;
}

// Destination marker (red pin)
function DestinationMarker({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const iconSvg = renderIconToHtml(MapPinIcon, 'w-3 h-3 text-foreground') ||
      '<svg viewBox="0 0 24 24" class="w-3 h-3 text-foreground" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
    const icon = L.divIcon({
      className: 'custom-dest-marker',
      html: `<div class="w-6 h-6 bg-destructive border-3 border-border rounded-full shadow-lg flex items-center justify-center">${iconSvg}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
    const marker = L.marker(position, { icon }).addTo(map);
    return () => { map.removeLayer(marker); };
  }, [map, position]);
  return null;
}

// Map controller component to move camera to selected point
function MapController({ selectedPoint }: { selectedPoint: any }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedPoint || selectedPoint.lat == null || selectedPoint.lng == null) return;
    const lat = Number(selectedPoint.lat);
    const lng = Number(selectedPoint.lng);
    // Guard against non-finite / NaN coords (e.g. string-typed from backend).
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    // Mark this as a programmatic fly so MapEvents does NOT treat the following
    // moveend as a user pan (which would trigger a bounds refetch and wipe the
    // markers we just selected — the cause of "click → jumps to a wrong point").
    (map as any).__edumapProgrammaticFly = true;
    map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
  }, [selectedPoint, map]);

  return null;
}

// Lightweight debounce (no-lodash) — a drag/zoom burst collapses into ONE fetch.
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let timer: any;
  const debounced = (...args: any[]) => {
    timer = clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => { if (timer) clearTimeout(timer); };
  return debounced as typeof debounced & { cancel: () => void };
}

// Bounding Box Event Tracker
function MapEvents({ onBoundsChange }: { onBoundsChange?: (bounds: any) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onBoundsChange) return;
    let cancelled = false;
    let initialFired = false;
    const fire = () => {
      // Skip the moveend emitted by a programmatic flyTo (see MapController) so
      // we don't refetch + wipe the markers right after the user tapped a pin.
      if ((map as any).__edumapProgrammaticFly) {
        (map as any).__edumapProgrammaticFly = false;
        return;
      }
      const b = map.getBounds();
      if (cancelled) return;
      onBoundsChange({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
    };
    // First call = current viewport (replaces the old DEFAULT_BBOX whole-province fetch).
    const onReady = () => { if (!initialFired) { initialFired = true; fire(); } };
    map.whenReady(onReady);
    // Subsequent pans/zooms: debounced (400ms trailing) → single fetch per gesture.
    const debounced = debounce(fire, 400);
    map.on('moveend', debounced);

    // Reset the programmatic-fly flag on ANY real user interaction so that a
    // pan/drag that interrupts a flyTo animation is not swallowed by the flag
    // (edge case: click pin → flyTo starts → user drags before flyTo finishes).
    const resetFlag = () => { (map as any).__edumapProgrammaticFly = false; };
    map.on('mousedown touchstart wheel', resetFlag);

    return () => {
      cancelled = true; debounced.cancel();
      (map as any).__edumapProgrammaticFly = false;
      map.off('moveend', debounced);
      map.off('mousedown touchstart wheel', resetFlag);
    };
  }, [map, onBoundsChange]);
  return null;
}

// Map Click Handler for Pinning
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handleMapClick = (e: any) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      onClick(lat, lng);
    };
    map.on('click', handleMapClick);
    return () => { map.off('click', handleMapClick); };
  }, [map, onClick]);
  return null;
}

// GeoJSON boundary layer for AI geo-analysis (Issue #7: GeoAI → GeoJSON).
// Renders each cluster's convex-hull Polygon as a filled boundary AND, for
// degenerate clusters that collapsed to a Point geometry, a circle marker at
// the hub centroid. Popups surface the hub metadata (point_count, density,
// categories) so users can inspect a cluster without leaving the map.
function HubGeoJsonLayer({ data }: { data: any }) {
  if (!data || !Array.isArray(data.features) || data.features.length === 0) return null;
  return (
    <GeoJSON
      data={data}
      pathOptions={{
        color: '#0ea5e9', // sky-500 boundary outline
        weight: 3,
        opacity: 0.95,
        fillColor: '#0ea5e9',
        fillOpacity: 0.14,
      }}
      pointToLayer={(feature: any, latlng: L.LatLngExpression) =>
        L.circleMarker(latlng, {
          radius: 6,
          color: '#0ea5e9',
          fillColor: '#0ea5e9',
          fillOpacity: 0.85,
        })
      }
      onEachFeature={(feature: any, layer: L.Layer) => {
        const props = (feature.properties || {}) as Record<string, any>;
        const pointCount = props.point_count;
        if (pointCount === undefined) return;
        const hubId = props.hub_id ?? '?';
        const name = props.name || `Cụm giáo dục #${hubId}`;
        const density = props.density_score;
        const cats = (props.categories || []).join(', ');
        const html = `
          <div class="font-sans text-xs text-foreground">
            <strong class="block text-sky-400">${name}</strong>
            <span class="block opacity-80">${pointCount} cơ sở giáo dục</span>${cats ? `<span class="block opacity-80 mt-0.5">${cats}</span>` : ''}${density !== undefined ? `<span class="block opacity-80 mt-0.5">Mật độ: ${density}%</span>` : ''}
          </div>`;
        layer.bindPopup(html);
      }}
    />
  );
}

interface InteractiveMapProps {
  points?: any[];
  selectedPoint?: any | null;
  onSelectPoint?: (point: any) => void;
  onMapClick?: (lat: number, lng: number) => void;
  showHeatmap?: boolean;
  onBoundsChange?: (bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number }) => void;
  apiBaseUrl?: string;
  nearbyPoints?: any[];
  /** Issue #7 (GeoAI → GeoJSON): GeoJSON FeatureCollection of education-hub
   *  boundary polygons produced by DBSCAN clustering. Rendered as polygon
   *  overlays on the map. May be null (no analysis yet). */
  geoJsonData?: any;
  /** Featured "ghim" pins that link to feature pages (/stem, /green, etc.) */
  featuredPins?: FeaturedPin[];
  /** Callback when a featured pin is clicked — lets the parent open a popup
   *  instead of redirecting away from the current page. */
  onFeaturedPinClick?: (pin: FeaturedPin) => void;
  /**
   * Optional tool overlay rendered inside the MapContainer AFTER the base POI
   * layers but BEFORE routing/origin markers. Lets the unified Map Hub render
   * per-tool analysis layers (gap cells, risk heatmaps, survey candidates,
   * satellite detections, etc.) on the SAME shared map instance.
   */
  overlay?: React.ReactNode;
}

export default function InteractiveMap({ 
  points = [], 
  selectedPoint = null, 
  onSelectPoint = () => {},
  onMapClick = () => {},
  showHeatmap = false,
  onBoundsChange,
  apiBaseUrl = '/api',
  nearbyPoints = [],
  geoJsonData = null,
  featuredPins = [],
  onFeaturedPinClick,
  overlay = null,
}: InteractiveMapProps) {
  const defaultCenter: [number, number] = [10.957, 106.843];
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [routeInfo, setRouteInfo] = useState<{
    duration: number;
    distance: number;
    segments?: Array<{ name: string; duration: number; distance: number; congestionLevel?: number }>;
    floodWarnings?: Array<{ name: string; riskLevel: string }>;
    avoidedFloodZones?: Array<{ name: string; riskLevel: string }>;
    trafficAnalysis?: {
      totalDelay: number;
      congestionSummary: { free: number; light: number; moderate: number; heavy: number };
      segments: Array<{ roadName: string; roadType: string; congestionLevel: number; congestionLabel: string; congestionColor: string; estimatedSpeed: number; freeFlowSpeed: number }>;
    };
  } | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routingMode, setRoutingMode] = useState<'idle' | 'setting_origin' | 'setting_destination'>('idle');

  // SafeRoute AI (Idea #12) — multi-route state
  const [safeRoutes, setSafeRoutes] = useState<any[] | null>(null);
  const [routeExplanation, setRouteExplanation] = useState<string | null>(null);
  const [isSafeRouteLoading, setIsSafeRouteLoading] = useState(false);

  // --- Session persistence: lưu route vào localStorage để quay lại ---
  const ROUTE_STORAGE_KEY = 'edumap_saved_routes';
  const [savedRoutes, setSavedRoutes] = useState<Array<{
    id: string;
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    geometry: any;
    info: { duration: number; distance: number };
    saved_at: string;
  }>>([]);

  // Tải lịch sử lộ trình đã lưu khi component mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ROUTE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedRoutes(parsed);
          // Tự động khôi phục route cuối cùng nếu chưa có route hiện tại
          if (parsed.length > 0 && !routeGeometry) {
            const last = parsed[0];
            setOrigin(last.origin);
            setDestination(last.destination);
            setRouteGeometry(last.geometry);
            setRouteInfo({
              duration: last.info.duration,
              distance: last.info.distance,
              segments: [],
              floodWarnings: [],
              avoidedFloodZones: [],
              trafficAnalysis: undefined,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load saved routes from localStorage', e);
    }
  }, []); // chỉ chạy một lần khi mount

  // Tự động lưu route hiện tại khi geometry thay đổi
  useEffect(() => {
    if (origin && destination && routeGeometry && routeInfo) {
      const route = {
        id: Date.now().toString(),
        origin,
        destination,
        geometry: routeGeometry,
        info: { duration: routeInfo.duration, distance: routeInfo.distance },
        saved_at: new Date().toISOString(),
      };
      setSavedRoutes(prev => {
        const isDup = prev.some(r =>
          r.origin.lat === origin.lat && r.origin.lng === origin.lng &&
          r.destination.lat === destination.lat && r.destination.lng === destination.lng
        );
        if (isDup) return prev;
        const updated = [route, ...prev].slice(0, 10);
        try {
          localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save route to localStorage', e);
        }
        return updated;
      });
    }
  }, [routeGeometry, origin, destination, routeInfo]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (routingMode === 'setting_origin') {
      setOrigin({ lat, lng });
      setRoutingMode('setting_destination');
    } else if (routingMode === 'setting_destination') {
      setDestination({ lat, lng });
      setRoutingMode('idle');
    } else {
      onMapClick(lat, lng);
    }
  }, [routingMode, onMapClick]);

  const fetchRoute = useCallback(async (originPoint: { lat: number; lng: number }, destPoint: { lat: number; lng: number }, options?: { avoidFlood?: boolean; avoidTraffic?: boolean }) => {
    setIsLoadingRoute(true);
    try {
      const params = new URLSearchParams({
        lng1: originPoint.lng.toString(),
        lat1: originPoint.lat.toString(),
        lng2: destPoint.lng.toString(),
        lat2: destPoint.lat.toString(),
        alternatives: 'true',
        steps: 'true',
        overview: 'full',
        avoidFlood: (options?.avoidFlood === true).toString(),
        avoidTraffic: (options?.avoidTraffic === true).toString(),
      });

      const response = await fetch(`${apiBaseUrl}/map/routing/route?${params}`);
      const data = await response.json();

      // BFF unwraps backend's { success, data: { routes, ... } } into the
      // payload directly (data.data ?? data). Error responses still come as
      // { success: false, message: '...' }.
      const payload = (data?.data ?? data) as any;

      if (payload.routes?.length > 0) {
        const bestRoute = payload.routes[0];
        setRouteGeometry(bestRoute.geometry);

        setRouteInfo({
          duration: bestRoute.duration,
          distance: bestRoute.distance,
          // Use the segments pre-computed by the backend (with congestionLevel
          // from the traffic analysis). Previously the frontend re-derived
          // segments from OSRM steps and read `step.congestionLevel` which
          // never exists on a raw OSRM step object → always undefined.
          segments: payload.segments || [],
          floodWarnings: payload.floodWarnings || [],
          avoidedFloodZones: payload.avoidedFloodZones || [],
          trafficAnalysis: payload.trafficAnalysis || null,
        });
      } else {
        throw new Error(data.message || 'Không tìm thấy lộ trình');
      }
    } catch (error) {
      console.error('Routing error:', error);
      toast.error(
        'Không thể tính lộ trình: ' +
          (error instanceof Error ? error.message : 'Lỗi không xác định'),
      );
      setRouteGeometry(null);
      setRouteInfo(null);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [apiBaseUrl]);

  // ── SafeRoute AI (Idea #12) ───────────────────────────────────────
  const fetchSafeRoute = useCallback(async (
    originPoint: { lat: number; lng: number },
    destPoint: { lat: number; lng: number },
    options?: { avoidFlood?: boolean; avoidTraffic?: boolean; safetyWeight?: number },
  ) => {
    setIsSafeRouteLoading(true);
    setRouteGeometry(null);
    setRouteInfo(null);
    setSafeRoutes(null);
    setRouteExplanation(null);
    try {
      const params = new URLSearchParams({
        lng1: originPoint.lng.toString(),
        lat1: originPoint.lat.toString(),
        lng2: destPoint.lng.toString(),
        lat2: destPoint.lat.toString(),
        avoidFlood: (options?.avoidFlood ?? true).toString(),
        avoidTraffic: (options?.avoidTraffic ?? true).toString(),
        safetyWeight: String(options?.safetyWeight ?? 0.3),
      });

      const response = await fetch(`${apiBaseUrl}/map/safe-route?${params}`);
      const data = await response.json();
      const payload = (data?.data ?? data) as any;

      if (payload.routes?.length > 0) {
        setSafeRoutes(payload.routes);

        // Request LLM explanation from ai-service
        try {
          const explainRes = await fetch(`${apiBaseUrl}/ai/route/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              routes: payload.routes.map((r: any) => ({
                safetyScore: r.safetyScore,
                safetyFactors: r.safetyFactors,
                distance: r.distance,
                duration: r.duration,
                explanation: r.explanation || '',
                isPrimary: r.isPrimary,
                estimated: payload.estimated,
                floodWarnings: r.floodWarnings || [],
                trafficAnalysis: r.trafficAnalysis || null,
              })),
              preferences: {
                avoidFlood: options?.avoidFlood ?? true,
                avoidTraffic: options?.avoidTraffic ?? true,
                safetyWeight: options?.safetyWeight ?? 0.3,
              },
              origin: { lng: originPoint.lng, lat: originPoint.lat },
              destination: { lng: destPoint.lng, lat: destPoint.lat },
              provider: payload.provider,
            }),
          });

          if (explainRes.ok) {
            const explainData = await explainRes.json();
            const explainPayload = (explainData?.data ?? explainData) as any;
            setRouteExplanation(
              explainPayload.explanation ||
              explainPayload.reason ||
              'Không có giải thích chi tiết.'
            );
          }
        } catch (e) {
          console.error('Route explain API error:', e);
          setRouteExplanation('AI đang không khả dụng. Vui lòng thử lại sau.');
        }

        // Set the primary route geometry for the map
        const primaryRoute = payload.routes[0];
        if (primaryRoute?.geometry) {
          setRouteGeometry(primaryRoute.geometry);
          setRouteInfo({
            duration: primaryRoute.duration || 0,
            distance: primaryRoute.distance || 0,
            segments: [],
            floodWarnings: (primaryRoute.floodWarnings || []).map((fw: any) => ({ name: fw.name, riskLevel: fw.riskLevel })),
            avoidedFloodZones: [],
            trafficAnalysis: primaryRoute.trafficAnalysis
              ? {
                  totalDelay: primaryRoute.trafficAnalysis.totalDelay,
                  congestionSummary: primaryRoute.trafficAnalysis.congestionSummary,
                  segments: [],
                }
              : undefined,
          });
        }
      } else {
        throw new Error(data.message || 'Không tìm thấy lộ trình an toàn');
      }
    } catch (error) {
      console.error('SafeRoute error:', error);
      toast.error(
        'Không thể tính lộ trình an toàn: ' +
          (error instanceof Error ? error.message : 'Lỗi không xác định'),
      );
      setSafeRoutes(null);
      setRouteExplanation(null);
    } finally {
      setIsSafeRouteLoading(false);
    }
  }, [apiBaseUrl]);

  const clearRoute = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setRouteGeometry(null);
    setRouteInfo(null);
    setSafeRoutes(null);
    setRouteExplanation(null);
    setRoutingMode('idle');
  }, []);

  // Tải một lộ trình đã lưu từ localStorage
  const loadRoute = useCallback((route: any) => {
    setOrigin(route.origin);
    setDestination(route.destination);
    setRouteGeometry(route.geometry);
    setRouteInfo({
      duration: route.info.duration,
      distance: route.info.distance,
      segments: [],
      floodWarnings: [],
      avoidedFloodZones: [],
      trafficAnalysis: undefined,
    });
    setRoutingMode('idle');
  }, []);

  // Xóa một lộ trình đã lưu
  const deleteSavedRoute = useCallback((id: string) => {
    setSavedRoutes(prev => {
      const updated = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update localStorage', e);
      }
      return updated;
    });
  }, []);

  // Lưu route hiện tại một cách rõ rệt (cập nhật timestamp nếu trùng lặp)
  const saveCurrentRoute = useCallback(() => {
    if (origin && destination && routeGeometry && routeInfo) {
      const route = {
        id: Date.now().toString(),
        origin,
        destination,
        geometry: routeGeometry,
        info: { duration: routeInfo.duration, distance: routeInfo.distance },
        saved_at: new Date().toISOString(),
      };
      setSavedRoutes(prev => {
        const filtered = prev.filter(r =>
          !(r.origin.lat === origin.lat && r.origin.lng === origin.lng &&
            r.destination.lat === destination.lat && r.destination.lng === destination.lng)
        );
        const updated = [route, ...filtered].slice(0, 10);
        try {
          localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save route to localStorage', e);
        }
        return updated;
      });
    }
  }, [origin, destination, routeGeometry, routeInfo]);

  const swapLocations = useCallback(() => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
    if (routeGeometry) {
      // Re-fetch with swapped locations
      if (origin && destination) {
        fetchRoute(destination, origin);
      }
    }
  }, [origin, destination, routeGeometry, fetchRoute]);

  const setOriginPoint = useCallback((lat: number, lng: number) => {
    setOrigin({ lat, lng });
    if (routingMode === 'setting_origin') {
      setRoutingMode('setting_destination');
    }
  }, [routingMode]);

  const setDestinationPoint = useCallback((lat: number, lng: number) => {
    setDestination({ lat, lng });
    if (routingMode === 'setting_destination') {
      setRoutingMode('idle');
    }
  }, [routingMode]);

  const startRouting = useCallback((mode: 'setting_origin' | 'setting_destination') => {
    setRoutingMode(mode);
  }, []);

  // ── SafeRoute AI (Idea #12): listen for the floating control button ──
  // The page-level button dispatches a 'toggleSafeRoute' event; we respond
  // by entering the routing flow so the user can pick origin/destination,
  // then click "SafeRoute AI" in the RoutingPanel.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      if (!origin || !destination) {
        setRoutingMode('setting_origin');
      }
    };
    window.addEventListener('toggleSafeRoute', handler);
    return () => window.removeEventListener('toggleSafeRoute', handler);
  }, [origin, destination]);

  // Navigate to a POI using EduMap's INTERNAL OSRM routing (NOT Google Maps).
  // Origin = device geolocation; if unavailable/blocked, falls back to the map's default center.
  const routeToPoi = useCallback((p: any) => {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const dest = { lat, lng };
    const start = (o: { lat: number; lng: number }) => {
      setOrigin(o);
      setDestination(dest);
      setRoutingMode('idle'); // clears the origin/destination step mode; shows route panel
      void fetchRoute(o, dest);
    };
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => start({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => start({ lat: defaultCenter[0], lng: defaultCenter[1] }),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 10000 }
      );
    } else {
      start({ lat: defaultCenter[0], lng: defaultCenter[1] });
    }
  }, [fetchRoute, defaultCenter]);

  return (
    <div className="w-full h-full relative">
      {/* Routing Panel */}
      {routingMode !== 'idle' || origin || destination || routeGeometry ? (
        <RoutingPanel
          onGetRoute={fetchRoute}
          onGetSafeRoute={fetchSafeRoute}
          onClearRoute={clearRoute}
          routeInfo={routeInfo}
          safeRoutes={safeRoutes}
          routeExplanation={routeExplanation}
          isLoading={isLoadingRoute}
          isSafeRouteLoading={isSafeRouteLoading}
          origin={origin}
          destination={destination}
          onSetOrigin={setOriginPoint}
          onSetDestination={setDestinationPoint}
          onSwap={swapLocations}
          onSaveRoute={saveCurrentRoute}
          savedRoutes={savedRoutes}
          onLoadRoute={loadRoute}
          onDeleteRoute={deleteSavedRoute}
        />
      ) : (
        <button
          onClick={() => startRouting('setting_origin')}
          className="fixed top-4 right-4 z-40 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg hover:bg-primary/80 transition-colors flex items-center gap-2"
        >
          <Navigation className="w-4 h-4" />
          Chỉ đường
        </button>
      )}

      {/* Fallback to free OpenStreetMap dark-filtered tiles if no Carto API key is set */}
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        className={`z-0 ${!process.env.NEXT_PUBLIC_CARTO_API_KEY ? 'leaflet-dark-tiles' : ''}`}
      >
        <TileLayer 
          url={
            process.env.NEXT_PUBLIC_CARTO_API_KEY
              ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          } 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Route Polyline(s) — single or multi-route (SafeRoute AI) */}
        {routeGeometry && safeRoutes && safeRoutes.length > 1
          ? safeRoutes.map((route, idx) => {
              const isPrimary = route.isPrimary;
              const geom = typeof route.geometry === 'string' ? JSON.parse(route.geometry) : route.geometry;
              const colors: string[] = ['#3b82f6', '#ef4444', '#eab308', '#22c55e', '#a855f7'];
              const color = isPrimary ? colors[0] : colors[(idx + 1) % (colors.length - 1)] || colors[1];
              const weight = isPrimary ? 6 : 3;
              const opacity = isPrimary ? 0.9 : 0.5;
              return <RoutePolyline key={`saferoute-${idx}`} geometry={geom} color={color} weight={weight} opacity={opacity} />;
            })
          : routeGeometry && <RoutePolyline geometry={routeGeometry} />}
        
        {/* Issue #7 (GeoAI → GeoJSON): draw education-hub boundary polygons */}
        {geoJsonData && <HubGeoJsonLayer data={geoJsonData} />}

        {showHeatmap ? (
          <HeatmapLayer points={points.filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))).map(p => ({ lat: Number(p.lat), lng: Number(p.lng), intensity: 0.8 }))} />
        ) : (
          <MarkerClusterGroup chunkedLoading>
            {points
              .filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
              .map((p) => {
                const lat = Number(p.lat);
                const lng = Number(p.lng);

                return (
                  <Marker 
                    key={`${p.id}-${Number(p.lat).toFixed(6)}-${Number(p.lng).toFixed(6)}`} 
                    position={[lat, lng]} 
                    icon={getIconForCategory(p.category)}
                    eventHandlers={{
                      click: () => onSelectPoint(p)
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -30]} opacity={1}>
                      <span className="font-bold text-xs">{p.name}</span>
                    </Tooltip>
                    <Popup>
                      <div className="p-2 text-foreground font-sans max-w-[240px] bg-card border border-border rounded-lg shadow-lg">
                        <h4 className="font-extrabold text-sm text-foreground leading-tight mb-1">{p.name}</h4>
                        <p className="text-[11px] opacity-75 mb-2">{p.address}</p>

                        {/* This POI's OWN amenities (wifi, parking, ...) — compact icon+label row */}
                        {p.amenities?.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            {p.amenities.map((a: any) => {
                              const Ai = amenityIconFor(a.icon);
                              return (
                                <span key={a.icon} className="flex items-center gap-1 text-[9px] text-muted-foreground/80">
                                  <Ai className="w-3.5 h-3.5 opacity-70" />
                                  <span>{a.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {p.description && (
                          <p className="text-[10px] text-muted-foreground/80 mt-1 leading-snug">
                            {p.description}
                          </p>
                        )}

                        {p.id === selectedPoint?.id && nearbyPoints.length > 0 && (
                          <div className="pt-2 border-t border-border">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                              Tiện ích xung quanh (≤1km)
                            </p>
                            <ul className="space-y-1 max-h-40 overflow-y-auto">
                              {nearbyPoints.map((f: any) => {
                                const Fi = facilityIconFor(f.category);
                                return (
                                  <li key={f.id} className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground/70">
                                    <span className="flex items-center gap-1 truncate">
                                      <Fi className="w-3 h-3 text-accent" />
                                      <span>{f.name}</span>
                                    </span>
                                    <button
                                      onClick={() => routeToPoi(f)}
                                      className="underline text-[9px] font-bold text-accent"
                                    >
                                      Đến
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                            <span className="text-accent">Verified</span>
                          </div>
                          <button
                            className="bg-card text-foreground text-[9px] font-bold px-2 py-1 rounded hover:bg-primary/20"
                            onClick={() => routeToPoi(p)}
                          >
                            Dẫn đường
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MarkerClusterGroup>
        )}

        {/* Featured "ghim" pins (separate cluster) — star icons with feature-page links */}
        {!showHeatmap && featuredPins.length > 0 && (
          <MarkerClusterGroup chunkedLoading>
            {featuredPins
              .filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
              .map((p: any) => {
                const lat = Number(p.lat);
                const lng = Number(p.lng);

                return (
                    <Marker
                      key={p.id}
                      position={[lat, lng]}
                      icon={getFeaturedIconForCategory(p.category)}
                      eventHandlers={{
                        click: () => {
                          if (onFeaturedPinClick) {
                            onFeaturedPinClick(p);
                          } else {
                            window.location.href = p.featureLink;
                          }
                        },
                      }}
                    >
                    <Tooltip direction="top" offset={[0, -30]} opacity={1}>
                      <span className="font-bold text-xs">{p.name}</span>
                    </Tooltip>
                    <Popup>
                      <div className="p-2 text-foreground font-sans max-w-[240px] bg-card border border-border rounded-lg shadow-lg">
                        <h4 className="font-extrabold text-sm text-foreground leading-tight mb-1">{p.name}</h4>
                        {p.address && (
                          <p className="text-[11px] opacity-75 mb-2">{p.address}</p>
                        )}
                        {p.description && (
                          <p className="text-[10px] text-muted-foreground/80 mt-1 leading-snug line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-primary">
                            Ghim {p.category}
                          </span>
                          <button
                            className="bg-primary text-primary-foreground text-[9px] font-bold px-2.5 py-1 rounded hover:bg-primary/80 transition-colors flex items-center gap-1"
                            onClick={() => {
                              if (onFeaturedPinClick) {
                                onFeaturedPinClick(p);
                              } else {
                                window.location.href = p.featureLink;
                              }
                            }}
                          >
                            <Star className="w-3 h-3 fill-current" />
                            Đến
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MarkerClusterGroup>
        )}

        {/* Origin/Destination Markers */}
        {origin && <OriginMarker position={[origin.lat, origin.lng]} />}
        {destination && <DestinationMarker position={[destination.lat, destination.lng]} />}

        {/* Tool overlay layers (e.g. gap cells, risk heatmap, survey candidates).
            Rendered after base POIs / featured pins so they appear above the
            base layers but below the routing / origin-destination markers. */}
        {overlay}

        <MapController selectedPoint={selectedPoint} />
        <MapEvents onBoundsChange={onBoundsChange} />
        <MapClickHandler onClick={handleMapClick} />
      </MapContainer>
    </div>
  );
}