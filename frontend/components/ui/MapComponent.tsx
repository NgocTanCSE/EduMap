"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShieldCheck, MapPin, Flame, Search, X, ArrowRightLeft, RotateCcw, AlertTriangle, Clock, MapPin as MapPinIcon, Navigation, Wifi, ParkingCircle, Bath, Accessibility, BookOpen, Atom, Leaf, Coffee, GraduationCap, Globe, ShoppingCart, Store, type LucideIcon } from 'lucide-react';
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
const _divIconCache = new Map<string, ReturnType<typeof L.divIcon>>();

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
};

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

interface InteractiveMapProps {
  points?: any[];
  selectedPoint?: any | null;
  onSelectPoint?: (point: any) => void;
  onMapClick?: (lat: number, lng: number) => void;
  showHeatmap?: boolean;
  onBoundsChange?: (bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number }) => void;
  apiBaseUrl?: string;
  nearbyPoints?: any[];
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

      if (data.success && data.data?.routes?.length > 0) {
        const bestRoute = data.data.routes[0];
        setRouteGeometry(bestRoute.geometry);

        setRouteInfo({
          duration: bestRoute.duration,
          distance: bestRoute.distance,
          // Use the segments pre-computed by the backend (with congestionLevel
          // from the traffic analysis). Previously the frontend re-derived
          // segments from OSRM steps and read `step.congestionLevel` which
          // never exists on a raw OSRM step object → always undefined.
          segments: data.data.segments || [],
          floodWarnings: data.data.floodWarnings || [],
          avoidedFloodZones: data.data.avoidedFloodZones || [],
          trafficAnalysis: data.data.trafficAnalysis || null,
        });
      } else {
        throw new Error(data.message || 'Không tìm thấy lộ trình');
      }
    } catch (error) {
      console.error('Routing error:', error);
      alert('Không thể tính lộ trình: ' + (error instanceof Error ? error.message : 'Lỗi không xác định'));
      setRouteGeometry(null);
      setRouteInfo(null);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [apiBaseUrl]);

  const clearRoute = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setRouteGeometry(null);
    setRouteInfo(null);
    setRoutingMode('idle');
  }, []);

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
          onClearRoute={clearRoute}
          routeInfo={routeInfo}
          isLoading={isLoadingRoute}
          origin={origin}
          destination={destination}
          onSetOrigin={setOriginPoint}
          onSetDestination={setDestinationPoint}
          onSwap={swapLocations}
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
        
        {/* Route Polyline */}
        {routeGeometry && <RoutePolyline geometry={routeGeometry} />}
        
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
                    key={p.id} 
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
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-1">
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

        {/* Origin/Destination Markers */}
        {origin && <OriginMarker position={[origin.lat, origin.lng]} />}
        {destination && <DestinationMarker position={[destination.lat, destination.lng]} />}

        <MapController selectedPoint={selectedPoint} />
        <MapEvents onBoundsChange={onBoundsChange} />
        <MapClickHandler onClick={handleMapClick} />
      </MapContainer>
    </div>
  );
}