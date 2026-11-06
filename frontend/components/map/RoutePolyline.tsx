"use client";
import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
interface RoutePolylineProps {
    geometry: any;
    color?: string;
    weight?: number;
    opacity?: number;
}
export function RoutePolyline({ geometry, color = '#E07A5F', weight = 5, opacity = 0.8 }: RoutePolylineProps) {
    const map = useMap();
    const lastFittedRef = useRef<any>(null);
    useEffect(() => {
        if (!geometry)
            return;
        let polyline: L.Polyline | null = null;
        if (geometry.type === 'LineString') {
            const latlngs = geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [
                number,
                number
            ]);
            polyline = L.polyline(latlngs, { color, weight, opacity }).addTo(map);
        }
        else if (geometry.type === 'MultiLineString') {
            const latlngs = geometry.coordinates.map((line: number[][]) => line.map((coord: number[]) => [coord[1], coord[0]] as [
                number,
                number
            ]));
            polyline = L.polyline(latlngs, { color, weight, opacity }).addTo(map);
        }
        if (polyline) {
            const bounds = polyline.getBounds();
            const curKey = `${bounds.getNorth()}_${bounds.getSouth()}_${bounds.getEast()}_${bounds.getWest()}`;
            if (lastFittedRef.current === curKey)
                return;
            lastFittedRef.current = curKey;
            map.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 14,
                animate: false,
                duration: 0,
            });
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
    coordinates: [
        number,
        number
    ][];
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
