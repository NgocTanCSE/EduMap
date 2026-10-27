'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  TrendingUp, Wifi, Laptop, BookOpen, GraduationCap,
  RefreshCw, Layers, AlertCircle, Info, ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useRequireAuth } from '@/src/lib/require-auth';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// Dynamically import the Leaflet map (SSR-incompatible).
const ResourceMap = dynamic(() => import('./ResourceMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/20">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});

// ── Constants ─────────────────────────────────────────────────────────────

const BUDGET_MIN = 5_000_000;
const BUDGET_MAX = 100_000_000;
const BUDGET_STEP = 500_000;

const PLAN_META: Record<string, { label: string; color: string; icon: React.ComponentType<any>; desc: string }> = {
  A: { label: 'Kế hoạch A', color: 'text-blue-500', icon: Layers, desc: 'Tiết kiệm (40% ngân sách)' },
  B: { label: 'Kế hoạch B', color: 'text-green-500', icon: Layers, desc: 'Cân bằng (70% ngân sách)' },
  C: { label: 'Kế hoạch C', color: 'text-red-500', icon: Layers, desc: 'Toàn diện (100% ngân sách)' },
};

const FACILITY_ICONS: Record<string, React.ComponentType<any>> = {
  wifi: Wifi,
  computer: Laptop,
  library: BookOpen,
  study_space: GraduationCap,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function formatVND(amount: number): string {
  if (!amount || amount === 0) return '0₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

// ── Plan card component ──────────────────────────────────────────────────

interface PlanCardProps {
  plan: string;
  data: any;
  active: boolean;
  onSelect: (plan: string) => void;
}

function PlanCard({ plan, data, active, onSelect }: PlanCardProps) {
  const meta = PLAN_META[plan] || PLAN_META.A;
  const Icon = FACILITY_ICONS[data?.facility_type] || meta.icon;
  const pct = data?.coverage_pct ?? 0;
  const costPct = data?.budget_used_pct ?? 0;

  return (
    <button
      onClick={() => onSelect(plan)}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        active
          ? 'border-primary bg-card shadow-lg ring-2 ring-primary/30'
          : 'border-border bg-card hover:bg-muted/30 hover:border-border'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${meta.color}`} />
          <h3 className="text-lg font-semibold text-foreground">{meta.label}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{meta.desc}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{data?.selected ?? 0}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Cơ sở</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{pct.toFixed(1)}%</div>
          <div className="text-[10px] text-muted-foreground uppercase">Phủ sóng</div>
        </div>
        <div className="col-span-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Chi phí</span>
            <span className="font-medium text-foreground">{formatVND(data?.total_cost ?? 0)}</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full transition-all ${
                costPct > 80 ? 'bg-destructive' : costPct > 50 ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(costPct, 100)}%` }}
            />
          </div>
        </div>
        <div className="col-span-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Người được phục vụ</span>
            <span className="font-medium text-foreground">
              {formatNumber(data?.total_served ?? 0)} / {formatNumber(data?.total_demand ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ResourceOptimizerPage() {
  const { user } = useRequireAuth('/auth/login');

  // Input
  const [budget, setBudget] = useState(30_000_000);

  // Result
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activePlan, setActivePlan] = useState('C');

  // Track whether the user has ever run the optimization
  const hasRun = useRef(false);

  const runOptimization = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry(
        `/api/map/resource-optimization?budget=${budget}`,
        { retries: 2 }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      setResult(data);
      hasRun.current = true;
      toast.success('Tối ưu phân bổ thành công!');
    } catch (err: any) {
      logger.error('Resource optimization error', err);
      setError(err?.message || 'Không thể tối ưu phân bổ nguồn lực.');
      toast.error('Tối ưu thất bại — vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [budget, user]);

  // Auto-run once on mount with default budget
  useEffect(() => {
    if (user && !result) {
      runOptimization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, result]);

  // Facility features filtered by active plan
  const planFeatures = useMemo(() => {
    if (!result?.features) return [];
    return result.features.filter((f: any) => f.properties?.plan === activePlan);
  }, [result, activePlan]);

  const gapFeatures = useMemo(() => {
    return result?.gaps?.features || [];
  }, [result]);

  const planResult = useMemo(() => {
    return result?.plans?.[activePlan] || null;
  }, [result, activePlan]);

  // Wait until auth is ready
  if (!user) return null;

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left panel: controls + plans ────────────────────────────── */}
      <div className="w-full lg:w-96 flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto custom-scrollbar border-r border-border bg-card">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => window.history.back()}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            title="Quay lại bản đồ"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <TrendingUp className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Tối ưu Nguồn Lực Giáo dục</h1>
        </div>

        <p className="text-xs text-muted-foreground">
          MCLP — Phân bổ ngân sách Wi-Fi, máy tính, tủ sách, không gian học tập
          để phục vụ tố đa số học sinh.
        </p>

        {/* Budget slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Ngân sách</label>
            <span className="text-sm font-bold text-primary">{formatVND(budget)}</span>
          </div>
          <input
            type="range"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={BUDGET_STEP}
            value={budget}
            onChange={(e) => setBudget(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-muted rounded-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{formatVND(BUDGET_MIN)}</span>
            <span>{formatVND(BUDGET_MAX)}</span>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runOptimization}
          disabled={loading || !user}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang tính toán…
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" /> Chạy tối ưu
            </>
          )}
        </button>

        {/* Error state */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Summary info */}
        {result?.summary && (
          <div className="text-[10px] text-muted-foreground space-y-1">
            <div>Độ phức tạp: {result.summary.candidate_count} ứng cử viên · {result.summary.demand_count} điểm nhu cầu</div>
            {result.summary.pre_filtered && (
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Đã lọc xuống ≤200 ứng cử viên
              </div>
            )}
            <div className="flex justify-between">
              <span>Thời gian: {result.summary.elapsed_ms}ms</span>
              <span>Giải thuật: {result.summary.solver}</span>
            </div>
            {result.status === 'degraded' && (
              <div className="flex items-center gap-1 text-amber-500">
                <AlertCircle className="w-3 h-3" /> <span>AI giảm tốc — hiển thị dữ liệu mẫu</span>
              </div>
            )}
          </div>
        )}

        {/* Plan selector tabs */}
        {result && (
          <>
            <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
              {(['A', 'B', 'C'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setActivePlan(p)}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    activePlan === p
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  Kế hoạch {p}
                </button>
              ))}
            </div>

            {/* Plan cards */}
            <div className="space-y-3">
              {(['A', 'B', 'C'] as const).map((p) => (
                <PlanCard
                  key={p}
                  plan={p}
                  data={result.plans?.[p]}
                  active={activePlan === p}
                  onSelect={setActivePlan}
                />
              ))}
            </div>

            {/* Gap summary */}
            {gapFeatures.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/20 border border-border">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span>Vùng chưa được phục vụ</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {gapFeatures.length} khu vực chưa có cơ sở giáo dục trong bán kính.
                  Đề xuất mở rộng kết cấu tại các vị trí này.
                </p>
              </div>
            )}

            {/* Recommendations */}
            {result.plans && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Info className="w-4 h-4 text-primary" />
                  <span>Đề xuất chiến lược</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Kế hoạch C (toàn ngân sách): phủ sóng {result.plans.C?.coverage_pct?.toFixed(1)}%</li>
                  <li>• Kết cấu chủ chốt: {result.plans.C?.selected} cơ sở, chi phí {formatVND(result.plans.C?.total_cost ?? 0)}</li>
                  {gapFeatures.length > 0 && (
                    <li>• {gapFeatures.length} khu vực chưa phục vụ — cân nhắc kế hoạch mở rộng</li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}

        {!result && !loading && hasRun.current && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Không có kết quả. Vui lòng thử lại.
          </div>
        )}
      </div>

      {/* ── Right panel: map ──────────────────────────────────────── */}
      <div className="flex-1 relative">
        <ResourceMap
          facilityFeatures={planFeatures}
          gapFeatures={gapFeatures}
          activePlan={activePlan}
          loading={loading}
        />
      </div>
    </div>
  );
}
