"use client";

import React, { useEffect, useState } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, Rectangle, useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle, CheckCircle, MapPin,
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// ── Constants ─────────────────────────────────────────────────────────────

const BIEN_HOA: [number, number] = [10.957, 106.843];
const DEFAULT_BBOX = { minLat: 10.91, maxLat: 11.01, minLng: 106.78, maxLng: 106.90 };

const ZOOM_LEVELS = [16, 17, 18, 19, 20];
const LABEL_CANDIDATES = [
  'school', 'university', 'educational institution', 'college',
  'building', 'campus', 'library',
];

// ── Icons ─────────────────────────────────────────────────────────────────

const PIN_SVG = `<svg viewBox="0 0 24 24" class="absolute inset-0 w-5 h-5"><path fill="currentColor" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;

function makeDetectionIcon(match: 'known' | 'new', score: number): L.DivIcon {
  const isKnown = match === 'known';
  const colorClass = isKnown ? 'text-green-400' : 'text-red-400';
  const bgClass = isKnown ? 'bg-green-500/20' : 'bg-red-500/20';
  const IconComp = isKnown ? CheckCircle : AlertCircle;
  const glyphSvg = renderToStaticMarkup(
    React.createElement(IconComp, { className: 'w-3 h-3' })
  );
  const html = `<div class="${colorClass} ${bgClass} relative flex items-center justify-center rounded-full border-2 border-current" style="width:28px;height:28px">${PIN_SVG}<span class="relative text-white flex items-center justify-center w-3 h-3">${glyphSvg}</span><span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-bold">${Math.round(score * 100)}%</span></div>`;
  return L.divIcon({
    className: 'geovision-detection-marker shadow-lg',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 29],
    popupAnchor: [0, -36],
  });
}

// ── Map controls ───────────────────────────────────────────────────────────

/** Captures map bounds and zoom on move/end events. */
function MapBoundsCapture({ onBoundsChange }: { onBoundsChange: (b: any) => void }) {
  const map = useMap();
  useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChange({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
        zoom: map.getZoom(),
      });
    },
  });
  return null;
}

/** Auto-fit to the drawn rectangle's bounds. */
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    try {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } catch { /* bounds may be invalid */ }
  }, [bounds, map]);
  return null;
}

// ── Detection rectangle overlay ────────────────────────────────────────────

/** Draw a rectangle showing the analysis bounding box. */
function AnalysisBounds({
  bounds,
}: {
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}) {
  if (!bounds || bounds.minLat === bounds.maxLat) return null;
  const rectBounds: L.LatLngBoundsExpression = [
    [bounds.minLat, bounds.minLng],
    [bounds.maxLat, bounds.maxLng],
  ];
  return (
    <Rectangle
      bounds={rectBounds}
      pathOptions={{ color: '#3b82f6', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.1 }}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface GeoVisionMapProps {
  detections: Array<{
    score: number;
    label: string;
    box: { xmin: number; ymin: number; xmax: number; ymax: number };
    lat?: number;
    lng?: number;
    match?: 'known' | 'new';
    nearest_poi?: { id: string; name: string; type: string; lat: number; lng: number; distance_m: number } | null;
  }>;
  knownPois: Array<{ id: string; name: string; type: string; lat: number; lng: number }>;
  analysisBbox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  onMapClick?: () => void;
}

export default function GeoVisionMap({
  detections,
  knownPois,
  analysisBbox,
  onMapClick,
}: GeoVisionMapProps) {
  const [bounds, setBounds] = useState<any>(null);

  const handleMapClick = () => {
    onMapClick?.();
  };

  // Fit to analysis bbox when it changes
  const rectBounds = analysisBbox
    ? ([
        [analysisBbox.minLat, analysisBbox.minLng],
        [analysisBbox.maxLat, analysisBbox.maxLng],
      ] as L.LatLngBoundsExpression)
    : null;

  return (
    <MapContainer
      center={BIEN_HOA}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
    >
      {/* OSM standard tiles (shows building footprints — useful for education detection) */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={20}
        maxNativeZoom={19}
      />

      {/* Capture viewport bounds for "detect current view" button */}
      <MapBoundsCapture onBoundsChange={setBounds} />

      {/* Auto-fit to analysis bbox */}
      <FitBounds bounds={rectBounds} />

      {/* Analysis bbox overlay */}
      {analysisBbox && <AnalysisBounds bounds={analysisBbox} />}

      {/* Known POIs (green markers) */}
      {knownPois.map((poi) => (
        <Marker
          key={`known-${poi.id}`}
          position={[poi.lat, poi.lng]}
          icon={makeDetectionIcon('known', 100)}
        >
          <Popup>
            <div className="text-xs">
              <strong className="text-green-400">✓ Đã biết</strong>
              <div className="font-medium">{poi.name}</div>
              <div className="text-muted-foreground">{poi.type}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Detection markers (red = new/potential, green = known match) */}
      {detections
        .filter((d) => d.lat != null && d.lng != null)
        .map((d, i) => (
          <Marker
            key={`det-${i}`}
            position={[d.lat!, d.lng!]}
            icon={makeDetectionIcon(d.match === 'known' ? 'known' : 'new', d.score)}
          >
            <Popup>
              <div className="text-xs">
                <div className="flex items-center gap-1 mb-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    d.match === 'known' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <strong>{d.match === 'known' ? 'Đã biết' : 'Mới/ tiềm năng'}</strong>
                </div>
                <div className="font-medium">{d.label}</div>
                <div className="text-muted-foreground">
                  Độ tin cậy: {Math.round(d.score * 100)}%
                </div>
                {d.match === 'known' && d.nearest_poi && (
                  <div className="mt-1 text-green-400">
                    ↔ {d.nearest_poi.name} ({Math.round(d.nearest_poi.distance_m)}m)
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

      {/* Viewport bounds marker */}
      {bounds && (
        <Rectangle
          bounds={[
            [bounds.minLat, bounds.minLng],
            [bounds.maxLat, bounds.maxLng],
          ]}
          pathOptions={{ color: '#fbbf24', weight: 1, dashArray: '4 4', fillOpacity: 0 }}
        />
      )}
    </MapContainer>
  );
}
