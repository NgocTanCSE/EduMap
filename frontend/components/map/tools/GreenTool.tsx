/**
 * Green Tool — Green challenges layer on the unified Map Hub.
 *
 * Previously a standalone page at `/green`; now the `green` tab on `/map`.
 * Fetches green challenges from `/api/green/challenges` and renders markers
 * on the shared InteractiveMap.
 *
 * Panel: challenge list, filter by status, quick stats.
 * Overlay: green challenge markers, clustered by nearby.
 */
"use client";

import React, { useState, useEffect } from "react";
import { Leaf, CheckCircle2, Clock, Users, RefreshCw, AlertCircle, Filter } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";

const _greenIcon = typeof window !== "undefined" ? L.icon({
  iconUrl: "data:image/svg+xml;base64," + btoa("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981'><path d='M12 3L2 8v9c0 4.97 3.58 9.24 8.5 10.62l.5.13.5-.13C18.42 17.24 22 12.97 22 8V8l-2-1.12V5c0-.55-.45-1-1-1h-1.5c-.28 0-.5.22-.5.5v2.5c0 .55.45 1 1 1H20l-8 4-8-4V5c0-.55-.45-1-1-1H7c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h1.5c.28 0 .5.22.5.5v1.58L12 8z'/><path d='M12 17c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3c0-.28-.03-.55-.08-.82L13 8.18V9c0 1.66-1.34 3-3 3S7 10.66 7 9V7.18L6.08 6.68C5.42 7.83 5 9.36 5 11c0 2.76 2.24 5 5 5v2zm0 5c-3.87 0-7-3.13-7-7 0-1.66.55-3.17 1.48-4.3L8 12.18V13c0 2.21 1.79 4 4 4l1.52-1.02C14.12 15.05 15 13.61 15 12c0-1.66-.55-3.17-1.48-4.3L12 8.18V5c0-2.21-1.79-4-4-4S4 2.79 4 5v2.17l1.52 1.02C6.25 7.05 7 8.45 7 10c0 1.66-.55 3.17-1.48 4.3L4.48 15.17c.93 1.17 2.44 2 4.02 2 1.58-.03 3.04-.95 3.98-2.38L14 11.83v-.82l1.52-1.02c-.36-.87-.86-1.67-1.48-2.38C16.21 8.57 17 10.17 17 12c0 2.76-2.24 5-5 5v-1.5c-.28 0-.55-.03-.82-.08-.27 1.42-.38 2.88-.38 4.38 0 1.66.55 3.17 1.48 4.3L12 17z' fill='%23ffffff'/></svg>"),
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -28],
}) : L.divIcon({
  html: "<div style='width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#10b981;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3)'><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff' width='14' height='14'><path d='M12 3L2 8v9c0 4.97 3.58 9.24 8.5 10.62l.5.13.5-.13C18.42 17.24 22 12.97 22 8V8l-2-1.12V5c0-.55-.45-1-1-1h-1.5c-.28 0-.5.22-.5.5v2.5c0 .55.45 1 1 1H20l-8 4-8-4V5c0-.55-.45-1-1-1H7c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1h1.5c.28 0 .5.22.5.5v1.58L12 8z'/><path d='M12 17c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3c0-.28-.03-.55-.08-.82L13 8.18V9c0 1.66-1.34 3-3 3S7 10.66 7 9V7.18L6.08 6.68C5.42 7.83 5 9.36 5 11c0 2.76 2.24 5 5 5v2zm0 5c-3.87 0-7-3.13-7-7 0-1.66.55-3.17 1.48-4.3L8 12.18V13c0 2.21 1.79 4 4 4l1.52-1.02C14.12 15.05 15 13.61 15 12c0-1.66-.55-3.17-1.48-4.3L12 8.18V5c0-2.21-1.79-4-4-4S4 2.79 4 5v2.17l1.52 1.02C6.25 7.05 7 8.45 7 10c0 1.66-.55 3.17-1.48 4.3L4.48 15.17c.93 1.17 2.44 2 4.02 2 1.58-.03 3.04-.95 3.98-2.38L14 11.83v-.82l1.52-1.02c-.36-.87-.86-1.67-1.48-2.38C16.21 8.57 17 10.17 17 12c0 2.76-2.24 5-5 5v-1.5c-.28 0-.55-.03-.82-.08-.27 1.42-.38 2.88-.38 4.38 0 1.66.55 3.17 1.48 4.3L12 17z' fill='%23ffffff'/></svg></div>",
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -28],
});

