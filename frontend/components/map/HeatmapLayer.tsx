"use client";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
interface HeatmapLayerProps {
    points: {
        lat: number;
        lng: number;
        intensity?: number;
    }[];
}
export default function HeatmapLayer({ points }: HeatmapLayerProps) {
    const map = useMap();
    useEffect(() => {
        if (!map || !points || points.length === 0)
            return;
        if (typeof window !== "undefined") {
            require("leaflet.heat");
        }
        let heatLayer: any;
        if (!L || typeof (L as any).heatLayer !== 'function') {
            console.warn("Leaflet HeatLayer is not available yet.");
            return;
        }
        try {
            const heatData = points
                .filter(p => !isNaN(p.lat) && !isNaN(p.lng))
                .map((p) => [p.lat, p.lng, p.intensity || 0.5]);
            if (heatData.length === 0)
                return;
            heatLayer = (L as any).heatLayer(heatData, {
                radius: 25,
                blur: 15,
                maxZoom: 17,
                gradient: {
                    0.4: 'blue',
                    0.6: 'cyan',
                    0.7: 'lime',
                    0.8: 'yellow',
                    1.0: 'red'
                }
            });
            heatLayer.addTo(map);
        }
        catch (error) {
            console.error("Error adding HeatmapLayer:", error);
        }
        return () => {
            if (heatLayer && map) {
                try {
                    map.removeLayer(heatLayer);
                }
                catch { }
            }
        };
    }, [map, points]);
    return null;
}
