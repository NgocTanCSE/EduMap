import { authService } from '@/src/services/auth.service';
import { unwrapApiResponse } from '@/src/lib/api-utils';

const API_BASE_URL = '/api/dashboard';

export type DashboardOverview = {
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string | null;
    role?: string;
  } | null;
  stats: {
    learning_materials: number;
    skills_mastered: number;
    community_contributions: number;
    certificates_earned: number;
  };
  active_goals: Array<Record<string, unknown>>;
  upcoming_mentoring: Array<{
    id: string;
    mentor_name: string;
    start: string;
    meeting_url?: string | null;
  }>;
};

export type DailyInsight = {
  motivation_message: string;
  suggested_action: string;
};

export type DashboardHistoryItem = {
  type: string;
  title: string | null;
  status: string;
  created_at: string;
};

class DashboardService {
  private async fetchWithAuth<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
    const accessToken = authService.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      ...options.headers,
    } as any;

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'API request failed');
    }

    // The BFF route normally returns the raw payload, but when a request falls
    // through the Next rewrite to NestJS it arrives wrapped as
    // { success, data, timestamp }. Unwrap both shapes here so callers always
    // receive the payload itself.
    return unwrapApiResponse<T>(await response.json());
  }

  async getOverview(): Promise<DashboardOverview> {
    return this.fetchWithAuth<DashboardOverview>(`${API_BASE_URL}/overview`);
  }

  async getDailyInsight(): Promise<DailyInsight> {
    return this.fetchWithAuth<DailyInsight>(`${API_BASE_URL}/insight`);
  }

  async getHistory(): Promise<DashboardHistoryItem[]> {
    const data = await this.fetchWithAuth<any>(`${API_BASE_URL}/history`);

    // Accept the raw array (normal BFF response) plus the two common wrapper
    // shapes. This guarantees the dashboard never calls `.map()` on an object.
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }
}

export const dashboardService = new DashboardService();