export function GreenPanel({
  viewport, result, onResult, loading, setLoading, error, setError,
  active, user,
}: any) {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [showLayer, setShowLayer] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!active) return;
    fetchChallenges();
  }, [active]);

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithRetry("/api/green/challenges");
      if (!response.ok) throw new Error("Không thể tải thử thách xanh");
      const data = await response.json();
      const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setChallenges(items);
      onResult(items);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tải thử thách xanh");
      toast.error("Không thể tải thử thách xanh");
    } finally {
      setLoading(false);
    }
  };

  const filtered = challenges.filter(c => {
    if (filter === "completed" && c.status !== "completed") return false;
    if (filter === "active" && c.status !== "active") return false;
    return true;
  });

  const totalPoints = challenges.reduce((sum, c) => sum + (c.points || 0), 0);

  if (!active) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-600" /> Thử thách xanh
        </h3>
        <button
          onClick={() => setShowLayer(!showLayer)}
          className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground/60"
          title={showLayer ? "Ẩn lớp xanh" : "Hiện lớp xanh"}
        >
          {showLayer ? <Leaf className="w-3 h-3 text-green-600" /> : <Leaf className="w-3 h-3" />}
        </button>
      </div>

      <div className="flex gap-1.5 text-[10px]">
        <button
          onClick={() => setFilter("all")}
          className={`px-2 py-1 rounded ${filter === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:bg-muted/30"}`}
        >
          Tất cả
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`px-2 py-1 rounded ${filter === "active" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:bg-muted/30"}`}
        >
          Đang diễn ra
        </button>
        <button
          onClick={() => setFilter("completed")}
          className={`px-2 py-1 rounded ${filter === "completed" ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:bg-muted/30"}`}
        >
          Hoàn thành
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="px-1.5 py-0.5 rounded bg-green-100/30 text-green-600">
          {totalPoints} điểm
        </span>
        <span className="text-muted-foreground/60">
          {challenges.length} thử thách
        </span>
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-1 max-h-52 overflow-y-auto">
          {filtered.map((c: any) => (
            <div key={c.id} className="text-xs p-2 rounded-lg border border-border hover:bg-muted/30">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {c.status === "completed" ? (
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                ) : (
                  <Clock className="w-3 h-3 text-orange-500" />
                )}
                {c.title}
              </div>
              {c.carbon_saved_kg > 0 && (
                <p className="text-muted-foreground/60 mt-0.5">
                  • CO₂ tiết kiệm: {c.carbon_saved_kg} kg
                </p>
              )}
              {c.participants_count > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground/60 mt-0.5">
                  <Users className="w-3 h-3" /> {c.participants_count} người
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !loading && <p className="text-xs text-muted-foreground/60">Chưa có thử thách nào.</p>
      )}

      {error && (
        <div className="flex items-center gap-1.5 p-2 text-xs text-muted-foreground/60 bg-muted/10 rounded-lg">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}

export function GreenOverlay({ result }: { result: any[]; loading: boolean; points: any[]; viewport: any }) {
  const locations = result || [];

  if (!locations.length) return null;

  return (
    <>
      {locations.map((c: any) => {
        if (!c.lat || !c.lng) return null;
        return (
          <Marker key={c.id} position={[c.lat, c.lng]} icon={_greenIcon}>
            <Popup>
              <div className="space-y-1">
                <div className="font-medium text-sm">{c.title}</div>
                <div className="text-xs text-muted-foreground/70">
                  CO₂: {c.carbon_saved_kg} kg • {c.participants_count} người tham gia
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

const GreenTool = {
  id: "green",
  label: "Xanh",
  longLabel: "Thử thách xanh",
  icon: Leaf,
  description: "Hiển thị thử thách sống xanh trên bản đồ.",
  longDescription: "Hiển thị các thử thách xanh và hoạt động sinh thái trên bản đồ.",
  authRequired: false,
  hideBaseLayers: false,
  Panel: GreenPanel,
  Overlay: GreenOverlay,
};

export default GreenTool;
