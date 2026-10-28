"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Search, MapPin, X, ArrowRightLeft, AlertTriangle, Clock, MapPin as MapPinIcon, Shield, Car, Info, Navigation, Save, History, Trash2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useResizable } from '@/src/hooks/useResizable';

/** Parse the "lat, lng" format accepted by the manual coordinate inputs. */
function parseCoordinate(value: string): { lat: number; lng: number } | null {
  const match = value.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1].replace(',', '.'));
  const lng = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

interface RoutingPanelProps {
  onGetRoute: (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, options: { avoidFlood: boolean; avoidTraffic: boolean; date?: string }) => void;
  onGetSafeRoute?: (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, options: { avoidFlood: boolean; avoidTraffic: boolean; safetyWeight?: number }) => void;
  /** Chọn một đề xuất lộ trình an toàn từ danh sách SafeRoute AI để áp dụng lên bản đồ. */
  onSelectSafeRoute?: (route: {
    geometry: any;
    safetyScore: number;
    safetyFactors: { distanceScore: number; durationScore: number; floodRisk: number; trafficRisk: number };
    distance: number;
    duration: number;
    explanation: string;
    isPrimary: boolean;
    estimated: boolean;
    floodWarnings?: Array<{ name: string; riskLevel: string }>;
    trafficAnalysis?: any;
  }) => void;
  onClearRoute: () => void;
  routeInfo?: {
    duration: number;
    distance: number;
    segments?: Array<{ name: string; duration: number; distance: number; congestionLevel?: number }>;
    floodWarnings?: Array<{ name: string; riskLevel: string }>;
    avoidedFloodZones?: Array<{ name: string; riskLevel: string }>;
    trafficAnalysis?: {
      totalDelay: number;
      congestionSummary: { free: number; light: number; moderate: number; heavy: number };
      segments: Array<{ roadName: string; roadType: string; congestionLevel: number; congestionLabel: string; congestionColor: string; estimatedSpeed: number; freeFlowSpeed: number }>;
    };
  } | null;
  /** SafeRoute AI: array of scored routes with safety factors. */
  safeRoutes?: Array<{
    safetyScore: number;
    safetyFactors: { distanceScore: number; durationScore: number; floodRisk: number; trafficRisk: number };
    distance: number;
    duration: number;
    explanation: string;
    isPrimary: boolean;
    estimated: boolean;
  }> | null;
  /** SafeRoute AI: LLM-generated explanation text. */
  routeExplanation?: string | null;
  isLoading?: boolean;
  isSafeRouteLoading?: boolean;
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  onSetOrigin: (lat: number, lng: number) => void;
  onSetDestination: (lat: number, lng: number) => void;
  onSwap: () => void;
  /** Bắt đầu chọn vị trí trên bản đồ (được gọi khi người dùng nhấn nút "Chọn trên bản đồ"). */
  onSelectOnMap?: (mode: 'setting_origin' | 'setting_destination') => void;
  onSaveRoute?: () => void;
  savedRoutes?: Array<{
    id: string;
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    geometry: any;
    info: { duration: number; distance: number };
    saved_at: string;
  }>;
  onLoadRoute?: (route: any) => void;
  onDeleteRoute?: (id: string) => void;
  /** When the floating SafeRoute button triggered this panel, pre-check the boxes. */
  defaultAvoidFlood?: boolean;
  defaultAvoidTraffic?: boolean;
}

