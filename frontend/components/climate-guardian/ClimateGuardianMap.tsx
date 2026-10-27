"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { renderToStaticMarkup } from 'react-dom/server';
import { AlertCircle, CloudRain, GraduationCap, MapPin, Cloud } from 'lucide-react';
import HeatmapLayer from '@/components/map/HeatmapLayer';

/** Tiny SVG tear-drop pin base (matches EduMap MapComponent style). */
const PIN_SVG = `<svg viewBox="0 0 24 24" class="absolute inset-0 w-6 h-6"><path fill="currentColor" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>`;

const _iconCache = new Map<string, L.DivIcon>();

function riskColorViet(score: number | string): string {
  const s = typeof score === 'number' ? score : parseFloat(score as string);
  if (isNaN(s)) return '#22c55e';
  if (s >= 0.75) return '#ef4444'; // red — rất cao
  if (s >= 0.5) return '#f59e0b'; // amber — cao
  if (s >= 0.3) return '#fb923c'; // orange — trung bình
  if (s >= 0.15) return '#38bdf8'; // cyan — thấp
  return '#22c55e'; // green — rất thấp
}

function getRiskIcon(props: any): L.DivIcon {
  const key = `climate-${props.risk_level || ''}-${props.is_safe ?? ''}`;
  const cached = _iconCache.get(key);
  if (cached) return cached;

  let colorClass = 'text-blue-400';
  let glyph = GraduationCap;
  let bgClass = 'bg-blue-500/20';

  if (props.is_safe === true) {
    glyph = GraduationCap;
    colorClass = 'text-green-400';
    bgClass = 'bg-green-500/20';
  } else if (props.is_safe === false) {
    glyph = AlertCircle;
    colorClass = 'text-red-400';
    bgClass = 'bg-red-500/20';
  } else {
    const score = props.risk_score || 0;
    if (score >= 0.75) {
      glyph = AlertCircle;
      colorClass = 'text-red-500';
      bgClass = 'bg-red-500/20';
    } else if (score >= 0.5) {
      glyph = CloudRain;
      colorClass = 'text-amber-500';
      bgClass = 'bg-amber-500/20';
    } else {
      glyph = Cloud;
      colorClass = 'text-blue-500';
      bgClass = 'bg-blue-500/20';
    }
  }

  const glyphHtml = renderToStaticMarkup(
    React.createElement(glyph, { className: 'w-2.5 h-2.5' }),
  );
  const html = `<div class="${colorClass} relative flex items-center justify-center ${bgClass} rounded-full" style="width:26px;height:26px">${PIN_SVG}<span class="relative flex items-center justify-center">${glyphHtml}</span></div>`;
  const icon = L.divIcon({
    className: 'edumap-climate-marker shadow',
    html,
    iconSize: [26, 26],
    iconAnchor: [13, 27],
    popupAnchor: [0, -32],
  });
  _iconCache.set(key, icon);
  return icon;
}

// Auto-fit map to the bounds of all features and heat points.
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

interface ClimateGuardianMapProps {
  data: any;       // GeoJSON FeatureCollection from /api/map/climate-risk
  alternatives: any; // GeoJSON from /api/map/climate/alternatives
  loading: boolean;
  error: string | null;
  onSelectAlternative: (alt: any) => void;
}

