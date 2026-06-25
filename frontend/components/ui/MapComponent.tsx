"use client";
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ShieldCheck, MapPin, Flame } from 'lucide-react';
import HeatmapLayer from '@/components/map/HeatmapLayer';

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
      console.log('Map clicked raw:', e.latlng);
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      console.log('Sending to handler - lat:', lat, 'lng:', lng);
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
}

export default function InteractiveMap({ 
  points = [], 
  selectedPoint = null, 
  onSelectPoint = () => {},
  onMapClick = () => {},
  showHeatmap = false,
  onBoundsChange
}: InteractiveMapProps) {
  const defaultCenter: [number, number] = [10.957, 106.843];

  return (
    <div className="w-full h-full relative">
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

        <MapController selectedPoint={selectedPoint} />
        <MapEvents onBoundsChange={onBoundsChange} />
        <MapClickHandler onClick={onMapClick} />
      </MapContainer>
    </div>
  );
}