export default function RoutingPanel({
  onGetRoute,
  onGetSafeRoute,
  onSelectSafeRoute,
  onClearRoute,
  routeInfo,
  safeRoutes,
  routeExplanation,
  isLoading,
  isSafeRouteLoading,
  origin,
  destination,
  onSetOrigin,
  onSetDestination,
  onSwap,
  onSaveRoute,
  savedRoutes = [],
  onLoadRoute,
  onDeleteRoute,
  defaultAvoidFlood = false,
  defaultAvoidTraffic = false,
  onSelectOnMap,
}: RoutingPanelProps) {
  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');
  // Avoidance options are shared by the single route button — when either
  // is enabled the SafeRoute AI backend is used (flood/traffic-aware).
  // This eliminates the redundancy between "Tránh khu vực ngập" / "Tránh kẹt xe"
  // checkboxes and a separate SafeRoute AI button (AGENTS.md feedback Image 2).
  const [avoidFlood, setAvoidFlood] = useState(defaultAvoidFlood);
  const [avoidTraffic, setAvoidTraffic] = useState(defaultAvoidTraffic);
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Which SafeRoute AI proposal is currently selected (index into safeRoutes).
  const [selectedSafeRouteIdx, setSelectedSafeRouteIdx] = useState<number | null>(null);

  // Resize state — user can drag the left edge to widen/narrow the panel.
  // Width clamps to [280, 480] px so content never collapses or balloons.
  const { size: panelSize, onResizeMouseDown: onResizeMouseDown } = useResizable({
    initialSize: { width: 340, height: 400 },
    minWidth: 280,
    maxWidth: 480,
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} phút`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins} phút`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const getCongestionColor = (level: number) => {
    switch (level) {
      case 0: return 'bg-accent';
      case 1: return 'bg-primary';
      case 2: return 'bg-primary/70';
      case 3: return 'bg-destructive';
      default: return 'bg-muted/50';
    }
  };

  const getCongestionLabel = (level: number) => {
    switch (level) {
      case 0: return 'Thông thoáng';
      case 1: return 'Khá thoáng';
      case 2: return 'Độn áp';
      case 3: return 'Kẹt xe';
      default: return 'Không xác định';
    }
  };

  // Keep the text fields in sync when a point is picked on the map.
  useEffect(() => {
    if (origin) setOriginInput(`${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}`);
  }, [origin]);

  useEffect(() => {
    if (destination) setDestInput(`${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}`);
  }, [destination]);

  // Sync safeRouteMode from parent (e.g. floating Shield button pressed).
  useEffect(() => {
    if (defaultAvoidFlood) setAvoidFlood(true);
    if (defaultAvoidTraffic) setAvoidTraffic(true);
  }, [defaultAvoidFlood, defaultAvoidTraffic]);

  const applyCoordinate = (type: 'origin' | 'destination') => {
    const value = type === 'origin' ? originInput : destInput;
    const coords = parseCoordinate(value);
    if (!coords) {
      toast.error('Nhập tọa độ theo dạng "vĩ độ, kinh độ". Ví dụ: 10.9574, 106.8427');
      return;
    }
    if (type === 'origin') {
      onSetOrigin(coords.lat, coords.lng);
      setOriginInput(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    } else {
      onSetDestination(coords.lat, coords.lng);
      setDestInput(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    }
  };

  const handleUseCurrentLocation = async (type: 'origin' | 'destination') => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ định vị.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (type === 'origin') {
          onSetOrigin(lat, lng);
          setOriginInput(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } else {
          onSetDestination(lat, lng);
          setDestInput(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      },
      (err) => toast.error('Không thể lấy vị trí hiện tại: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Image 2: Single consolidated route button. When avoidFlood or avoidTraffic
  // is enabled, the route is computed with SafeRoute AI (flood/traffic-aware).
  // When neither is enabled, a standard route is computed. This eliminates the
  // redundancy between the checkboxes and the separate SafeRoute AI button.
  const handleGetRoute = () => {
    if (!origin || !destination) return;
    if (avoidFlood || avoidTraffic) {
      if (onGetSafeRoute) {
        onGetSafeRoute(origin, destination, { avoidFlood, avoidTraffic, safetyWeight: 0.3 });
      }
    } else {
      onGetRoute(origin, destination, { avoidFlood, avoidTraffic });
    }
  };

  return (
    <div
      className="fixed top-[56px] right-4 z-[50] bg-card border border-border rounded-xl shadow-xl overflow-y-auto scrollbar-hide p-4 pb-4 flex flex-col"
      style={{ width: panelSize.width, height: 'calc(100dvh - 120px)' }}
    >
      {/* Left-edge resize handle — vertical drag to widen/narrow the panel */}
      <div
        className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize opacity-0 hover:opacity-100 transition-opacity group"
        onMouseDown={onResizeMouseDown}
        title="Kéo để thay đổi độ rộng"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-10 bg-muted-foreground/40 rounded group-hover:bg-muted-foreground/60 transition-colors" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" /> Chỉ đường
        </h3>
        <button
          onClick={onClearRoute}
          className="text-muted-foreground/65 hover:text-muted-foreground p-1 rounded-lg hover:bg-muted/30 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Origin */}
        <div className="relative">
          <label className="label-form block mb-2">Điểm xuất phát</label>
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-primary flex-shrink-0" />
            <Input
              type="text"
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCoordinate('origin');
              }}
              placeholder='Nhập "vĩ độ, kinh độ" hoặc click bản đồ'
              aria-label="Tọa độ điểm xuất phát"
              className="form-input flex-1 focus:border-primary focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => handleUseCurrentLocation('origin')}
              className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
            >
              Vị trí hiện tại
            </button>
            <button
              type="button"
              onClick={() => applyCoordinate('origin')}
              className="text-xs px-2 py-1 bg-muted/30 text-muted-foreground rounded hover:bg-muted/50 transition-colors"
            >
              <Search className="w-3 h-3 flex-shrink-0 mr-1" /> Dùng tọa độ
            </button>
            {onSelectOnMap && (
              <button
                onClick={() => onSelectOnMap('setting_origin')}
                className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
              >
                <MapPin className="w-3 h-3 flex-shrink-0 mr-1" /> Chọn bản đồ
              </button>
            )}
          </div>
        </div>

        {/* Swap button */}
        <button
          onClick={onSwap}
          disabled={!origin && !destination}
          className="mx-auto flex items-center justify-center text-muted-foreground/65 hover:text-foreground disabled:opacity-50"
        >
          <ArrowRightLeft className="w-5 h-5" />
        </button>

        {/* Destination */}
        <div className="relative">
          <label className="label-form block mb-2">Điểm đến</label>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-destructive flex-shrink-0" />
            <Input
              type="text"
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCoordinate('destination');
              }}
              placeholder='Nhập "vĩ độ, kinh độ" hoặc click bản đồ'
              aria-label="Tọa độ điểm đến"
              className="form-input flex-1 focus:border-destructive focus:ring-destructive/20"
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => handleUseCurrentLocation('destination')}
              className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded hover:bg-destructive/20 transition-colors"
            >
              Vị trí hiện tại
            </button>
            <button
              type="button"
              onClick={() => applyCoordinate('destination')}
              className="text-xs px-2 py-1 bg-muted/30 text-muted-foreground rounded hover:bg-muted/50 transition-colors"
            >
              <Search className="w-3 h-3 flex-shrink-0 mr-1" /> Dùng tọa độ
            </button>
            {onSelectOnMap && (
              <button
                onClick={() => onSelectOnMap('setting_destination')}
                className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
              >
                <MapPin className="w-3 h-3 flex-shrink-0 mr-1" /> Chọn bản đồ
              </button>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="border-t border-border pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
              <input
                type="checkbox"
                checked={avoidFlood}
                onChange={(e) => setAvoidFlood(e.target.checked)}
                className="w-4 h-4 text-primary border-border rounded focus:ring-primary shrink-0"
              />
              <div className="flex items-center gap-1 min-w-0">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground/80 truncate whitespace-nowrap">
                  Tránh khu vực ngập
                </span>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
              <input
                type="checkbox"
                checked={avoidTraffic}
                onChange={(e) => setAvoidTraffic(e.target.checked)}
                className="w-4 h-4 text-primary/90 border-border rounded focus:ring-primary shrink-0"
              />
              <div className="flex items-center gap-1 min-w-0">
                <Car className="w-4 h-4 text-primary/90 shrink-0" />
                <span className="text-sm text-muted-foreground/80 truncate whitespace-nowrap">
                  Tránh kẹt xe (giờ cao điểm)
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Image 2: Single consolidated route button (replaces separate "Tính lộ trình" + "SafeRoute AI") */}
        <div className="flex gap-2">
          <Button
            onClick={handleGetRoute}
            disabled={!origin || !destination}
            loading={isLoading || isSafeRouteLoading}
            icon={<Shield className="w-5 h-5" />}
            loadingText="ĐANG TÍNH..."
            className="flex-1 py-2 bg-primary text-primary-foreground font-medium"
          >
            {avoidFlood || avoidTraffic ? 'Tính lộ trình an toàn' : 'Tính lộ trình'}
          </Button>

          {/* Image 6/7: Save button placed inline next to route button, not as separate full-width button */}
          {routeInfo && origin && destination && onSaveRoute && (
            <Button
              onClick={() => {
                onSaveRoute();
                toast.success('Đã lưu lộ trình vào phiên');
              }}
              variant="outline"
              size="sm"
              className="px-2 py-1 bg-accent/10 text-accent border-accent/30 hover:bg-accent/20"
              icon={<Save className="w-3.5 h-3.5" />}
              title="Lưu lộ trình"
            />
          )}
        </div>

        {/* Route Info */}
        {routeInfo && (
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
              <Clock className="w-4 h-4 text-primary" />
              <span>Thời gian: <strong className="text-foreground">{formatDuration(routeInfo.duration)}</strong></span>
              {routeInfo.trafficAnalysis && routeInfo.trafficAnalysis.totalDelay > 60 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  +{formatDuration(routeInfo.trafficAnalysis.totalDelay)} do kẹt
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
              <MapPin className="w-4 h-4 text-destructive" />
              <span>Quãng đường: <strong className="text-foreground">{formatDistance(routeInfo.distance)}</strong></span>
            </div>

            {/* Flood Warnings */}
            {routeInfo.floodWarnings && routeInfo.floodWarnings.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2">
                <div className="flex items-center gap-2 text-xs text-destructive mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <strong>CẢNH BÁO NGẬP:</strong> Lộ trình đi qua {routeInfo.floodWarnings.length} khu vực ngập
                </div>
                <ul className="text-xs text-destructive/80 space-y-1 ml-6">
                  {routeInfo.floodWarnings.map((fw, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
                      {fw.name} ({fw.riskLevel})
                    </li>
                  ))}
                </ul>
                {routeInfo.avoidedFloodZones && routeInfo.avoidedFloodZones.length > 0 && (
                  <div className="mt-1 text-xs text-accent">
                    Đã tránh {routeInfo.avoidedFloodZones.length} khu vực ngập bằng lộ trình thay thế
                  </div>
                )}
              </div>
            )}

            {/* Traffic Analysis */}
            {routeInfo.trafficAnalysis && (
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-2">
                <div className="flex items-center gap-2 text-xs text-accent mb-2">
                  <Car className="w-4 h-4" />
                  <strong>PHÂN TÍCH KẾT XE:</strong>
                  <span className="ml-auto">
                    {routeInfo.trafficAnalysis.congestionSummary.free} thoáng •
                    {routeInfo.trafficAnalysis.congestionSummary.light} khá •
                    {routeInfo.trafficAnalysis.congestionSummary.moderate} độn •
                    {routeInfo.trafficAnalysis.congestionSummary.heavy} kẹt
                  </span>
                </div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Info className="w-3 h-3" />
                  {showDetails ? 'Ẩn chi tiết' : 'Xem chi tiết từng đoạn'}
                </button>
                {showDetails && routeInfo.trafficAnalysis.segments && (
                  <ul className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
                    {routeInfo.trafficAnalysis.segments.map((seg, i) => (
                      <li key={i} className="flex items-center justify-between p-1 bg-muted/20 rounded">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getCongestionColor(seg.congestionLevel)}`} />
                          <span className="text-muted-foreground/80">{seg.roadName || `Đoạn ${i+1}`} ({seg.roadType})</span>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getCongestionColor(seg.congestionLevel)} text-foreground`}>
                            {getCongestionLabel(seg.congestionLevel)}
                          </span>
                          <span className="text-muted-foreground/60">
                            ~{seg.estimatedSpeed}km/h
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Route Segments */}
            {routeInfo.segments && routeInfo.segments.length > 0 && (
              <details className="text-xs text-muted-foreground/60">
                <summary className="cursor-pointer font-medium text-muted-foreground/80">Chi tiết lộ trình</summary>
                <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
                  {routeInfo.segments.map((seg, i) => (
                    <li key={i} className="flex items-center justify-between p-1 bg-muted/20 rounded">
                      <span className="text-muted-foreground/80">{seg.name || `Đoạn ${i + 1}`}</span>
                      <div className="flex items-center gap-2">
                        {seg.congestionLevel !== undefined && (
                          <span className={`w-2 h-2 rounded-full ${getCongestionColor(seg.congestionLevel)}`} title={getCongestionLabel(seg.congestionLevel)} />
                        )}
                        <span>{formatDuration(seg.duration)} • {formatDistance(seg.distance)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* SafeRoute AI — Multi-Route Display */}
        {safeRoutes && safeRoutes.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              Lộ trình an toàn (SafeRoute AI)
            </h4>

            {/* Route list */}
            <div className="space-y-2">
              {safeRoutes.map((route, idx) => {
                const isBest = route.isPrimary;
                const isSelected = selectedSafeRouteIdx === idx;
                const scoreColor = route.safetyScore >= 80
                  ? 'bg-green-500/10 text-green-600'
                  : route.safetyScore >= 50
                  ? 'bg-yellow-500/10 text-yellow-600'
                  : 'bg-red-500/10 text-red-600';
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary'
                        : isBest
                          ? 'border-accent bg-accent/5 shadow-md'
                          : 'border-border bg-muted/10 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-muted-foreground">
                          #{idx + 1}
                        </span>
                        {isBest && (
                          <span className="text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.25 rounded">
                            Đề xuất
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.25 rounded">
                            Đã chọn
                          </span>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${scoreColor}`}>
                        {route.safetyScore}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground/80 mb-1">
                      <span>{formatDistance(route.distance)}</span>
                      <span>•</span>
                      <span>{formatDuration(route.duration)}</span>
                      {route.estimated && (
                        <span className="text-xs text-muted-foreground/65 italic">
                          (ước tính)
                        </span>
                      )}
                    </div>

                    {/* Safety factors row */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className={`px-1 py-0.25 rounded ${
                        route.safetyFactors.floodRisk === 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                      }`}>
                        Ngập: {route.safetyFactors.floodRisk}%
                      </span>
                      <span className={`px-1 py-0.25 rounded ${
                        route.safetyFactors.trafficRisk <= 20 ? 'bg-green-500/10 text-green-600' : route.safetyFactors.trafficRisk <= 50 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-600'
                      }`}>
                        Tắc: {route.safetyFactors.trafficRisk}%
                      </span>
                    </div>

                    {/* Per-route explanation */}
                    {route.explanation && (
                      <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                        {route.explanation}
                      </p>
                    )}

                    {/* Chọn route để áp dụng lên bản đồ */}
                    <button
                      onClick={() => {
                        setSelectedSafeRouteIdx(idx);
                        onSelectSafeRoute?.({
                          geometry: (route as any).geometry,
                          safetyScore: route.safetyScore,
                          safetyFactors: route.safetyFactors,
                          distance: route.distance,
                          duration: route.duration,
                          explanation: route.explanation,
                          isPrimary: route.isPrimary,
                          estimated: route.estimated,
                          floodWarnings: (route as any).floodWarnings,
                          trafficAnalysis: (route as any).trafficAnalysis,
                        });
                      }}
                      disabled={!onSelectSafeRoute}
                      className={`w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-muted text-muted-foreground hover:bg-muted/50 border border-border/50'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <MapPinIcon className="w-3.5 h-3.5" /> Áp dụng lên bản đồ
                        </>
                      ) : (
                        <>
                          <MapPinIcon className="w-3.5 h-3.5" /> Chọn lộ trình này
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SafeRoute AI — LLM Explanation Panel */}
        {routeExplanation && (
          <div className="border-t border-border pt-3">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-accent" />
              Lý do lựa chọn (AI)
            </h4>
            <div className="text-xs text-muted-foreground/80 leading-relaxed bg-muted/20 rounded-lg p-3 max-h-48 overflow-y-auto scrollbar-hide">
              {routeExplanation}
            </div>
          </div>
        )}

        {/* Saved Routes History */}
        {savedRoutes && savedRoutes.length > 0 && (
          <div className="border-t border-border pt-3 mt-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                Lịch sử lộ trình ({savedRoutes.length})
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1.5">
                {savedRoutes.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground/70 truncate">
                        {r.origin.lat.toFixed(4)}, {r.origin.lng.toFixed(4)} → {r.destination.lat.toFixed(4)}, {r.destination.lng.toFixed(4)}
                      </div>
                      <div className="text-[10px] text-muted-foreground/65 mt-0.5">
                        {formatDuration(r.info.duration)} • {formatDistance(r.info.distance)}
                        {' • ' + new Date(r.saved_at).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => onLoadRoute?.(r)}
                        className="p-1 text-xs text-primary hover:bg-primary/10 rounded"
                        title="Tải lộ trình"
                      >
                        <Save className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteRoute?.(r.id)}
                        className="p-1 text-xs text-destructive hover:bg-destructive/10 rounded"
                        title="Xóa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
