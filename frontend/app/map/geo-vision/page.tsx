"use client";

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  BrainCircuit, AlertCircle, CheckCircle, Target, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useRequireAuth } from '@/src/lib/require-auth';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// Dynamically import the Leaflet map (SSR-incompatible).
const GeoVisionMap = dynamic(() => import('./GeoVisionMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/20">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});

// ── Constants ─────────────────────────────────────────────────────────────

const BIEN_HOA: [number, number] = [10.957, 106.843];

const DEFAULT_BBOX = "10.91,11.01,106.78,106.90"; // minLat,maxLat,minLng,maxLng

const LABEL_CANDIDATES = [
  'school', 'university', 'educational institution', 'college',
  'building', 'campus', 'library',
];

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtBbox(b: string): string {
  return b; // already "minLat,maxLat,minLng,maxLng"
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function GeoVisionPage() {
  const { user } = useRequireAuth('/auth/login');

  const [bbox, setBbox] = useState(DEFAULT_BBOX);
  const [zoom, setZoom] = useState(18);
  const [source, setSource] = useState<'osm' | 'bing' | 'esri'>('osm');
  const [labels, setLabels] = useState<string[]>(LABEL_CANDIDATES);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wait for auth
  if (!user) return null;

  const runDetection = useCallback(async () => {
    if (!bbox) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry('/api/geo/vision-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, zoom, source, labels }),
      });
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      if (res.ok && data) {
        setResult(data);
        const total = data.detections?.length ?? 0;
        const known = data.known?.length ?? 0;
        const new_ = data.new?.length ?? 0;
        if (data.degraded) {
          toast.warning(`AI chưa sẵn sàng — ${total} kết quả (đã biết: ${known}, mới: ${new_})`);
        } else {
          toast.success(`Hoàn thành! ${total} phát hiện (${known} đã biết, ${new_} mới)`);
        }
        // eslint-disable-next-line no-console
        logger.info?.(`GeoVision: ${total} detections, ${known} known, ${new_} new, degraded=${data.degraded}`);
      } else {
        const msg = data?.error || data?.message || json.message || 'Lỗi không xác định';
        setError(msg);
        toast.error(`GeoVision lỗi: ${msg}`);
      }
    } catch (e: any) {
      logger.error?.('GeoVision detect error', e);
      setError(e.message);
      toast.error(`Lỗi kết nối: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [bbox, zoom, source, labels]);

  const reset = () => {
    setResult(null);
    setError(null);
  };

  // ── Build detection list for side panel ────────────────────────────────
  const detections: any[] = result?.detections ?? [];
  const knownPois: any[] = detections
    .filter((d) => d.nearest_poi)
    .map((d) => d.nearest_poi)
    .filter((v, i, arr) => arr.findIndex((p) => p.id === v.id) === i);

  const knownDetections = detections.filter((d) => d.match === 'known');
  const newDetections = detections.filter((d) => d.match === 'new');

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full bg-background overflow-hidden lg:h-screen">
      {/* ── Top toolbar ── */}
      <div className="absolute top-4 left-0 z-50 flex flex-col gap-3 bg-card/95 border border-border rounded-xl px-3 py-2.5 shadow-lg backdrop-blur-sm max-w-xs">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-foreground">GeoVision AI</h1>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground/60 block mb-1">
            Vùng phân tích (bbox)
          </label>
          <input
            type="text"
            value={bbox}
            onChange={(e) => setBbox(e.target.value)}
            placeholder="minLat,maxLat,minLng,maxLng"
            className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground/60 block mb-1">
              Zoom
            </label>
            <select
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary"
            >
              {[16, 17, 18, 19, 20].map((z) => (
                <option key={z} value={z}>{z} (z={z})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground/60 block mb-1">
              Nguồn ảnh
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
              className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="osm">OSM (miễn phí, có tường rào)</option>
              <option value="esri">Esri World Imagery (ảnh vệ tinh)</option>
              <option value="bing">Bing Maps (ảnh vệ tinh, cần BING_MAPS_API_KEY)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground/60 block mb-1">
            Nhãn phát hiện (candidate_labels)
          </label>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {LABEL_CANDIDATES.map((lbl) => (
              <span
                key={lbl}
                className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                  labels.includes(lbl)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/50'
                }`}
                onClick={() => {
                  if (labels.includes(lbl)) {
                    setLabels(labels.filter((l) => l !== lbl));
                  } else {
                    setLabels([...labels, lbl]);
                  }
                }}
              >
                {lbl}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={runDetection}
          disabled={loading || !bbox}
          className="h-10 w-full text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:bg-primary/80 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.96 7.96 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : <Target className="w-4 h-4" />}
          {loading ? 'Đang phân tích...' : 'Chạy GeoVision'}
        </button>

        {(result || error) && (
          <button
            onClick={reset}
            className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Xóa kết quả
          </button>
        )}
      </div>

      {/* ── Map (main surface) ── */}
      <main className="absolute inset-0">
        <GeoVisionMap
          detections={detections}
          knownPois={knownPois}
          analysisBbox={result ? result.bbox : null}
        />
      </main>

      {/* ── Right side panel: detection results ── */}
      <div className="absolute top-4 right-4 bottom-4 z-40 w-80 max-w-sm overflow-y-auto">
        <div className="bg-card/95 border border-border rounded-xl shadow-lg backdrop-blur-sm">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Kết quả phát hiện
            </h2>
            {result && (
              <span className="text-xs text-muted-foreground">
                {result.detections?.length ?? 0} phát hiện
              </span>
            )}
          </div>

          <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
            {!result && !error && !loading && (
              <div className="text-center py-6 text-muted-foreground/65">
                <Target className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nhấn "Chạy GeoVision" để bắt đầu phân tích</p>
              </div>
            )}

            {loading && (
              <div className="text-center py-6 text-muted-foreground">
                <svg className="w-6 h-6 mx-auto mb-2 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.96 7.96 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-xs">Đang tải tile + gọi HF Inference API...</p>
              </div>
            )}

            {error && !loading && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {result && !loading && (
              <>
                {result.degraded && (
                  <div className="text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    AI đang ở chế độ giảm tải (degraded). Kết quả có thể không đầy đủ.
                  </div>
                )}

                <div className="text-xs text-muted-foreground/60">
                  Model: {result.degraded ? result.error : result.model || 'facebook/owlv2-base-c'}
                  {result.stitched_metadata && (
                    <span> · ảnh: {result.stitched_metadata.width}×{result.stitched_metadata.height}px · {result.stitched_metadata.tile_count} tiles</span>
                  )}
                </div>

                {knownDetections.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <span className="text-xs font-medium text-foreground">Đã biết ({knownDetections.length})</span>
                    </div>
                    <div className="space-y-1">
                      {knownDetections.map((d, i) => (
                        <div key={`k-${i}`} className="text-xs p-2 bg-green-500/10 rounded border border-green-500/20">
                          <div className="font-medium text-green-400">{d.label} — {pct(d.score)}</div>
                          {d.nearest_poi && (
                            <div className="text-muted-foreground/60">
                              ↔ {d.nearest_poi.name} ({d.nearest_poi.type}, {Math.round(d.nearest_poi.distance_m)}m)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {newDetections.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <AlertCircle className="w-3 h-3 text-red-400" />
                      <span className="text-xs font-medium text-foreground">Mới / tiềm năng ({newDetections.length})</span>
                    </div>
                    <div className="space-y-1">
                      {newDetections.map((d, i) => (
                        <div key={`n-${i}`} className="text-xs p-2 bg-red-500/10 rounded border border-red-500/20">
                          <div className="font-medium text-red-400">{d.label} — {pct(d.score)}</div>
                          <div className="text-muted-foreground/60">
                            Tại: {d.lat?.toFixed(5)}, {d.lng?.toFixed(5)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detections.length === 0 && !result.degraded && (
                  <div className="text-center py-4 text-muted-foreground/65 text-xs">
                    Không phát hiện công trình mới trong vùng này.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
