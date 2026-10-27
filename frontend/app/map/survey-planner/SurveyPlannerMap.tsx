"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, Marker, Circle, Popup, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Target } from 'lucide-react';

/** Tiny SVG tear-drop pin base (matches EduMap MapComponent style). */
const PIN_SVG = `<svg viewBox="0 0 24 24" class="absolute inset-0 w-5 h-5"><path fill="currentColor" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;

function priorityColor(label: string): string {
  if (label === 'cao') return '#ef4444'; // red
  if (label === 'trung bình') return '#f59e0b'; // amber
  return '#38bdf8'; // sky (low priority — still worth a slot)
}

const _iconCache = new Map<string, L.DivIcon>();
function getPriorityIcon(label: string): L.DivIcon {
  const key = `priority-${label}`;
  const cached = _iconCache.get(key);
  if (cached) return cached;
  const colorClass = label === 'cao' ? 'text-red-400'
    : label === 'trung bình' ? 'text-amber-400' : 'text-sky-400';
  const html = `<div class="${colorClass} relative flex items-center justify-center" style="width:24px;height:24px">${PIN_SVG}</div>`;
  const icon = L.divIcon({
    className: 'edumap-survey-marker shadow',
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 26],
    popupAnchor: [0, -30],
  });
  _iconCache.set(key, icon);
  return icon;
}

// Gold "next best" pin — built once.
let _nextIcon: L.DivIcon | null = null;
function getNextIcon(): L.DivIcon {
  if (_nextIcon) return _nextIcon;
  const html = `<div class="text-amber-300 relative flex items-center justify-center" style="width:28px;height:28px"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.55.03.16.03.15.01.15.47 6.56a.75.75 0 01-.62.78l-.13.01-.15.02h-.05l-.12-.01a.75.75 0 01-.78-.62l-.47-6.56.03-.15.03-.15L12 8.71l-3.09 6.55a.75.75 0 01-.62.78h-.05l-.12-.01a.75.75 0 01-.78-.62l-.47-6.56.03-.15.03-.15L12 2z"/></svg></div>`;
  _nextIcon = L.divIcon({
    className: 'edumap-next-marker shadow-lg z-10',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 30],
    popupAnchor: [0, -32],
  });
  return _nextIcon;
}

// Auto-fit map to the bounds of all candidate + next markers.
function FitBounds({ features }: { features: { lat: number; lng: number }[] }) {
  const map = useMap();
  const fitOnce = useRef(false);
  useEffect(() => {
    if (!fitOnce.current && features.length > 0) {
      fitOnce.current = true;
      const group = L.featureGroup();
      features.forEach((ll) => group.addLayer(L.marker([ll.lat, ll.lng], {})));
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      group.clearLayers();
    }
  }, [features, map]);
  return null;
}

interface SurveyPlannerMapProps {
  data: any;                 // GeoJSON FeatureCollection from /api/map/survey/priorities
  loading: boolean;
  error: string | null;
  currentLocation?: { lat: number; lng: number } | null;
  onSelect?: (feature: any) => void;
}

export default function SurveyPlannerMap({
  data, loading, error, currentLocation, onSelect,
}: SurveyPlannerMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    currentLocation && typeof currentLocation.lat === 'number'
      ? [currentLocation.lat, currentLocation.lng]
      : [10.957, 106.843]
  );
  const features: any[] = data?.features || [];
  const nextFeature = features[0]; // top-ranked = the "next" point
  const fitPoints = useMemo(
    () => features.map((f) => ({ lat: f.properties.lat, lng: f.properties.lng })),
    [features],
  );

  // Recenter onto the current location when it changes externally.
  useEffect(() => {
    if (currentLocation && typeof currentLocation.lat === 'number') {
      setMapCenter([currentLocation.lat, currentLocation.lng]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation]);

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted/10 text-muted-foreground">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0 leaflet-dark-tiles"
      >
        {/* Public OSM tiles — no API key required (AGENTS.md §2). */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Current survey-team location (blue circle). */}
        {currentLocation && (
          <Circle
            center={[currentLocation.lat, currentLocation.lng]}
            radius={150}
            pathOptions={{ color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.25 }}
          />
        )}

        {/* Rank priority candidates as coloured pins. */}
        {features.slice(0, 50).map((f: any) => {
          const props = f.properties || {};
          return (
            <Marker
              key={`cand-${props.rank}`}
              position={[props.lat, props.lng]}
              icon={getPriorityIcon(props.priority_label || 'thấp')}
              eventHandlers={{
                click: () => onSelect && onSelect(f),
              }}
            >
              <Popup>
                <div className="font-sans text-xs text-foreground">
                  <strong className="block text-sky-400">#{props.rank} — ứng cử viên khảo sát</strong>
                  <span className="block opacity-80 mt-0.5">
                    Điểm số: {props.priority_score?.toFixed(3)} · bỏ lỡ: {props.uncertainty?.toFixed(2)}
                  </span>
                  <span className="block opacity-70 mt-0.5">
                    Chi phí: {props.cost?.toFixed(2)}h ({props.distance_km?.toFixed(1)} km)
                  </span>
                  <span className="block opacity-60 mt-0.5">{props.reason}</span>
                  {props.source && (
                    <span className="block opacity-50 mt-0.5">
                      Nguồn: {props.source} · Kiểm chứng: {props.verification_date}
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Highlight the single next-best point. */}
        {nextFeature && (
          <Marker
            position={[nextFeature.properties.lat, nextFeature.properties.lng]}
            icon={getNextIcon()}
          >
            <Popup>
              <div className="font-sans text-xs text-foreground">
                <strong className="flex items-center gap-1 text-primary">
                  <Target className="h-3 w-3" /> Điểm khảo sát tiếp theo
                </strong>
                <span className="block opacity-80 mt-0.5">
                  #{nextFeature.properties.rank} — điểm số {nextFeature.properties.priority_score?.toFixed(3)}
                </span>
                <span className="block opacity-60 mt-0.5">
                  {nextFeature.properties.reason}
                </span>
              </div>
            </Popup>
          </Marker>
        )}

        <FitBounds features={fitPoints} />

        {loading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Đang lên kế hoạch khảo sát…</span>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  );
}
