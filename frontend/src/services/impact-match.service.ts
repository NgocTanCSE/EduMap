import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

const API_BASE_URL = '/api/impact-match';

export interface SponsorProfile {
  id: string;
  name: string;
  description?: string;
  focus_areas: string[];
  budget_amount: number;
  budget_currency: string;
  location?: string;
  website_url?: string;
  contact_email?: string;
  status: string;
  is_verified: boolean;
  created_at: string;
}

export interface SponsorNeed {
  id: string;
  title: string;
  description?: string;
  category: string;
  urgency: string;
  cost_estimate: number;
  location?: string;
  status: string;
  tags: string[];
  apply_url?: string;
  provenance?: string;
  created_at: string;
}

export interface MatchResult {
  need_id: string;
  sponsor_id: string;
  match_score: number;
  match_reasons: string[];
  next_steps: string[];
  need?: any;
  sponsor?: any;
}

export interface RankMatchesResponse {
  ranked_matches: MatchResult[];
  pre_filter_summary: {
    total_needs: number;
    total_sponsors: number;
    pre_filtered_pairs: number;
    max_pairs: number;
  };
  degraded: boolean;
  reason?: string;
}

class ImpactMatchService {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const accessToken = authService.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    } as any;

    const response = await fetchWithRetry(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'API request failed');
    }
    return unwrapApiResponse<any>(await response.json());
  }

  // ── Sponsor Needs ──────────────────────────────────────────────
  async getNeeds(params?: {
    page?: number; limit?: number; category?: string; status?: string;
    urgency?: string; location?: string;
  }): Promise<{ items: SponsorNeed[]; meta: any }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.append('page', String(params.page));
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.category) qs.append('category', params.category);
    if (params?.status) qs.append('status', params.status);
    if (params?.urgency) qs.append('urgency', params.urgency);
    if (params?.location) qs.append('location', params.location);
    const query = qs.toString();
    const url = query ? `${API_BASE_URL}/needs?${query}` : `${API_BASE_URL}/needs`;
    return this.fetchWithAuth(url);
  }

  async getNeedById(id: string): Promise<SponsorNeed> {
    return this.fetchWithAuth(`${API_BASE_URL}/needs/${id}`);
  }

  async createNeed(data: Partial<CreateSponsorNeedPayload>): Promise<SponsorNeed> {
    return this.fetchWithAuth(`${API_BASE_URL}/needs`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Sponsor Profiles ──────────────────────────────────────────
  async getSponsors(params?: {
    page?: number; limit?: number; focus_area?: string; location?: string; is_verified?: boolean;
  }): Promise<{ items: SponsorProfile[]; meta: any }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.append('page', String(params.page));
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.focus_area) qs.append('focus_area', params.focus_area);
    if (params?.location) qs.append('location', params.location);
    if (params?.is_verified !== undefined) qs.append('is_verified', String(params.is_verified));
    const query = qs.toString();
    const url = query ? `${API_BASE_URL}/sponsors?${query}` : `${API_BASE_URL}/sponsors`;
    return this.fetchWithAuth(url);
  }

  async getSponsorById(id: string): Promise<SponsorProfile> {
    return this.fetchWithAuth(`${API_BASE_URL}/sponsors/${id}`);
  }

  async createSponsor(data: Partial<CreateSponsorProfilePayload>): Promise<SponsorProfile> {
    return this.fetchWithAuth(`${API_BASE_URL}/sponsors`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Rank ──────────────────────────────────────────────────────
  async rankMatches(params?: {
    region?: string; category?: string; max_results?: number; max_cost?: number;
  }): Promise<RankMatchesResponse> {
    return this.fetchWithAuth(`${API_BASE_URL}/rank`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }
}

export interface CreateSponsorNeedPayload {
  title: string;
  description?: string;
  category: string;
  urgency: string;
  cost_estimate: number;
  location?: string;
  tags?: string[];
  apply_url?: string;
}

export interface CreateSponsorProfilePayload {
  name: string;
  description?: string;
  focus_areas: string[];
  budget_amount: number;
  budget_currency?: string;
  location?: string;
  website_url?: string;
  contact_email?: string;
}

export const impactMatchService = new ImpactMatchService();