export default function ClimateGuardianMap({
  data,
  alternatives,
  loading,
  error,
  onSelectAlternative,
}: ClimateGuardianMapProps) {
  const [geoMapCenter, setGeoMapCenter] = useState<[number, number]>([10.957, 106.843]);

  const fitPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    (data?.features || []).forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[0] === 'number') {
        // Polygon: take centroid of first ring
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
          const ring = coords[0];
          const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
          const lng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
          pts.push({ lat, lng });
        }
        // Point
        else if (typeof coords[1] === 'number') {
          pts.push({ lat: coords[1], lng: coords[0] });
        }
      }
    });
    (alternatives?.features || []).forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[1] === 'number') {
        pts.push({ lat: coords[1], lng: coords[0] });
      }
    });
    return pts;
  }, [data, alternatives]);

  // Recenter on the first risk feature's centroid.
  useEffect(() => {
    const feats = data?.features || [];
    if (feats.length > 0) {
      const first = feats[0];
      const coords = first.geometry?.coordinates;
      if (coords) {
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
          // Polygon ring
          const ring = coords[0];
          const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
          const lng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
          setGeoMapCenter([lat, lng]);
        } else if (typeof coords[1] === 'number') {
          setGeoMapCenter([coords[1], coords[0]]);
        }
      }
    }
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
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Flood/weather risk heatmap (leaflet.heat) — red = high risk. */}
        <HeatmapLayer
          points={(data?.heat_points || []).map((p: any) => ({
            lat: Number(p[0]),
            lng: Number(p[1]),
            intensity: Number(p[2] || 0),
          }))}
        />

        {/* Risk-zone GeoJSON — cell polygons colored by risk. */}
        {data?.features?.length > 0 ? (
          <GeoJSON
            data={data}
            pathOptions={{
              color: '#0ea5e3',
              weight: 1,
              opacity: 0.6,
              fillColor: '#0ea5e3',
              fillOpacity: 0.12,
            }}
            pointToLayer={(feature: any, latlng: L.LatLngExpression) => {
              const props = feature.properties || {};
              const score = props.risk_score || 0;
              return L.circleMarker(latlng, {
                radius: 4 + score * 8,
                color: riskColorViet(score),
                fillColor: riskColorViet(score),
                fillOpacity: 0.4 + score * 0.3,
              });
            }}
            onEachFeature={(feature: any, layer: L.Layer) => {
              const props = feature.properties || {};
              if (!props) return;
              const score = props.risk_score_pct ?? (props.risk_score * 100).toFixed(1);
              const level = props.risk_level || 'rất thấp';
              const html = `
                <div class="font-sans text-xs text-foreground">
                  <strong class="block ${riskColorViet(props.risk_score || 0).includes('red') ? 'text-red-400' : riskColorViet(props.risk_score || 0).includes('amber') ? 'text-amber-400' : 'text-blue-400'}">
                    Rủi ro ${score}% (${level})
                  </strong>
                  <span class="block opacity-70 mt-0.5">
                    Ngập: ${props.flood_risk ? (props.flood_risk * 100).toFixed(0) : 0}% ·
                    Thời tiết: ${props.weather_risk ? (props.weather_risk * 100).toFixed(0) : 0}% ·
                    Truy cận: ${props.access_risk ? (props.access_risk * 100).toFixed(0) : 0}%
                  </span>
                  ${props.elevation_m !== null && props.elevation_m !== undefined ? `<span class="block opacity-60">Độ cao: ${props.elevation_m} m</span>` : ''}
                  ${props.nearest_facility ? `<span class="block opacity-60">Gần nhất: ${props.nearest_facility}</span>` : ''}
                </div>`;
              layer.bindPopup(html);
            }}
          />
        ) : null}

        {/* Safe alternative locations (green markers). */}
        {alternatives?.features?.length > 0 ? (
          (alternatives.features as any[]).map((f: any, idx: number) => {
            const coords = f.geometry?.coordinates;
            if (!coords || typeof coords[1] !== 'number') return null;
            const props = f.properties || {};
            return (
              <Marker
                key={`alt-${idx}`}
                position={[coords[1], coords[0]]}
                icon={getRiskIcon(props)}
                eventHandlers={{
                  click: () => onSelectAlternative(f),
                }}
              >
                <Popup>
                  <div className="font-sans text-xs text-foreground">
                    <strong className="block text-green-400">{props.name}</strong>
                    <span className="block opacity-80 mt-0.5">
                      An toàn: {(props.safety_score * 100).toFixed(0)}% ·
                      Cách: {props.distance_km} km ({props.walk_time_min} phút đi bộ)
                    </span>
                    {props.elevation_m && (
                      <span className="block opacity-60">Độ cao: {props.elevation_m} m</span>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })
        ) : null}

        <FitBounds features={fitPoints} />

        {loading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Đang tính toán bản đồ rủi ro khí hậu…</span>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  );
}
