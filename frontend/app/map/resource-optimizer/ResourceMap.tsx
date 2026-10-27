"use client";
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToStaticMarkup } from 'react-dom/server';
import { Wifi, Laptop, BookOpen, GraduationCap, MapPin, AlertCircle } from 'lucide-react';

// ── Icon setup ────────────────────────────────────────────────────────────

/** Tiny SVG tear-drop used as the base pin shape (matches MapComponent style). */
const PIN_SVG = `<svg viewBox="0 0 24 24" class="absolute inset-0 w-6 h-6"><path fill="currentColor" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;

function makeFacilityIcon(planColor: string, facilityType: string): L.DivIcon {
  const IconComp = {
    wifi: Wifi,
    computer: Laptop,
    library: BookOpen,
    study_space: GraduationCap,
  }[facilityType] || MapPin;

  const colorClass = {
    A: 'text-blue-500',
    B: 'text-green-500',
    C: 'text-red-500',
  }[planColor] || 'text-primary';

  const glyphSvg = renderToStaticMarkup(
    React.createElement(IconComp, { className: 'w-3 h-3' })
  );

  const html = `<div class="${colorClass} relative flex items-center justify-center" style="width:28px;height:28px">${PIN_SVG}<span class="relative text-white flex items-center justify-center w-3 h-3">${glyphSvg}</span></div>`;

  return L.divIcon({
    className: 'edumap-facility-marker shadow',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 29],
    popupAnchor: [0, -36],
  });
}

function makeGapIcon(): L.DivIcon {
  const html = `<div class="text-destructive relative flex items-center justify-center" style="width:24px;height:24px">${PIN_SVG}<span class="relative text-white flex items-center justify-center w-3 h-3">${renderToStaticMarkup(React.createElement(AlertCircle, { className: 'w-3 h-3' }))}</span></div>`;
  return L.divIcon({
    className: 'edumap-gap-marker shadow',
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -28],
  });
}

// ── Bounds auto-fit ───────────────────────────────────────────────────────

function FitBounds({ features }: { features: L.LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (features.length === 0) return;
    const group = (L as any).featureGroup();
    features.forEach((ll) => group.addLayer(L.marker(ll)));
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
    group.clearLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, map]);
  return null;
}

function MapEventsCapture({ onBounds }: { onBounds: (b: any) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const handler = () => {
      const b = map.getBounds();
      onBounds({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
    };
    map.whenReady(handler);
    map.on('moveend', handler);
    return () => { map.off('moveend', handler); };
  }, [map, onBounds]);
  return null;
}

// ─── Main component ────────────────────────────────────────────────────────

interface ResourceMapProps {
  facilityFeatures: any[];
  gapFeatures: any[];
  activePlan: string;
  loading: boolean;
}

// Icon cache (avoids recreating divIcons on every render)
const _iconCache = new Map<string, L.DivIcon>();
function getCachedIcon(plan: string, ftype: string): L.DivIcon {
  const key = `fac-${plan}-${ftype}`;
  const cached = _iconCache.get(key);
  if (cached) return cached;
  const icon = makeFacilityIcon(plan, ftype);
  _iconCache.set(key, icon);
  return icon;
}
const _gapIconCache = makeGapIcon();

export default function ResourceMap({
  facilityFeatures,
  gapFeatures,
  activePlan,
  loading,
}: ResourceMapProps) {
  const defaultCenter: [number, number] = [10.957, 106.843];
  const [viewport, setViewport] = useState<any>(null);

  // Extract coordinates from features
  const facilityCoords = facilityFeatures
    .filter((f) => f.geometry && f.geometry.coordinates)
    .map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number]);

  const gapCoords = gapFeatures
    .filter((f) => f.geometry && f.geometry.coordinates)
    .map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number]);

  const allCoords = [...facilityCoords, ...gapCoords];

  const center = facilityCoords.length > 0
    ? facilityCoords[0] as [number, number]
    : defaultCenter;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full"
      >
        <MapEventsCapture onBounds={setViewport} />        {/* OpenStreetMap tile layer — public, no API key required */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        {facilityFeatures.map((f, idx) => {
          const coords = f.geometry?.coordinates;
          if (!coords) return null;
          const latLng: [number, number] = [coords[1], coords[0]];
          const ftype = f.properties?.facility_type || 'wifi';
          const icon = getCachedIcon(activePlan, ftype);
          return (
            <Marker key={`fac-${idx}`} position={latLng} icon={icon}>
              <Popup>
                <div className="font-sans text-xs">
                  <strong className="block text-sky-400">
                    {f.properties?.name || 'Cơ sở đề xuất'}
                  </strong>
                  <span className="block opacity-80 mt-0.5">
                    Kế hoạch {activePlan} · {ftype} · Phục vụ {f.properties?.demand_served || 0} người
                  </span>
                  <span className="block opacity-80 mt-0.5">
                    Chi phí: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(f.properties?.cost || 0)}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Gap points (uncovered demand areas) ─────────────────────── */}
        {gapFeatures.slice(0, 100).map((f, idx) => {
          const coords = f.geometry?.coordinates;
          if (!coords) return null;
          const latLng: [number, number] = [coords[1], coords[0]];
          return (
            <Marker key={`gap-${idx}`} position={latLng} icon={_gapIconCache}>
              <Popup>
                <div className="font-sans text-xs">
                  <strong className="block text-red-400">Vùng chưa được phục vụ</strong>
                  <span className="block opacity-80 mt-0.5">
                    {f.properties?.name || 'Khu vực thiếu cơ sở'}
                  </span>
                  <span className="block opacity-80 mt-0.5">
                    Nhu cầu: {f.properties?.demand || 'N/A'}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Loading overlay ─────────────────────────────────────────── */}
        {loading && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-500">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Đang tính toán giải pháp MCLP…</span>
            </div>
          </div>
        )}

        {/* ── Auto-fit bounds ─────────────────────────────────────────── */}
        <FitBounds features={allCoords} />
      </MapContainer>
    </div>
  );
}
