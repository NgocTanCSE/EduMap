"use client";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface HeatmapLayerProps {
  points: { lat: number; lng: number; intensity?: number }[];
}

export default function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points || points.length === 0) return;

    // Dynamically load leaflet.heat plugin — client-only (SSR-safe)
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("leaflet.heat");
    }

    let heatLayer: any;

    // Kiểm tra xem extension leaflet.heat đã được nạp chưa
    if (!L || typeof (L as any).heatLayer !== 'function') {
      console.warn("Leaflet HeatLayer is not available yet.");
      return;
    }

    try {
      // Chuyển đổi dữ liệu sang định dạng Leaflet Heat [lat, lng, intensity]
      // Lọc bỏ các tọa độ không hợp lệ (NaN hoặc undefined)
      const heatData = points
        .filter(p => !isNaN(p.lat) && !isNaN(p.lng))
        .map((p) => [p.lat, p.lng, p.intensity || 0.5]);

      if (heatData.length === 0) return;

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
    } catch (error) {
      console.error("Error adding HeatmapLayer:", error);
    }

    return () => {
      if (heatLayer && map) {
        try { map.removeLayer(heatLayer); } catch { /* layer may not have been created */ }
      }
    };
  }, [map, points]);

  return null;
}
