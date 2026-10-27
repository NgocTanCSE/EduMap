"use client";
import React, { useEffect, useState } from 'react';
import { Search, MapPin, X, ArrowRightLeft, RotateCcw, AlertTriangle, Clock, MapPin as MapPinIcon, Shield, Car, Info, Navigation, Save, History, Trash2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

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
}

export default function RoutingPanel({
  onGetRoute,
  onGetSafeRoute,
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
}: RoutingPanelProps) {
  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');
  // Default OFF in dev: EduMap's internal OSRM + flood/traffic datasets are heavy
  // and are NOT available against the public OSRM demo fallback. Toggle on to
  // opt into flood/traffic-aware routing when the full backend infra is running.
  const [avoidFlood, setAvoidFlood] = useState(false);
  const [avoidTraffic, setAvoidTraffic] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-card rounded-xl shadow-xl border border-border p-4 max-h-[90vh] overflow-y-auto">
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
          <label className="block text-xs font-medium text-muted-foreground/60 mb-1">Điểm xuất phát</label>
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-primary flex-shrink-0" />
            <input
              type="text"
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCoordinate('origin');
              }}
              placeholder='Nhập "vĩ độ, kinh độ" hoặc click bản đồ'
              aria-label="Tọa độ điểm xuất phát"
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
              <Search className="w-3 h-3 inline" /> Dùng tọa độ
            </button>
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
          <label className="block text-xs font-medium text-muted-foreground/60 mb-1">Điểm đến</label>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-destructive flex-shrink-0" />
            <input
              type="text"
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCoordinate('destination');
              }}
              placeholder='Nhập "vĩ độ, kinh độ" hoặc click bản đồ'
              aria-label="Tọa độ điểm đến"
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-destructive"
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
              <Search className="w-3 h-3 inline" /> Dùng tọa độ
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="border-t border-border pt-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidFlood}
              onChange={(e) => setAvoidFlood(e.target.checked)}
              className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
            />
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground/80">Tránh khu vực ngập</span>
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidTraffic}
              onChange={(e) => setAvoidTraffic(e.target.checked)}
              className="w-4 h-4 text-primary/90 border-border rounded focus:ring-primary"
            />
            <div className="flex items-center gap-1">
              <Car className="w-4 h-4 text-primary/90" />
              <span className="text-sm text-muted-foreground/80">Tránh kẹt xe (giờ cao điểm)</span>
            </div>
          </label>
        </div>

        {/* Get Route Button */}
        <button
          onClick={() => origin && destination && onGetRoute(origin, destination, { avoidFlood, avoidTraffic })}
          disabled={!origin || !destination || isLoading}
          className="w-full py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <RotateCcw className="w-5 h-5 animate-spin" />
              Đang tính lộ trình...
            </>
          ) : (
            'Tính lộ trình'
          )}
        </button>

        {/* SafeRoute AI Button (Idea #12) */}
        {onGetSafeRoute && (
          <button
            onClick={() => origin && destination && onGetSafeRoute(origin, destination, { avoidFlood, avoidTraffic, safetyWeight: 0.3 })}
            disabled={!origin || !destination || isSafeRouteLoading}
            className="w-full py-2 bg-accent text-accent-foreground font-medium rounded-lg hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSafeRouteLoading ? (
              <>
                <RotateCcw className="w-5 h-5 animate-spin" />
                Đang tính lộ trình an toàn...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                SafeRoute AI
              </>
            )}
          </button>
        )}

        {/* Save Route Button (visible when a route is active but not yet explicitly saved) */}
        {routeInfo && origin && destination && (
          <button
            onClick={() => {
              if (onSaveRoute) onSaveRoute();
              toast.success('Đã lưu lộ trình vào phiên');
            }}
            className="w-full py-2 bg-accent/10 text-accent font-medium rounded-lg hover:bg-accent/20 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Lưu lộ trình này
          </button>
        )}

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
                  <ul className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto">
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
                <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
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
                const scoreColor = route.safetyScore >= 80
                  ? 'bg-green-500/10 text-green-600'
                  : route.safetyScore >= 50
                  ? 'bg-yellow-500/10 text-yellow-600'
                  : 'bg-red-500/10 text-red-600';
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border transition-all ${
                      isBest
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
            <div className="text-xs text-muted-foreground/80 leading-relaxed bg-muted/20 rounded-lg p-3 max-h-48 overflow-y-auto">
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
