import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export interface SpotCriteria {
  distance: number;
  rating: number;
  wifi: number;
  quietness: number;
  open_now: number;
  capacity: number;
}

export interface ScoredSpot {
  spot: LearningSpotDetail;
  score: number;
  distance_km: number;
  open_now: boolean;
  ranking_reason: string;
  matching_criteria: SpotCriteria;
  explanation?: string;
}

export interface LearningSpotDetail {
  id: string;
  name: string;
  type: string;
  address?: string;
  description?: string;
  has_wifi: boolean;
  has_power_outlets: boolean;
  quietness: number | null;
  opening_hours: Record<string, string | null> | null;
  amenities: string[];
  rating_avg: number;
  total_capacity: number;
  location: any;
}

export interface RecommendResponse {
  spots: ScoredSpot[];
  total: number;
  center: { lat: number; lng: number };
  radius_km: number;
  degraded?: boolean;
  reason?: string;
}

export interface RecommendParams {
  lat: number;
  lng: number;
  radius?: number;
  has_wifi?: boolean;
  min_rating?: number;
  quietness_min?: number;
  open_now?: boolean;
  limit?: number;
  w_distance?: number;
  w_rating?: number;
  w_wifi?: number;
  w_quietness?: number;
  w_open_now?: number;
  w_capacity?: number;
}

class LearningSpaceService {
  private readonly API_URL = '/api/learning-spaces';

  private buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        q.append(key, String(value));
      }
    }
    return q.toString();
  }

  async recommendSpots(params: RecommendParams): Promise<RecommendResponse> {
    const query = this.buildQuery({
      lat: params.lat,
      lng: params.lng,
      radius: params.radius,
      has_wifi: params.has_wifi,
      min_rating: params.min_rating,
      quietness_min: params.quietness_min,
      open_now: params.open_now,
      limit: params.limit,
      w_distance: params.w_distance,
      w_rating: params.w_rating,
      w_wifi: params.w_wifi,
      w_quietness: params.w_quietness,
      w_open_now: params.w_open_now,
      w_capacity: params.w_capacity,
    });

    const response = await fetchWithRetry(`${this.API_URL}/recommend?${query}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }
    return unwrapApiResponse<RecommendResponse>(await response.json());
  }

  async explainSpot(spot: any, preferences: any = {}): Promise<{ explanation: string; degraded: boolean; reason?: string }> {
    try {
      const response = await fetchWithRetry(`${this.API_URL}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spot, preferences }),
      });
      if (!response.ok) {
        throw new Error(`Explain API failed: ${response.status}`);
      }
      return unwrapApiResponse<{ explanation: string; degraded: boolean; reason?: string }>(await response.json());
    } catch (error: any) {
      console.error('Explain failed:', error);
      // Static fallback so the UI always has something to show
      return {
        explanation: `${spot?.name || 'Địa điểm'} được đề xuất vì phù hợp với tiêu chí tìm kiếm của bạn.`,
        degraded: true,
        reason: 'AI service không khả dụng.',
      };
    }
  }

  /** Extract [lat, lng] from a GeoJSON Point (JSON string or object). */
  extractLatLng(location: any): [number, number] | null {
    if (!location) return null;
    try {
      const loc = typeof location === 'string' ? JSON.parse(location) : location;
      if (loc?.type === 'Point' && Array.isArray(loc?.coordinates)) {
        const [lng, lat] = loc.coordinates;
        return [Number(lat), Number(lng)];
      }
    } catch {
      return null;
    }
    return null;
  }
}

export const learningSpaceService = new LearningSpaceService();
