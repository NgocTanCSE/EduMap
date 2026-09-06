"use client";
import React, { useState } from 'react';
import { Search, MapPin, X, ArrowRightLeft, RotateCcw, AlertTriangle, Clock, MapPin as MapPinIcon, Shield, Car, Info, Navigation } from 'lucide-react';

interface RoutingPanelProps {
  onGetRoute: (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, options: { avoidFlood: boolean; avoidTraffic: boolean; date?: string }) => void;
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
  isLoading?: boolean;
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  onSetOrigin: (lat: number, lng: number) => void;
  onSetDestination: (lat: number, lng: number) => void;
  onSwap: () => void;
}

export default function RoutingPanel({
  onGetRoute,
  onClearRoute,
  routeInfo,
  isLoading,
  origin,
  destination,
  onSetOrigin,
  onSetDestination,
  onSwap,
}: RoutingPanelProps) {
  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');
  const [avoidFlood, setAvoidFlood] = useState(true);
  const [avoidTraffic, setAvoidTraffic] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

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
      case 0: return 'bg-green-500';
      case 1: return 'bg-yellow-500';
      case 2: return 'bg-orange-500';
      case 3: return 'bg-red-500';
      default: return 'bg-gray-400';
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

  const handleOriginSearch = () => {
    alert('Tìm kiếm địa điểm - tính năng sẽ thêm sau');
  };

  const handleDestSearch = () => {
    alert('Tìm kiếm địa điểm - tính năng sẽ thêm sau');
  };

  const handleUseCurrentLocation = async (type: 'origin' | 'destination') => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ định vị');
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
      (err) => alert('Không thể lấy vị trí hiện tại: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-4 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-zinc-900 dark:text-white text-lg flex items-center gap-2">
          <Navigation className="w-5 h-5" /> Chỉ đường
        </h3>
        <button
          onClick={onClearRoute}
          className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Origin */}
        <div className="relative">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Điểm xuất phát</label>
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <input
              type="text"
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              placeholder="Click vào bản đồ hoặc nhập tọa độ"
              className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              readOnly
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => handleUseCurrentLocation('origin')}
              className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              Vị trí hiện tại
            </button>
            <button
              onClick={handleOriginSearch}
              className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              <Search className="w-3 h-3 inline" /> Tìm
            </button>
          </div>
        </div>

        {/* Swap button */}
        <button
          onClick={onSwap}
          disabled={!origin && !destination}
          className="mx-auto flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
        >
          <ArrowRightLeft className="w-5 h-5" />
        </button>

        {/* Destination */}
        <div className="relative">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Điểm đến</label>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-500 flex-shrink-0" />
            <input
              type="text"
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              placeholder="Click vào bản đồ hoặc nhập tọa độ"
              className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              readOnly
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => handleUseCurrentLocation('destination')}
              className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800"
            >
              Vị trí hiện tại
            </button>
            <button
              onClick={handleDestSearch}
              className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              <Search className="w-3 h-3 inline" /> Tìm
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidFlood}
              onChange={(e) => setAvoidFlood(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500"
            />
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Tránh khu vực ngập</span>
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidTraffic}
              onChange={(e) => setAvoidTraffic(e.target.checked)}
              className="w-4 h-4 text-orange-600 border-zinc-300 rounded focus:ring-orange-500"
            />
            <div className="flex items-center gap-1">
              <Car className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Tránh kẹt xe (giờ cao điểm)</span>
            </div>
          </label>
        </div>

        {/* Get Route Button */}
        <button
          onClick={() => origin && destination && onGetRoute(origin, destination, { avoidFlood, avoidTraffic })}
          disabled={!origin || !destination || isLoading}
          className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        {/* Route Info */}
        {routeInfo && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Thời gian: <strong>{formatDuration(routeInfo.duration)}</strong></span>
              {routeInfo.trafficAnalysis && routeInfo.trafficAnalysis.totalDelay > 60 && (
                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded">
                  +{formatDuration(routeInfo.trafficAnalysis.totalDelay)} do kẹt
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <MapPin className="w-4 h-4 text-red-500" />
              <span>Quãng đường: <strong>{formatDistance(routeInfo.distance)}</strong></span>
            </div>

            {/* Flood Warnings */}
            {routeInfo.floodWarnings && routeInfo.floodWarnings.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <strong>CẢNH BÁO NGẬP:</strong> Lộ trình đi qua {routeInfo.floodWarnings.length} khu vực ngập
                </div>
                <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 ml-6">
                  {routeInfo.floodWarnings.map((fw, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      {fw.name} ({fw.riskLevel})
                    </li>
                  ))}
                </ul>
                {routeInfo.avoidedFloodZones && routeInfo.avoidedFloodZones.length > 0 && (
                  <div className="mt-1 text-xs text-green-700 dark:text-green-400">
                    ✓ Đã tránh {routeInfo.avoidedFloodZones.length} khu vực ngập bằng lộ trình thay thế
                  </div>
                )}
              </div>
            )}

            {/* Traffic Analysis */}
            {routeInfo.trafficAnalysis && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 mb-2">
                  <Car className="w-4 h-4" />
                  <strong>PHÂN TÍCH KẺT XE:</strong> 
                  <span className="ml-auto">
                    {routeInfo.trafficAnalysis.congestionSummary.free} thoáng •
                    {routeInfo.trafficAnalysis.congestionSummary.light} khá •
                    {routeInfo.trafficAnalysis.congestionSummary.moderate} độn •
                    {routeInfo.trafficAnalysis.congestionSummary.heavy} kẹt
                  </span>
                </div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Info className="w-3 h-3" />
                  {showDetails ? 'Ẩn chi tiết' : 'Xem chi tiết từng đoạn'}
                </button>
                {showDetails && routeInfo.trafficAnalysis.segments && (
                  <ul className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                    {routeInfo.trafficAnalysis.segments.map((seg, i) => (
                      <li key={i} className="flex items-center justify-between p-1 bg-white/50 dark:bg-zinc-800/50 rounded">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getCongestionColor(seg.congestionLevel)}`} />
                          <span>{seg.roadName || `Đoạn ${i+1}`} ({seg.roadType})</span>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getCongestionColor(seg.congestionLevel)} text-white`}>
                            {getCongestionLabel(seg.congestionLevel)}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400">
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
              <details className="text-xs text-zinc-600 dark:text-zinc-400">
                <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">Chi tiết lộ trình</summary>
                <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                  {routeInfo.segments.map((seg, i) => (
                    <li key={i} className="flex items-center justify-between p-1 bg-zinc-50 dark:bg-zinc-800 rounded">
                      <span>{seg.name || `Đoạn ${i + 1}`}</span>
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
      </div>
    </div>
  );
}