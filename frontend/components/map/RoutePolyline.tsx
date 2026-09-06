"use client";
import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface RoutePolylineProps {
  geometry: any;
  color?: string;
  weight?: number;
  opacity?: number;
}

export function RoutePolyline({ geometry, color = '#3b82f6', weight = 5, opacity = 0.8 }: RoutePolylineProps) {
  const map = useMap();

  useEffect(() => {
    if (!geometry) return;

    let polyline: L.Polyline | null = null;

    if (geometry.type === 'LineString') {
      const latlngs = geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
      polyline = L.polyline(latlngs, { color, weight, opacity }).addTo(map);
    } else if (geometry.type === 'MultiLineString') {
      const latlngs = geometry.coordinates.map((line: number[][]) => 
        line.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );
      polyline = L.polyline(latlngs, { color, weight, opacity }).addTo(map);
    }

    if (polyline) {
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }

    return () => {
      if (polyline) {
        map.removeLayer(polyline);
      }
    };
  }, [geometry, map, color, weight, opacity]);

  return null;
}

interface RouteSegment {
  coordinates: [number, number][];
  duration: number;
  distance: number;
  name: string;
}

interface RouteInfo {
  geometry: any;
  duration: number;
  distance: number;
  segments: RouteSegment[];
}