"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { renderToStaticMarkup } from 'react-dom/server';
import { AlertCircle, GraduationCap } from 'lucide-react';
import HeatmapLayer from '@/components/map/HeatmapLayer';
import { toast } from 'sonner';

/** Tiny SVG tear-drop pin base (matches EduMap MapComponent style). */
const PIN_SVG = `<svg viewBox="0 0 24 24" class="absolute inset-0 w-6 h-6"><path fill="currentColor" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;

function riskColor(level: string): string {
  if (level === 'high') return '#ef4444'; // red
  if (level === 'medium') return '#f59e0b'; // amber
  return '#22c55e'; // green
}

const _iconCache = new Map<string, L.DivIcon>();
function getRiskIcon(riskLevel: string): L.DivIcon {
  const key = `risk-${riskLevel}`;
  const cached = _iconCache.get(key);
  if (cached) return cached;
  const colorClass = riskLevel === 'high' ? 'text-red-500' : riskLevel === 'medium' ? 'text-amber-500' : 'text-green-500';
  const glyph = renderToStaticMarkup(React.createElement(riskLevel === 'high' ? AlertCircle : GraduationCap, { className: 'w-3 h-3' }));
  const html = `<div class="${colorClass} relative flex items-center justify-center" style="width:26px;height:26px">${PIN_SVG}<span class="relative text-white flex items-center justify-center w-3 h-3">${glyph}</span></div>`;
  const icon = L.divIcon({
    className: 'edumap-gap-marker shadow',
    html,
    iconSize: [26, 26],
    iconAnchor: [13, 27],
    popupAnchor: [0, -32],
  });
  _iconCache.set(key, icon);
  return icon;
}

// Auto-fit map to the bounds of all features.
function FitBounds({ features }: { features: { lat: number; lng: number }[] }) {
  const map = useMap();
  const fitOnce = useRef(false);
  useEffect(() => {
    if (!fitOnce.current && features.length > 0) {
      fitOnce.current = true;
      const group = L.featureGroup();
      features.forEach((ll) => group.addLayer(L.marker([ll.lat, ll.lng], {})));
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      group.clearLayers();
    }
  }, [features, map]);
  return null;
}

interface GapPredictorMapProps {
  data: any; // GeoJSON FeatureCollection from /api/map/gap-forecast
  loading: boolean;
  error: string | null;
}

export default function GapPredictorMap({ data, loading, error }: GapPredictorMapProps) {
  const [geoMapCenter, setGeoMapCenter] = useState<[number, number]>([10.957, 106.843]);
  const fitPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    (data?.features || []).forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[0] === 'number') pts.push({ lat: coords[1], lng: coords[0] });
    });
    return pts;
  }, [data]);

  // Recenter on the region aggregate feature (if present).
  useEffect(() => {
    const feats = data?.features || [];
    const agg = feats.find((f: any) => f.properties?.gap_type === 'region_aggregate');
    if (agg?.geometry?.coordinates) {
      setGeoMapCenter([agg.geometry.coordinates[1], agg.geometry.coordinates[0]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

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
        center={geoMapCenter}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="z-0 leaflet-dark-tiles"
      >
        {/* Public OSM tiles — no API key required. */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Risk heatmap (leaflet.heat) — red = high gap risk. */}
        <HeatmapLayer
          points={(data?.heat_points || []).map((p: any) => ({
            lat: Number(p[0]),
            lng: Number(p[1]),
            intensity: Number(p[2] || 0),
          }))}
        />

        {/* Risk-zone GeoJSON boundaries (cluster polygons / gap points). */}
        {data?.features?.length > 0 ? (
          <GeoJSON
            data={data}
            filter={(f: any) => f.properties?.gap_type !== 'region_aggregate'}
            pathOptions={{
              color: '#0ea5e9',
              weight: 2,
              opacity: 0.8,
              fillColor: '#0ea5e9',
              fillOpacity: 0.1,
            }}
            pointToLayer={(feature: any, latlng: L.LatLngExpression) => {
              const props = feature.properties || {};
              return L.circleMarker(latlng, {
                radius: props.needs_survey ? 9 : 6,
                color: riskColor(props.risk_level || 'low'),
                fillColor: riskColor(props.risk_level || 'low'),
                fillOpacity: props.needs_survey ? 0.9 : 0.6,
              });
            }}
            onEachFeature={(feature: any, layer: L.Layer) => {
              const props = feature.properties || {};
              if (!props) return;
              const title = props.area || 'Khu vực';
              const score = props.risk_score_pct ?? (props.risk_score * 100).toFixed(1);
              const html = `
                <div class="font-sans text-xs text-foreground">
                  <strong class="block ${props.risk_level === 'high' ? 'text-red-400' : props.risk_level === 'medium' ? 'text-amber-400' : 'text-green-400'}">${title}</strong>
                  <span class="block opacity-80 mt-0.5">Rủi ro: ${score}% (${props.risk_level}) • ${props.trend}</span>
                  ${props.gap_type ? `<span class="block opacity-70">${props.gap_type}</span>` : ''}
                  ${props.point_count ? `<span class="block opacity-70 mt-0.5">${props.point_count} cơ sở</span>` : ''}
                  ${props.needs_survey ? `<span class="block opacity-80 mt-0.5 text-red-400">→ Cần khảo sát</span>` : ''}
                </div>`;
              layer.bindPopup(html);
            }}
          />
        ) : null}

        {/* Gap (needs-survey) markers on top for emphasis. */}
        {data?.features
          ?.filter((f: any) => f.properties?.needs_survey)
          .slice(0, 50)
          .map((f: any, idx: number) => {
            const coords = f.geometry?.coordinates;
            if (!coords) return null;
            return (
              <Marker
                key={`gap-${idx}`}
                position={[coords[1], coords[0]]}
                icon={getRiskIcon(f.properties.risk_level || 'high')}
              >
                <Popup>
                  <div className="font-sans text-xs">
                    <strong className="block text-red-400">Vùng cần khảo sát</strong>
                    <span className="block opacity-80 mt-0.5">
                      {f.properties.area} — rủi ro {f.properties.risk_score_pct ?? (f.properties.risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        <FitBounds features={fitPoints} />

        {loading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Đang dự báo khoảng trống…</span>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  );
}
