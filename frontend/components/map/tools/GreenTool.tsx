/**
 * Green Tool — Green challenges layer on the unified Map Hub.
 *
 * Previously a standalone page at `/green`; now the `green` tab on `/map`.
 * Fetches green challenges from `/api/green/challenges` and renders markers
 * on the shared InteractiveMap.
 *
 * Panel: challenge list, filter by status, quick stats.
 * Overlay: green challenge markers with status halos (only renders when the
 * featured-pins layer is hidden for the "green" category — avoids duplicate
 * markers). Uses the centralised PinTheme for consistent star icons + badges.
 */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Leaf, CheckCircle2, Clock, Users, RefreshCw, AlertCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { Marker, Popup, Tooltip, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import type { ToolPanelProps, ToolOverlayProps } from "./types";
import { createPinIcon, createClusterIcon, type PinBadge } from "./PinTheme";

interface GreenChallenge {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "upcoming";
  carbon_saved_kg: number;
  participants_count: number;
  points?: number;
  lat: number;
  lng: number;
  address?: string;
  created_by?: string;
}

// ─── Status halo — rendered as a Circle around each marker to give a
//     quick at-a-glance view of challenge status without duplicating the
//     star glyph itself (the FeaturedPinsLayer handles the star markers).
const STATUS_HALO_COLOR: Record<string, { color: string; label: string }> = {
  active:    { color: "#10b981", label: "Đang diễn ra" },
  completed: { color: "#22c55e", label: "Hoàn thành" },
  upcoming:  { color: "#f59e0b", label: "Sắp diễn ra" },
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: "Tất cả",
  active: "Đang diễn ra",
  completed: "Hoàn thành",
  upcoming: "Sắp diễn ra",
};

/** Determine the badge for a green challenge based on its status. */
function greenBadge(challenge: GreenChallenge): PinBadge | undefined {
  switch (challenge.status) {
    case "completed": return { type: "verified" };
    case "active":    return { type: "progress", value: Math.min(100, Math.round((challenge.participants_count / 50) * 100)) };
    case "upcoming":  return { type: "new" };
    default:          return undefined;
  }
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export function GreenPanel({
  viewport, result, onResult, loading, setLoading, error, setError,
  active, user,
}: ToolPanelProps) {
  const [challenges, setChallenges] = useState<GreenChallenge[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!active) return;
    fetchChallenges();
  }, [active]);

  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithRetry("/api/green/challenges");
      if (!response.ok) throw new Error("Không thể tải thử thách xanh");
      const data = await response.json();
      const items: GreenChallenge[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setChallenges(items);
      onResult(items);
    } catch (err: any) {
      setError(err.message || "Lỗi khi tải thử thách xanh");
      toast.error("Không thể tải thử thách xanh");
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, onResult]);

  const filtered = challenges.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  const totalPoints = challenges.reduce((sum, c) => sum + (c.points || 0), 0);
  const totalCarbon = challenges.reduce((sum, c) => sum + (c.carbon_saved_kg || 0), 0);
  const totalParticipants = challenges.reduce((sum, c) => sum + (c.participants_count || 0), 0);

  if (!active) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-600" /> Thử thách xanh
        </h3>
        <button
          onClick={fetchChallenges}
          disabled={loading}
          className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground"
          title="Làm mới"
        >
          {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-lg bg-muted/20">
          <div className="font-bold text-green-600">{totalCarbon} kg</div>
          <div className="text-muted-foreground/60">CO₂ tiết kiệm</div>
        </div>
        <div className="p-2 rounded-lg bg-muted/20">
          <div className="font-bold text-green-600">{totalParticipants}</div>
          <div className="text-muted-foreground/60">Người tham gia</div>
        </div>
        <div className="p-2 rounded-lg bg-muted/20">
          <div className="font-bold text-green-600">{totalPoints}</div>
          <div className="text-muted-foreground/60">Điểm xanh</div>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 text-[10px] flex-wrap">
        {Object.entries(STATUS_FILTER_LABELS).map(([key, label]) => {
          const on = filter === key;
          const halo = STATUS_HALO_COLOR[key] || STATUS_HALO_COLOR.active;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2 py-1 rounded transition-all ${
                on
                  ? "bg-green-100/30 text-green-600 border border-green-600/30 shadow"
                  : "text-muted-foreground/60 hover:bg-muted/30 border border-transparent"
              }`}
            >
              {key !== "all" && (
                <span className="w-1.5 h-1.5 rounded-full inline-block mr-1"
                      style={{ backgroundColor: halo.color }} />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Challenge list */}
      {filtered.length > 0 ? (
        <div className="space-y-1 max-h-52 overflow-y-auto scrollbar-hide">
          {filtered.map((c) => (
            <div key={c.id} className="text-xs p-2 rounded-lg border border-border hover:bg-muted/30">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {c.status === "completed" ? (
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                ) : c.status === "active" ? (
                  <Clock className="w-3 h-3 text-orange-500" />
                ) : (
                  <BarChart3 className="w-3 h-3 text-blue-500" />
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
              {c.points > 0 && (
                <p className="text-muted-foreground/60 mt-0.5">
                  • {c.points} điểm
                </p>
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

// ─── Overlay ─────────────────────────────────────────────────────────────────

export function GreenOverlay({ result, loading, points, viewport }: ToolOverlayProps) {
  const challenges: GreenChallenge[] = result || [];

  if (!challenges.length) return null;

  // The overlay only renders status-halo circles + ring icons around each
  // challenge. The star glyph + popup is owned by FeaturedPinsLayer (which
  // hides "green" pins when this tool is active). This avoids duplicate
  // markers while still giving the tool tab a distinct map presence.
  return (
    <>
      {challenges.map((c) => {
        const lat = Number(c.lat);
        const lng = Number(c.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const halo = STATUS_HALO_COLOR[c.status] || STATUS_HALO_COLOR.active;
        const icon = createPinIcon("green", greenBadge(c));

        return (
          <React.Fragment key={c.id}>
            {/* Semi-transparent status halo circle */}
            <Circle
              center={[lat, lng]}
              radius={220}
              pathOptions={{
                color: halo.color,
                fillColor: halo.color,
                fillOpacity: 0.08,
                weight: 2,
                dashArray: "4 4",
              }}
            />
            {/* Star pin via PinTheme (rendered by this overlay since featured
                pins hide green when the green tool tab is active) */}
            <Marker
              position={[lat, lng]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  // The popup handles the click; no extra action needed.
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -30]} opacity={1} className="green-status-tooltip">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: halo.color }} />
                  <span className="font-bold">{c.title}</span>
                  <span className="text-muted-foreground/70">[{halo.label}]</span>
                </div>
              </Tooltip>
              <Popup>
                <div className="space-y-1 max-w-xs">
                  <div className="font-medium text-sm">{c.title}</div>
                  <div className="text-xs text-muted-foreground/70">
                    {halo.label} · CO₂: {c.carbon_saved_kg} kg
                  </div>
                  {c.participants_count > 0 && (
                    <div className="text-xs text-muted-foreground/70">
                      {c.participants_count} người tham gia
                    </div>
                  )}
                  {c.points > 0 && (
                    <div className="text-xs text-muted-foreground/70">
                      • {c.points} điểm
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
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
