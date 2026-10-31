/**
 * Unified Map Hub — `/map`
 *
 * Gộp toàn bộ các tính năng bản đồ con thành một trang bản đồ duy nhất với
 * thanh tab công cụ. Các công cụ có sẵn:
 *
 * - home               — Bản đồ chính (POI duyệt, tìm kiếm, AI phân tích, voice)
 * - data-hunter        — Truy đuổi dữ liệu thiếu (Idea #6)
 * - gap-predictor      — Dự báo khoảng trống (Idea #3)
 * - resource-optimizer — Tối ưu nguồn lực (Idea #1)
 * - geo-vision         — GeoVision AI (Idea #10)
 * - survey-planner     — Kế hoạch khảo sát AI (Idea #20)
 * - climate            — AI Bảo vệ khí hậu (Idea #11)
 *
 * Mỗi công cụ cung cấp một Panel (điều khiển bên trái) và một Overlay
 * (lớp bản đồ) — cả hai được render trên cùng một InteractiveMap. Các route
 * cũ (/map/data-hunter, /map/geo-vision, …) redirect về /map?tool=<id>.
 *
 * Tuân AGENTS.md §8: .page-shell spacing, .card-surface, lucide icons,
 * bản sao tiếng Việt, icon vector only.
 */
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useDraggable } from "@/src/hooks/useDraggable";
import { useResizable } from "@/src/hooks/useResizable";
import {
  SIDEBAR_EXPANDED_WIDTH,
} from "@/src/lib/layout-constants";
import {
  Search, MapPin, X, BrainCircuit,
  ThermometerSun, Layers, Save, Info, Flame,
  Maximize, Minimize, GraduationCap, BookOpen, Users, Wifi, Atom,
  Globe, Leaf, Coffee, Star, Shield, Mic, MicOff,
  Home as HomeIcon, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { authService } from "@/src/services/auth.service";
import { useRequireAuth } from "@/src/lib/require-auth";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";
import { MAP_TOOLS, MAP_TOOL_BY_ID } from "@/components/map/tools/registry";
import type { MapTool, MapViewport } from "@/components/map/tools/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { VoiceSearchPopup } from "@/components/ui/VoiceSearchPopup";
import { FeaturedPinPopup } from "@/components/ui/FeaturedPinPopup";

const InteractiveMap = dynamic(() => import("@/components/ui/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});

// ─── Icons ──────────────────────────────────────────────────────────────────

/** Icons for facility-type POIs shown in the "selected place" detail card. */
const FACILITY_ICONS: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  wifi: { label: "WiFi", color: "text-primary", Icon: Wifi },
  library: { label: "Thư viện", color: "text-primary", Icon: BookOpen },
  bookstore: { label: "Nhà sách", color: "text-destructive", Icon: BookOpen },
  lab: { label: "Lab", color: "text-primary", Icon: Atom },
  stem: { label: "STEM", color: "text-primary", Icon: Atom },
  green: { label: "Không gian xanh", color: "text-accent", Icon: Leaf },
  park: { label: "Công viên", color: "text-accent", Icon: Leaf },
  cafe: { label: "Cà phê", color: "text-primary", Icon: Coffee },
  restaurant: { label: "Nhà hàng", color: "text-primary", Icon: Globe },
  university: { label: "Trường", color: "text-accent", Icon: GraduationCap },
  school: { label: "Trường", color: "text-accent", Icon: GraduationCap },
};
const facilityIconFor = (cat?: string) => {
  const key = String(cat || "").toLowerCase();
  return FACILITY_ICONS[key] || {
    label: cat || "Địa điểm",
    color: "text-muted-foreground",
    Icon: MapPin as React.ComponentType<{ className?: string }>,
  };
};

interface Location {
  id: string;
  name: string;
  address?: string;
  description?: string;
  category: string;
  lat: number;
  lng: number;
}

interface FeaturedPin {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description?: string;
  address?: string;
  featureLink: string;
}

const DEFAULT_CENTER: [number, number] = [10.957, 106.843];

// ─── Sub-components (unchanged from original page) ──────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mb-3">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tìm địa điểm (trường, thư viện, wifi ...)..."
        icon={Search}
        className="form-input input-with-icon"
      />
    </div>
  );
}

