"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Info } from 'lucide-react';

/**
 * DataHunterMap — renders the grid-based gap cells returned by
 * POST /api/ai/data/gaps (Idea #6: Missing Data Hunter).
 *
 * Gap cells are rendered as semi-transparent red polygons (high priority)
 * graded by gap_score, with a centroid marker showing the nearest-POI
 * distance.  Existing POIs are drawn as standard tear-drop pins so the user
 * can see which areas are already covered.
 */

const GAP_COLOR = '#ef4444'; // red-500
const GAP_FILL = '#ef4444';

function gapFillColor(score: number): string {
  // Higher gap_score → deeper red fill.
  const t = Math.max(0, Math.min(1, score));
  // Interpolate between a light red (low) and full red (high).
  const r = Math.round(239 + (4 - 239) * t); // 239 → 4
  const g = Math.round(166 + (120 - 166) * t); // 166 → 120
  const b = Math.round(83 + (10 - 83) * t); // 83 → 10
  return `rgba(${r}, ${g}, ${b}, 0.25)`;
}

// Auto-fit map to the bounds of all gap cells + POIs.
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

interface DataHunterMapProps {
  data: any; // GeoJSON FeatureCollection from /api/map/data-gaps
  pois: any[]; // existing POIs for context
  loading: boolean;
  error: string | null;
}

export default function DataHunterMap({ data, pois, loading, error }: DataHunterMapProps) {
  const [geoMapCenter, setGeoMapCenter] = useState<[number, number]>([10.957, 106.843]);

  // Collect all feature centroid points for auto-fit.
  const fitPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    (data?.features || []).forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[0] === 'number') {
        pts.push({ lat: coords[1], lng: coords[0] });
      }
    });
    pois.forEach((p) => {
      if (p.lat != null && p.lng != null) pts.push({ lat: p.lat, lng: p.lng });
    });
    return pts;
  }, [data, pois]);

  // Recenter on the first gap feature centroid if present.
  useEffect(() => {
    const feats = data?.features || [];
    if (feats.length > 0) {
      const first = feats[0];
      if (first?.geometry?.coordinates) {
        setGeoMapCenter([first.geometry.coordinates[1], first.geometry.coordinates[0]]);
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
        {/* Public OSM tiles — no API key required. */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Gap cell polygons (GeoJSON) — red, graded by gap_score. */}
        {data?.features?.length > 0 ? (
          <GeoJSON
            data={data}
            pathOptions={{
              color: GAP_COLOR,
              weight: 2,
              opacity: 0.8,
              fillColor: GAP_FILL,
              fillOpacity: 0.25,
            }}
            style={(feature: any) => {
              const score = feature.properties?.gap_score || 0;
              const t = Math.max(0, Math.min(1, score));
              const r = Math.round(239 + (4 - 239) * t);
              const g = Math.round(166 + (120 - 166) * t);
              const b = Math.round(83 + (10 - 83) * t);
              return {
                fillColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
                color: GAP_COLOR,
                weight: 2,
                fillOpacity: 0.3,
              };
            }}
            onEachFeature={(feature: any, layer: L.Layer) => {
              const props = feature.properties || {};
              const score = props.gap_score ?? 0;
              const priority = props.priority || 'low';
              const priorityLabel = priority === 'high' ? 'Cao' : priority === 'medium' ? 'Trung bình' : 'Thấp';
              const html = `
                <div class="font-sans text-xs text-foreground">
                  <strong class="block text-red-400">${props.area || 'Khu vực chưa biết'}</strong>
                  <span class="block opacity-80 mt-0.5">Điểm khoảng trống: ${Number(score * 100).toFixed(1)}%</span>
                  <span class="block opacity-70">Ưu tiên: <b>${priorityLabel}</b></span>
                  ${props.nearest_poi_distance_km != null ? `<span class="block opacity-70 mt-0.5">Gần nhất: ${props.nearest_poi_distance_km} km</span>` : ''}
                  <span class="block opacity-60 mt-0.5 text-[10px]">${props.reason || ''}</span>
                </div>`;
              layer.bindPopup(html);
            }}
          />
        ) : null}

        {/* Gap cell centroid markers for emphasis. */}
        {data?.features?.length > 0 && (
          <>
            {data.features.slice(0, 200).map((f: any, idx: number) => {
              const coords = f.geometry?.coordinates;
              if (!coords) return null;
              // Centroid = average of polygon ring for simple rectangles.
              let centerLat = coords[1];
              let centerLng = coords[0];
              if (f.geometry.type === 'Polygon') {
                const ring = f.geometry.coordinates[0];
                const lats = ring.map((c: number[]) => c[1]);
                const lngs = ring.map((c: number[]) => c[0]);
                centerLat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
                centerLng = lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length;
              }
              const score = f.properties?.gap_score || 0;
              const radius = 4 + score * 8;
              return (
                <Circle
                  key={`gap-ctr-${idx}`}
                  center={[centerLat, centerLng]}
                  radius={radius * 100}
                  pathOptions={{
                    color: GAP_COLOR,
                    fillColor: gapFillColor(score),
                    weight: 1,
                    fillOpacity: 0.35,
                  }}
                />
              );
            })}
          </>
        )}

        {/* Existing POI markers (context). */}
        {pois.map((poi) => {
          if (poi.lat == null || poi.lng == null) return null;
          return (
            <Circle
              key={`poi-${poi.id || poi.name}`}
              center={[poi.lat, poi.lng]}
              radius={30}
              pathOptions={{
                color: '#647490',
                fillColor: '#647494',
                weight: 1,
                fillOpacity: 0.5,
              }}
            />
          );
        })}

        <FitBounds features={fitPoints} />

        {/* Degraded overlay. */}
        {data?.metadata?.degraded && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs">
            <Info className="w-4 h-4" />
            <span>{data.metadata.reason || 'Dữ liệu đang trong chế độ giảm tốc.'}</span>
          </div>
        )}

        {/* Loading overlay. */}
        {loading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-50">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Đang phân tích khoảng trống dữ liệu…</span>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  );
}
