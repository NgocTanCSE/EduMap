"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ShieldCheck, MapPin, Flame, Search, X, ArrowRightLeft, RotateCcw, AlertTriangle, Clock, MapPin as MapPinIcon, Navigation } from 'lucide-react';
import HeatmapLayer from '@/components/map/HeatmapLayer';
import { RoutePolyline } from '@/components/map/RoutePolyline';
import RoutingPanel from '@/components/map/RoutingPanel';

// Configure standard Leaflet markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper for dynamic colors
const createCustomIcon = (color: string) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const icons: Record<string, L.Icon> = {
  blue: createCustomIcon('blue'),
  violet: createCustomIcon('violet'),
  red: createCustomIcon('red'),
  green: createCustomIcon('green'),
  orange: createCustomIcon('orange'),
  yellow: createCustomIcon('yellow'),
  grey: createCustomIcon('grey'),
};

const getIconForCategory = (categoryName: string) => {
  switch (categoryName?.toLowerCase()) {
    case 'school':
    case 'university':
      return icons.blue;
    case 'library':
    case 'bookstore':
      return icons.violet;
    case 'lab':
    case 'stem':
      return icons.red;
    case 'green':
    case 'park':
      return icons.green;
    case 'wifi':
      return icons.yellow;
    case 'cafe':
      return icons.orange;
    default:
      return icons.grey;
  }
};

// Origin marker (blue pin)
function OriginMarker({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const icon = L.divIcon({
      className: 'custom-origin-marker',
      html: `<div class="w-6 h-6 bg-blue-500 border-3 border-white rounded-full shadow-lg flex items-center justify-center"><Navigation className="w-3 h-3 text-white" /></div>`,
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
    const icon = L.divIcon({
      className: 'custom-dest-marker',
      html: `<div class="w-6 h-6 bg-red-500 border-3 border-white rounded-full shadow-lg flex items-center justify-center"><MapPinIcon className="w-3 h-3 text-white" /></div>`,
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
    if (selectedPoint && selectedPoint.lat !== undefined && selectedPoint.lng !== undefined) {
      map.flyTo([selectedPoint.lat, selectedPoint.lng], 16, { animate: true, duration: 1.5 });
    }
  }, [selectedPoint, map]);

  return null;
}

// Bounding Box Event Tracker
function MapEvents({ onBoundsChange }: { onBoundsChange?: (bounds: any) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onBoundsChange) return;
    let didInitialLoad = false;
    const handleMoveEnd = () => {
      if (!didInitialLoad) {
        didInitialLoad = true;
        return;
      }
      const bounds = map.getBounds();
      onBoundsChange({
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast()
      });
    };
    map.on('moveend', handleMoveEnd);
    return () => { map.off('moveend', handleMoveEnd); };
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
}

export default function InteractiveMap({ 
  points = [], 
  selectedPoint = null, 
  onSelectPoint = () => {},
  onMapClick = () => {},
  showHeatmap = false,
  onBoundsChange,
  apiBaseUrl = '/api'
}: InteractiveMapProps) {
  const defaultCenter: [number, number] = [10.957, 106.843];
  
  // Routing state
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
        avoidFlood: (options?.avoidFlood !== false).toString(),
        avoidTraffic: (options?.avoidTraffic !== false).toString(),
      });

      const response = await fetch(`${apiBaseUrl}/map/routing/route?${params}`);
      const data = await response.json();

      if (data.success && data.data?.routes?.length > 0) {
        const bestRoute = data.data.routes[0];
        setRouteGeometry(bestRoute.geometry);
        
        const segments = bestRoute.legs?.[0]?.steps?.map((step: any) => ({
          name: step.name || 'Đoạn đường',
          duration: step.duration,
          distance: step.distance,
          congestionLevel: step.congestionLevel,
        })) || [];

        setRouteInfo({
          duration: bestRoute.duration,
          distance: bestRoute.distance,
          segments,
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
          className="fixed top-4 right-4 z-40 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Navigation className="w-4 h-4" />
          Chỉ đường
        </button>
      )}

      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer 
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* Route Polyline */}
        {routeGeometry && <RoutePolyline geometry={routeGeometry} />}
        
        {showHeatmap ? (
          <HeatmapLayer points={points.filter(p => p.lat !== undefined && p.lng !== undefined).map(p => ({ lat: p.lat, lng: p.lng, intensity: 0.8 }))} />
        ) : (
          <MarkerClusterGroup chunkedLoading>
            {points
              .filter(p => p.lat !== undefined && p.lng !== undefined)
              .map((p) => {
                const lat = p.lat;
                const lng = p.lng;

                return (
                  <Marker 
                    key={p.id} 
                    position={[lat, lng]} 
                    icon={getIconForCategory(p.category)}
                    eventHandlers={{
                      click: () => onSelectPoint(p)
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -30]} opacity={0.9}>
                      <span className="font-bold text-xs text-zinc-900">{p.name}</span>
                    </Tooltip>
                    <Popup>
                      <div className="p-2 text-zinc-950 font-sans max-w-[240px]">
                        <h4 className="font-extrabold text-sm text-zinc-900 leading-tight mb-1">{p.name}</h4>
                        <p className="text-[11px] opacity-75 mb-2">{p.address}</p>
                        
                        {p.description && (
                          <p className="text-[10px] bg-zinc-50 p-2 rounded-lg mt-2 text-zinc-700 italic border-l-2 border-yellow-500 mb-3">
                            "{p.description}"
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Verified</span>
                          </div>
                          <button 
                              className="bg-zinc-900 text-white text-[9px] font-bold px-2 py-1 rounded hover:bg-zinc-800"
                              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')}
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