import { authService } from '@/src/services/auth.service';
import { unwrapApiResponse } from '@/src/lib/api-utils';

const API_BASE_URL = '/api/dashboard/impact';

export interface RegionParams {
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  deploymentDate?: string;
  region?: string;
}

export interface ImpactMetrics {
  region: string;
  bbox: number[];
  population_estimate: number;
  before: { period: string; access_rate: number; user_count: number; facility_count: number; usage_count: number; synthetic_baseline: boolean };
  after: { period: string; access_rate: number; user_count: number; facility_count: number; usage_count: number; synthetic_baseline: boolean };
  diff: { access_rate_delta: number; user_count_delta: number; usage_count_delta: number; coverage_improvement_pct: number };
  deployment_timeline: Array<{ month: string; facilities_added: number; cumulative: number }>;
  metadata: Record<string, unknown>;
}

export interface ImpactReport extends ImpactMetrics {
  people_in_radius: { before: number; after: number; delta: number; radius_km: number };
  trend: { monthly: Array<Record<string, unknown>>; growth_rate_pct: number; trend: string };
  impact_score: number;
  confidence_interval: { lower: number; upper: number; level: number; method: string };
  causal_notes: string[];
  narrative: string;
  degraded: boolean;
  reason?: string;
}

function buildQuery(p: RegionParams): string {
  const params = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  return params.toString();
}

class ImpactMeasurementService {
  private async fetchWithAuth<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
    const accessToken = authService.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    } as Record<string, string>;

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).message || 'API request failed');
    }
    return unwrapApiResponse<T>(await response.json());
  }

  /** Full AI-enriched report (T1 before/after diff + T2 trend/CI/score/narrative). */
  async getMeasure(params: RegionParams): Promise<ImpactReport> {
    const qs = buildQuery(params);
    return this.fetchWithAuth<ImpactReport>(`${API_BASE_URL}${qs ? `?${qs}` : ''}`);
  }

  /** Cached auto-scheduler report per region (GET — instant, no LLM wait). */
  async getCachedMeasure(regionId: string, refresh?: boolean): Promise<any> {
    const qs = refresh ? '?refresh=true' : '';
    return this.fetchWithAuth<any>(
      `/api/impact-measurement/auto-cached/${regionId}${qs}`
    );
  }
}

export const impactMeasurementService = new ImpactMeasurementService();
