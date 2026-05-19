"use client";
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ShieldCheck } from 'lucide-react';

// Configure standard Leaflet markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons for different categories
const schoolIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const libraryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const labIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const cafeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const getCategoryIcon = (typeId: number) => {
  if (typeId === 1 || typeId === 2) return schoolIcon;
  if (typeId === 3 || typeId === 4) return libraryIcon;
  if (typeId === 5) return labIcon;
  if (typeId === 7) return greenIcon;
  return cafeIcon;
};

// Map controller component to move camera to selected point
function MapController({ selectedPoint }: { selectedPoint: any }) {
  const map = useMap();

  useEffect(() => {
    if (selectedPoint && selectedPoint.location && selectedPoint.location.coordinates) {
      const lat = selectedPoint.location.coordinates[1];
      const lng = selectedPoint.location.coordinates[0];
      map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
    }
  }, [selectedPoint, map]);

  return null;
}

interface InteractiveMapProps {
  points?: any[];
  selectedPoint?: any | null;
  onSelectPoint?: (point: any) => void;
}

export default function InteractiveMap({ points = [], selectedPoint = null, onSelectPoint = () => {} }: InteractiveMapProps) {
  // Bien Hoa center coordinates
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
        
        {/* Dynamic educational markers */}
        {points
          .filter(p => p.location && p.location.coordinates)
          .map((p) => {
            const lat = p.location.coordinates[1];
            const lng = p.location.coordinates[0];

            return (
              <Marker 
                key={p.id} 
                position={[lat, lng]} 
                icon={getCategoryIcon(Number(p.type_id))}
                eventHandlers={{
                  click: () => onSelectPoint(p)
                }}
              >
                <Popup>
                  <div className="p-2 text-zinc-950 font-sans max-w-[240px]">
                    <h4 className="font-extrabold text-sm text-blue-700 leading-tight">{p.name}</h4>
                    <p className="text-[11px] opacity-75 mt-1">{p.address}</p>
                    {p.description && (
                      <p className="text-[10px] bg-zinc-100 p-1.5 rounded-lg mt-2 text-zinc-700 italic border-l-2 border-blue-500">
                        "{p.description}"
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-0.5">
                        <ShieldCheck className="w-3 h-3 text-blue-600" /> Verified
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        <span className="w-1 h-1 rounded-full bg-emerald-600 animate-pulse"></span>Active
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Camera handling on click / sidebar selection */}
        <MapController selectedPoint={selectedPoint} />
      </MapContainer>
    </div>
  );
}