function SearchResults({
  results,
  onSelect,
}: { results: Location[]; onSelect: (loc: Location) => void }) {
  if (results.length === 0) return null;
  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg scrollbar-hide">
      {results.map((loc) => (
        <button
          key={loc.id}
          onClick={() => onSelect(loc)}
          className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {React.createElement(facilityIconFor(loc.category).Icon, { className: "w-4 h-4 text-primary" })}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-foreground truncate">{loc.name}</div>
            <div className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-1">
              {loc.category} · {loc.address || "Chưa có địa chỉ"}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function CategoryChips({
  categories, active, onSelect,
}: { categories: string[]; active: string; onSelect: (c: string) => void }) {
  const chips = ["all", ...categories];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const on = active === c;
        return (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize transition-all ${
              on
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted/30 text-muted-foreground hover:bg-muted border-border"
            }`}
          >
            {c === "all" ? "Tất cả" : c}
          </button>
        );
      })}
    </div>
  );
}

function AiPanel({ open, onClose, analysis, loading }: {
  open: boolean; onClose: () => void; analysis: any; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 z-[100] w-96 max-w-[95vw] bg-card border-l border-border flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" /> Phân tích khu vực AI
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">
        {loading ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-3 bg-muted rounded animate-pulse w-5/6" />
            <div className="h-3 bg-muted rounded animate-pulse w-4/6" />
          </div>
        ) : analysis ? (
          <>
            <div className="flex items-center gap-2">
              <ThermometerSun className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">
                Mật độ hoạt động: <b className="text-foreground">{analysis.density_score}</b>
              </span>
            </div>
            {analysis.summary && (
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
            )}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Gợi ý xung quanh bạn</p>
                {analysis.recommendations.map((r: any, i: number) => (
                  <div key={i} className="text-sm text-muted-foreground/70">• {r}</div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Tool Tab ───────────────────────────────────────────────────────────────

function ToolTab({
  tool, isActive, onClick, count,
}: {
  tool: MapTool; isActive: boolean; onClick: () => void; count?: number;
}) {
  const Icon = tool.icon;
  const showCount = count && count > 0 && !isActive;
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-2 shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
        isActive
          ? "bg-primary/15 text-primary border border-primary/30 shadow"
          : "text-muted-foreground hover:bg-muted/50 border border-transparent"
      }`}
      title={tool.longDescription}
    >
      <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "group-hover:text-foreground"}`} />
      <span>{tool.label}</span>
      {showCount && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[8px] font-bold text-white bg-destructive rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

function getResultCount(toolId: string, result: any): number | undefined {
  if (!result) return undefined;
  if (toolId === "data-hunter") return result?.summary?.gap_cells;
  if (toolId === "gap-predictor") return result?.risk_ranking?.length;
  if (toolId === "resource-optimizer") return result?.features?.length;
  if (toolId === "geo-vision") return result?.detections?.length;
  if (toolId === "survey-planner") return result?.features?.length;
  if (toolId === "climate") return result?.risk_ranking?.length;
  if (toolId === "wifi") return Array.isArray(result) ? result.length : undefined;
  if (toolId === "green") return Array.isArray(result) ? result.length : undefined;
  return undefined;
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function MapPage() {
  // Auth guard
  const { user } = useRequireAuth("/auth/login");

  // ─── Tool system state ───────────────────────────────────────────────────

  const [activeTool, setActiveTool] = useState("home");
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [toolResults, setToolResults] = useState<Record<string, any>>({});
  const [toolLoading, setToolLoading] = useState<Record<string, boolean>>({});
  const [toolError, setToolError] = useState<Record<string, string | null>>({});
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);

  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });
  const [showMapPanel, setShowMapPanel] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const onResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Kéo panel bản đồ tự do (yêu cầu: 2 phần di chuyển tự do, bên bản đồ ẩn được như bên chỉ đường)
  const SIDEBAR_WIDTH = windowSize.width >= 1024 ? SIDEBAR_EXPANDED_WIDTH : 16;

  const { position: mapPanelPos, onMouseDown: onMapPanelMouseDown } = useDraggable({
    initialPosition: { x: SIDEBAR_WIDTH + 16, y: 16 },
    bounds: {
      minX: SIDEBAR_WIDTH,
      minY: 0,
      maxX: Math.max(SIDEBAR_WIDTH, windowSize.width - 320),
      maxY: Math.max(0, windowSize.height - 40),
    },
  });

  // Resize sidebar (bên trái) và panel bản đồ (trái)
  const { size: sidebarSize, onResizeMouseDown: onSidebarResizeMouseDown } = useResizable({
    initialSize: { width: SIDEBAR_EXPANDED_WIDTH, height: 400 },
    minWidth: 160,
    maxWidth: 500,
  });

  const { size: mapPanelSize, onResizeMouseDown: onMapPanelResizeMouseDown } = useResizable({
    // Default to the same proportions as the Chỉ đường routing panel
    // (width 400, height calc(100dvh - 120px)) so the panel isn't "nhỏ quá" —
    // the user can still resize both axes from the handles below.
    initialSize: { width: 400, height: Math.max(480, windowSize.height - 120) },
    minWidth: 320,
    minHeight: 420,
    maxWidth: 700,
    maxHeight: Math.max(480, windowSize.height - 40),
  });

  // Read ?tool=<id> from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const toolParam = params.get("tool");
      if (toolParam && MAP_TOOL_BY_ID[toolParam]) {
        setActiveTool(toolParam);
      }
    }
  }, []);

  const ensureToolState = useCallback((toolId: string) => {
    if (toolId !== "home" && toolResults[toolId] === undefined) {
      setToolResults((prev) => ({ ...prev, [toolId]: null }));
      setToolLoading((prev) => ({ ...prev, [toolId]: false }));
      setToolError((prev) => ({ ...prev, [toolId]: null }));
    }
  }, [toolResults]);

  useEffect(() => {
    ensureToolState(activeTool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  const handleToolChange = (toolId: string) => {
    setActiveTool(toolId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (toolId === "home") url.searchParams.delete("tool");
      else url.searchParams.set("tool", toolId);
      window.history.replaceState({}, "", url);
    }
    sidebarRef.current?.scrollTo(0, 0);
  };

  // Callbacks shared with tool panels
  const handleToolResult = useCallback((toolId: string, data: any) => {
    setToolResults((prev) => ({ ...prev, [toolId]: data }));
  }, []);
  const handleToolLoading = useCallback((toolId: string, loading: boolean) => {
    setToolLoading((prev) => ({ ...prev, [toolId]: loading }));
  }, []);
  const handleToolError = useCallback((toolId: string, error: string | null) => {
    setToolError((prev) => ({ ...prev, [toolId]: error }));
  }, []);

  // ─── Base map state (Home tool) ──────────────────────────────────────────

  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [mapStats, setMapStats] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  const [pinningCoord, setPinningCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedFeaturedPin, setSelectedFeaturedPin] = useState<{ id: string; name: string; category: string; lat: number; lng: number; description?: string; address?: string; featureLink: string } | null>(null);
  const [pinForm, setPinForm] = useState({ name: "", category: "school", description: "", address: "" });
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [fixedLocations, setFixedLocations] = useState<Location[]>([]);

  const [featuredPins, setFeaturedPins] = useState<FeaturedPin[]>([]);
  const [showFeaturedPins, setShowFeaturedPins] = useState(true);

  const [fs, setFs] = useState(false);

  // Voice search (Idea #16)
  const [isRecording, setIsRecording] = useState(false);
  const [voiceResults, setVoiceResults] = useState<any[]>([]);
  const [voiceIntent, setVoiceIntent] = useState<string | null>(null);
  const [showVoiceResults, setShowVoiceResults] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [showVoicePopup, setShowVoicePopup] = useState(false);

  // Nearby facilities (derived from selectedLocation)
  const NEARBY_LIMIT_M = 1000;
  const nearbyPois = useMemo<Location[]>(() => {
    if (!selectedLocation) return [];
    const a = Number(selectedLocation.lat);
    const b = Number(selectedLocation.lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000;
    return locations
      .filter((p) => p.id !== selectedLocation.id)
      .map((p) => {
        const pa = Number(p.lat);
        const pb = Number(p.lng);
        if (!Number.isFinite(pa) || !Number.isFinite(pb)) return { p, d: Infinity };
        const d =
          Math.acos(
            Math.sin(toRad(a)) * Math.sin(toRad(pa)) +
            Math.cos(toRad(a)) * Math.cos(toRad(pa)) * Math.cos(toRad(pb - b))
          ) * R;
        return { p, d };
      })
      .filter((x) => x.d <= NEARBY_LIMIT_M)
      .sort((x, y) => x.d - y.d)
      .slice(0, 12)
      .map((x) => x.p);
  }, [selectedLocation, locations]);

  // ─── Fetch functions ─────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/map/stats");
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      if (data?.categories) {
        setCategoryCounts(data.categories);
        setMapStats(data);
      }
    } catch (err) {
      logger.error("Failed to fetch map stats", err);
    }
  }, []);

  const fetchCategoriesOnce = useCallback(async () => {
    const CACHE_KEY = "map_categories";
    const CACHE_TTL = 5 * 60 * 1000;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setCategories(data);
          setCategoriesLoaded(true);
          return;
        }
      }
      const catRes = await fetchWithRetry("/api/map/categories");
      const catDataRes = await catRes.json();
      const catData = catDataRes.data || catDataRes;
      const categoriesList = Array.isArray(catData) ? catData : [];
      setCategories(categoriesList);
      setCategoriesLoaded(true);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: categoriesList, timestamp: Date.now() }));
    } catch (error) {
      logger.error("Error fetching categories", error);
    }
  }, []);

  const lastFetchRef = useRef<{
    category: string;
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  } | null>(null);

  const fetchMapData = useCallback(
    async (
      category?: string,
      bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    ) => {
      const curCategory = category || "all";
      if (
        bounds &&
        lastFetchRef.current?.category === curCategory &&
        lastFetchRef.current.bounds &&
        lastFetchRef.current.bounds.minLat === bounds.minLat &&
        lastFetchRef.current.bounds.maxLat === bounds.maxLat &&
        lastFetchRef.current.bounds.minLng === bounds.minLng &&
        lastFetchRef.current.bounds.maxLng === bounds.maxLng
      ) {
        return;
      }
      if (bounds) {
        lastFetchRef.current = {
          category: curCategory,
          bounds: { minLat: bounds.minLat, maxLat: bounds.maxLat, minLng: bounds.minLng, maxLng: bounds.maxLng },
        };
      }
      try {
        setLoading(true);
        let url = "/api/map/pois";
        const params = new URLSearchParams();
        if (category && category !== "all") params.set("category", category);
        if (bounds) {
          params.set("minLat", String(bounds.minLat));
          params.set("maxLat", String(bounds.maxLat));
          params.set("minLng", String(bounds.minLng));
          params.set("maxLng", String(bounds.maxLng));
        }
        const qs = params.toString();
        if (qs) url += "?" + qs;
        const res = await fetchWithRetry(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data = unwrapApiResponse<any>(json);
        const list = Array.isArray(data) ? data : [];
        setLocations(list);
      } catch (err) {
        logger.error("Error fetching map data", err);
        toast.error("Không tải được dữ liệu bản đồ");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const runAiAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAiAnalysis(null);
    setGeoJsonData(null);
    try {
      const accessToken = authService.getAccessToken();
      const res = await fetchWithRetry("/api/map/ai-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ query: "Biên Hòa" }),
      });
      if (!res.ok) throw new Error(`AI analysis failed: ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      setAiAnalysis({
        density_score: data.density_score,
        summary: data.summary,
        recommendations: data.recommendations || [],
      });
      setGeoJsonData(
        data.geojson && data.geojson.type === "FeatureCollection" ? data.geojson : null,
      );
    } catch (err) {
      logger.error("AI analysis error", err);
      toast.error("Phân tích AI thất bại");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // Voice search (Idea #16)
  const startVoiceSearch = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Image 13: Show the popup inline instead of redirecting to /voice-search
      toast.error("Trình duyệt không hỗ trợ nhận dạng giọng nói. Vui lòng dùng Chrome.");
      setShowVoicePopup(true);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.onresult = (event: any) => {
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript;
        }
      }
      if (final) {
        setVoiceTranscript(final.trim());
        void sendVoiceQuery(final.trim());
      }
    };
    recognition.onerror = () => { setIsRecording(false); };
    recognition.onend = () => { setIsRecording(false); };
    try {
      recognition.start();
      setIsRecording(true);
      recognitionRef.current = recognition;
    } catch {
      setShowVoicePopup(true);
    }
  }, []);

  const stopVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const sendVoiceQuery = useCallback(async (text: string) => {
    setIsRecording(false);
    setShowVoiceResults(true);
    setVoiceResults([]);
    setVoiceIntent(null);
    try {
      const res = await fetchWithRetry(`/api/map/nl-search?q=${encodeURIComponent(text)}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      setVoiceResults(data.results || []);
      setVoiceIntent(data.intent?.intent || null);
      if (data.results?.length > 0) {
        const first = data.results[0];
        setSelectedLocation({
          id: first.id, name: first.name, category: first.category,
          lat: Number(first.lat), lng: Number(first.lng),
          description: first.description, address: first.address,
          rating_avg: first.rating_avg,
        } as any);
      }
      if (data.intent?.intent === "report_form") {
        toast("Báo cáo sự cố đã phát hiện — mở form báo cáo.");
      } else if ((data.results?.length || 0) === 0) {
        toast.info("Không tìm thấy địa điệm nào — thử từ khóa khác.");
      }
    } catch (err) {
      toast.error("Lỗi tìm kiếm bằng giọng nói — vui lòng thử lại.");
    }
  }, []);

  const fetchFixedLocations = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/map/locations");
      const json = await res.json();
      const data = unwrapApiResponse<any[]>(json);
      const list = Array.isArray(data) ? data : [];
      setFixedLocations(list.filter((p: any) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))));
    } catch (error) {
      logger.error("Error fetching fixed locations", error);
    }
  }, []);

  const fetchFeaturedPins = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/map/featured-pins");
      const json = await res.json();
      const data = unwrapApiResponse<any[]>(json);
      const list = Array.isArray(data) ? data : [];
      const valid = list.filter((p: any) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
      setFeaturedPins(valid);
    } catch (error) {
      logger.error("Error fetching featured pins", error);
    }
  }, []);

  // Initial loads
  useEffect(() => {
    fetchStats();
    fetchCategoriesOnce();
    fetchFixedLocations();
    fetchFeaturedPins();
  }, [fetchStats, fetchCategoriesOnce, fetchFeaturedPins]);

  const handleCategoryChange = (c: string) => {
    setActiveCategory(c);
    setSelectedLocation(null);
    fetchMapData(c === "all" ? undefined : c, viewport || undefined);
  };

  const handleBoundsChange = useCallback(
    (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
      setViewport(bounds);
      if (activeTool === "home") {
        fetchMapData(activeCategory === "all" ? undefined : activeCategory, bounds);
      }
    },
    [fetchMapData, activeCategory, activeTool],
  );

  const handleMapClick = (lat: number, lng: number) => {
    if (!authService.isLoggedIn()) {
      toast("Vui lòng đăng nhập để ghim vị trí mới", { description: "Chuyển hướng đến trang đăng nhập Google" });
      return;
    }
    setPinningCoord({ lat, lng });
    setPinForm({ name: "", category: "school", description: "", address: "" });
  };

  const handleSelectFixedLocation = (loc: Location) => {
    setPinningCoord({ lat: loc.lat, lng: loc.lng });
    setPinForm({
      name: loc.name, category: loc.category,
      description: loc.description || "", address: loc.address || "",
    });
  };

  const filteredLocations = locations.filter((loc) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      loc.name.toLowerCase().includes(term) ||
      (loc.category || "").toLowerCase().includes(term) ||
      (loc.address || "").toLowerCase().includes(term)
    );
  });

  const handleSavePin = async () => {
    if (!pinForm.name || !pinningCoord) {
      toast.warning("Vui lòng nhập tên địa điểm.");
      return;
    }
    try {
      setIsSavingPin(true);
      const accessToken = authService.getAccessToken();
      const res = await fetchWithRetry("/api/map/pois", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ ...pinForm, lat: pinningCoord.lat, lng: pinningCoord.lng }),
      });
      const errJson = await res.json();
      const errData = unwrapApiResponse<any>(errJson);
      if (res.ok) {
        toast.success("Đã ghim vị trí thành công!");
        setPinningCoord(null);
        fetchMapData(activeCategory === "all" ? undefined : activeCategory);
      } else {
        toast.error((errData as any)?.message || "Lỗi khi ghim vị trí.");
      }
    } catch (error) {
      logger.error("Save pin error", error);
      toast.error("Lỗi khi ghim vị trí.");
    } finally {
      setIsSavingPin(false);
    }
  };

  const toggleFullscreen = () => {
    if (!fs && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setFs(true);
    } else {
      document.exitFullscreen?.();
      setFs(false);
    }
  };

  const showHomeControls = activeTool === "home";
  const activeToolDef = activeTool === "home" ? null : MAP_TOOL_BY_ID[activeTool];
  const hideBase = activeToolDef?.hideBaseLayers ?? false;

  // Active tool overlay / panel props (must be after all useState declarations)
  const overlayNode = activeToolDef
    ? React.createElement(activeToolDef.Overlay, {
        result: toolResults[activeTool],
        viewport,
        points: locations,
        loading: toolLoading[activeTool],
        onFeatureSelect: setSelectedLocation,
      } as any)
    : null;

  const toolPanelProps = activeToolDef
    ? {
        viewport,
        result: toolResults[activeTool],
        onResult: (data: any) => handleToolResult(activeTool, data),
        loading: toolLoading[activeTool],
        setLoading: (l: boolean) => handleToolLoading(activeTool, l),
        error: toolError[activeTool],
        setError: (e: string | null) => handleToolError(activeTool, e),
        active: true,
        user,
      } as any
    : null;

  // Wait until the auth guard is ready
  if (!user) return null;

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full bg-background relative lg:h-screen overflow-hidden">
      {/* ─── Map fills entire surface (behind floating panels) ─── */}
      <main className="absolute inset-0 z-0">
        <InteractiveMap
          points={hideBase ? [] : filteredLocations}
          selectedPoint={selectedLocation}
          onSelectPoint={setSelectedLocation}
          onMapClick={handleMapClick}
          showHeatmap={showHeatmap}
          onBoundsChange={handleBoundsChange}
          apiBaseUrl="/api"
          nearbyPoints={nearbyPois}
          geoJsonData={geoJsonData}
          featuredPins={showFeaturedPins ? featuredPins : []}
          onFeaturedPinClick={(pin) => setSelectedFeaturedPin(pin as any)}
          overlay={overlayNode}
        />
      </main>

      {/* ─── Floating map panel (left): kéo tự do, ẩn/hiện được như bên chỉ đường ─── */}
      {showMapPanel && (
        <div
          ref={mapPanelRef}
          style={{
            top: mapPanelPos.y,
            left: mapPanelPos.x,
            width: mapPanelSize.width,
            height: mapPanelSize.height,
          }}
          className="fixed z-[50] max-h-[calc(100dvh-4rem)] bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col"
        >
          <div
            className="flex items-center justify-between p-3 border-b border-border bg-muted/30 cursor-move select-none"
            onMouseDown={onMapPanelMouseDown}
          >
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <HomeIcon className="w-4 h-4 text-primary" /> Bản đồ
            </h3>
            <button
              onClick={() => setShowMapPanel(false)}
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div ref={sidebarRef} className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">
            {/* Tab bar */}
            <div className="border-b border-border p-3 bg-card overflow-x-auto scrollbar-hide">
          <div className="flex flex-nowrap gap-1.5 items-center" style={{ minWidth: 'max-content' }}>
            <ToolTab
              tool={{
                id: "home", label: "Bản đồ", longLabel: "Bản đồ chính",
                icon: HomeIcon, description: "Duyệt POI, tìm kiếm, phân tích AI",
                longDescription: "Duyệt địa điểm giáo dục, tìm kiếm, phân tích AI, tìm bằng giọng nói.",
                authRequired: false, hideBaseLayers: false,
                Panel: (() => null) as any, Overlay: (() => null) as any,
              } as MapTool}
              isActive={activeTool === "home"}
              onClick={() => handleToolChange("home")}
            />
            {MAP_TOOLS.map((tool) => (
              <ToolTab
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => handleToolChange(tool.id)}
                count={getResultCount(tool.id, toolResults[tool.id])}
              />
            ))}
          </div>
        </div>

        {/* Panel content — scrollable */}
          {showHomeControls ? (
            // ─── Home tool: existing map controls ───
            <>
              {/* Search */}
              <div className="relative">
                <SearchBar value={searchTerm} onChange={setSearchTerm} />
                {searchTerm.trim() && (
                  <SearchResults
                    results={filteredLocations.slice(0, 8)}
                    onSelect={(loc) => { setSelectedLocation(loc); setSearchTerm(""); }}
                  />
                )}
              </div>

              {/* Category chips */}
              <CategoryChips categories={categories} active={activeCategory} onSelect={handleCategoryChange} />

              {/* Selected place detail */}
              {selectedLocation && (
                <div className="card-surface p-3 card-equal">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {React.createElement(facilityIconFor(selectedLocation.category).Icon, {
                        className: `w-5 h-5 ${facilityIconFor(selectedLocation.category).color}`,
                      })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground text-sm">{selectedLocation.name}</h3>
                      {selectedLocation.category && (
                        <div className="text-xs px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground/70">
                          {selectedLocation.category}
                        </div>
                      )}
                      {selectedLocation.address && (
                        <p className="text-xs text-muted-foreground/65 mt-1">{selectedLocation.address}</p>
                      )}
                      {selectedLocation.description && (
                        <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-2">
                          {selectedLocation.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedLocation(null)}
                      className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground/60"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Nearby facilities */}
              {selectedLocation && nearbyPois.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>Gần đây ({nearbyPois.length})</span>
                  </div>
                {/* Nearby facilities — render all, no max-h-48 cap so
                    default state isn't "bị cắt nội dung"; panel body scrolls. */}
                  <div className="space-y-1">
                    {nearbyPois.map((poi) => (
                      <button
                        key={poi.id}
                        onClick={() => setSelectedLocation(poi)}
                        className="w-full flex items-center gap-2 p-2 text-left rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-5 h-5 flex items-center justify-center">
                          {React.createElement(facilityIconFor(poi.category).Icon, { className: "w-3 h-3 text-primary" })}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-foreground truncate">{poi.name}</div>
                          <div className="text-xs text-muted-foreground/60">{poi.category}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI analysis trigger */}
              <button
                onClick={() => { setShowAiPanel(true); runAiAnalysis(); }}
                disabled={analyzing}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Đang phân tích AI…
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-4 h-4" /> Phân tích AI khu vực
                  </>
                )}
              </button>

              {/* Map stats */}
              {mapStats && (
                <div className="p-3 rounded-xl bg-muted/10 border border-border">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-2">
                    <Info className="w-3.5 h-3.5" />
                    <span>Thống kê khu vực</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {Object.entries(categoryCounts).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="capitalize text-muted-foreground/60">{k}</span>
                        <b className="text-foreground">{v as number}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : activeToolDef ? (
            activeToolDef.authRequired && !user ? (
              <div className="p-4 text-center text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Cần đăng nhập để sử dụng công cụ này.</p>
                <button
                  onClick={() => (window.location.href = "/auth/login")}
                  className="mt-2 text-primary hover:underline text-xs font-medium"
                >
                  Đăng nhập →
                </button>
              </div>
            ) : (
              <activeToolDef.Panel {...toolPanelProps!} />
            )
          ) : null}
        </div>
        {/* Right-edge width-resize strip — mirror of the Chỉ đường routing
            panel's left-edge `cursor-col-resize` strip. The old 4×4 SE corner
            made horizontal resize barely usable, so the user reported "chỉ có
            tăng/giảm phần dọc, không có rộng". This prominent strip (visible
            on hover) makes width resize easy; the SE corner below keeps height
            resize for the left-anchored panel. */}
        <div
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize opacity-0 hover:opacity-100 transition-opacity group select-none"
          title="Kéo để thay đổi độ rộng"
          onMouseDown={onMapPanelResizeMouseDown}
        >
          <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-1 h-10 bg-muted-foreground/40 rounded group-hover:bg-muted-foreground/60 transition-colors" />
        </div>
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize bg-primary/30 hover:bg-primary/50 rounded-tl-lg select-none transition-colors"
          title="Kéo để thay đổi kích thước"
          onMouseDown={onMapPanelResizeMouseDown}
        />
      </div>
      )}

      {!showMapPanel && (
        <button
          style={{
            /* CSS var --sidebar-width is kept in sync by the AppLayout
               Sidebar component (setSidebarWidthVar) so this button always
               aligns with the actual sidebar, whether collapsed, expanded,
               or user-resized. */
            left: 'calc(var(--sidebar-width, 240px) + 1rem)',
            top: 16,
          }}
          className="fixed z-[50] bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-primary/80 transition-colors select-none"
          onClick={() => setShowMapPanel(true)}
        >
          Mở bảng bản đồ
        </button>
      )}

      {/* ─── Floating toolbar (bottom-right) ─── */}
      <div className="fixed bottom-6 right-6 z-[70] flex flex-col items-center gap-2">
        <div className="flex flex-col gap-2 rounded-xl bg-card border border-border shadow-lg p-1.5">
          <button
            onClick={isRecording ? stopVoiceSearch : startVoiceSearch}
            title="Tìm bằng giọng nói (Voice-to-Geo)"
            className={`p-2 rounded-lg transition-colors ${isRecording ? "bg-destructive text-destructive-foreground animate-pulse" : "text-muted-foreground/60 hover:bg-muted/50"}`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            title="Bật/tắt lớp nhiệt độ"
            className={`p-2 rounded-lg transition-colors ${showHeatmap ? "bg-primary text-primary-foreground" : "text-muted-foreground/60 hover:bg-muted/50"}`}
          >
            <Flame className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const event = new CustomEvent("toggleSafeRoute");
              window.dispatchEvent(event);
            }}
            title="Chỉ đường an toàn AI (SafeRoute)"
            className="p-2 rounded-lg text-muted-foreground/60 hover:bg-muted/50 hover:text-accent transition-colors"
          >
            <Shield className="w-4 h-4" />
          </button>
          {showHomeControls && (
            <button
              onClick={() => { setShowAiPanel(true); runAiAnalysis(); }}
              title="Phân tích AI khu vực"
              className={`p-2 rounded-lg transition-colors ${showAiPanel ? "bg-primary text-primary-foreground" : "text-muted-foreground/60 hover:bg-muted/50"}`}
            >
              <BrainCircuit className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowFeaturedPins(!showFeaturedPins)}
            title={showFeaturedPins ? "Ẩn ghim đặc trưng" : "Hiện ghim đặc trưng"}
            className={`p-2 rounded-lg transition-colors ${showFeaturedPins ? "bg-primary text-primary-foreground" : "text-muted-foreground/60 hover:bg-muted/50"}`}
          >
            <Star className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            title={fs ? "Thoát toàn màn hình" : "Toàn màn hình"}
            className="p-2 rounded-lg text-muted-foreground/60 hover:bg-muted/50 transition-colors"
          >
            {fs ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ─── Voice search results overlay ─── */}
      {showVoiceResults && voiceResults.length > 0 && (
        <div className="fixed bottom-24 right-6 z-[60] w-80 max-h-96 overflow-y-auto rounded-xl border bg-card shadow-xl">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Kết quả giọng nói{voiceTranscript && `: "${voiceTranscript}"`}
              </span>
            </div>
            {voiceIntent && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground">
                {voiceIntent}
              </span>
            )}
          </div>
          <div className="p-2 space-y-2">
            {voiceResults.map((poi: any) => (
              <button
                key={poi.id}
                onClick={() => {
                  setSelectedLocation({
                    id: poi.id, name: poi.name, category: poi.category,
                    lat: Number(poi.lat), lng: Number(poi.lng),
                    description: poi.description, address: poi.address,
                    rating_avg: poi.rating_avg,
                  } as any);
                  setShowVoiceResults(false);
                }}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="font-medium text-foreground">{poi.name}</span>
                </div>
                {poi.address && (
                  <p className="text-xs text-muted-foreground mt-1">{poi.address}</p>
                )}
                {poi.distance_m !== undefined && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Cách {poi.distance_m} m
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── AI Analysis side panel (Home only) ─── */}
      {showHomeControls && (
        <AiPanel open={showAiPanel} onClose={() => setShowAiPanel(false)} analysis={aiAnalysis} loading={analyzing} />
      )}

      {/* ─── Pin modal ─── */}
      {pinningCoord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-card/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90dvh] overflow-y-auto p-5 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="h3-card">Ghim vị trí mới</h3>
              <button
                onClick={() => setPinningCoord(null)}
                className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {fixedLocations.length > 0 && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
                <label className="label-form block mb-2">Chọn từ địa điểm cố định</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {fixedLocations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => handleSelectFixedLocation(loc)}
                      className="px-2.5 py-1 text-xs rounded border border-border hover:bg-primary hover:text-primary-foreground transition-colors whitespace-nowrap"
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/65 mt-2">Nhấn một địa điểm để tự động điền.</p>
              </div>
            )}

            <label className="label-form block mb-2">Tên địa điểm</label>
            <Input
              type="text"
              value={pinForm.name}
              onChange={(e) => setPinForm({ ...pinForm, name: e.target.value })}
              placeholder="VD: Thư viện ABC"
              className="form-input mb-3"
            />
            <label className="label-form block mb-2">Danh mục</label>
            <Select
              value={pinForm.category}
              onChange={(e) => setPinForm({ ...pinForm, category: e.target.value })}
              className="form-select mb-3"
            >
              {categoriesLoaded && categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <label className="label-form block mb-2">Địa chỉ</label>
            <Input
              type="text"
              value={pinForm.address}
              onChange={(e) => setPinForm({ ...pinForm, address: e.target.value })}
              placeholder="Số nhà, đường, phường..."
              className="form-input mb-3"
            />
            <label className="label-form block mb-2">Mô tả</label>
            <Textarea
              value={pinForm.description}
              onChange={(e) => setPinForm({ ...pinForm, description: e.target.value })}
              placeholder="Mô tả ngắn gọn (giờ mở cửa, tiện ích...)"
              rows={3}
              className="form-textarea mb-3"
            />
            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => setPinningCoord(null)}
                variant="outline"
                className="flex-1 h-10 text-sm font-medium"
              >
                Hủy
              </Button>
              <Button
                onClick={handleSavePin}
                disabled={isSavingPin || !pinForm.name}
                loading={isSavingPin}
                icon={<Save className="w-4 h-4" />}
                loadingText="ĐANG LƯU..."
                className="flex-1 h-10 text-sm font-semibold bg-primary"
              >
                Lưu địa điểm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Search Popup (replaces redirect to /voice-search) */}
      <VoiceSearchPopup
        open={showVoicePopup}
        onClose={() => setShowVoicePopup(false)}
        onResult={(text, intent) => {
          setVoiceTranscript(text);
          void sendVoiceQuery(text);
        }}
      />

      {/* Featured Pin Popup (replaces redirect to feature page) */}
      <FeaturedPinPopup
        open={!!selectedFeaturedPin}
        pin={selectedFeaturedPin || null}
        onClose={() => setSelectedFeaturedPin(null)}
        onGo={(href) => {
          setSelectedFeaturedPin(null);
          window.location.href = href;
        }}
      />

    </div>
  );
}
