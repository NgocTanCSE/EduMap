import { authService } from '@/src/services/auth.service';

const API_URL = '/api';

export interface User {
  id: string;
  email: string;
  full_name: string;
  status: string;
  role: string;
  created_at: string;
  last_login: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const getHeaders = () => {
    const token = authService.getAccessToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const adminService = {
  getUsers: async (params: { page?: number; limit?: number; search?: string; role?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/admin/users?${query}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json() as Promise<PaginatedResponse<User>>;
  },

  updateUserStatus: async (userId: string, status: string, reason?: string) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, reason }),
    });
    if (!response.ok) throw new Error('Failed to update user status');
    return response.json();
  },

  getStats: async () => {
    const response = await fetch(`${API_URL}/admin/dashboard`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  getAuditLogs: async (params: { page?: number; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/audit-logs?${query}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch audit logs');
    return response.json();
  },

  getRoles: async () => {
    const response = await fetch(`${API_URL}/roles`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch roles');
    return response.json() as Promise<{ id: number; name: string; description: string }[]>;
  },

  createRole: async (name: string, description: string) => {
    const response = await fetch(`${API_URL}/roles`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) throw new Error('Failed to create role');
    return response.json();
  },

  getDataQualityReport: async (params?: { category?: string; limit?: number; include_clean?: boolean }) => {
    const response = await fetch(`${API_URL}/admin/data-quality/report`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params || {}),
    });
    if (!response.ok) throw new Error('Failed to fetch data quality report');
    return response.json() as Promise<DataQualityReport>;
  },

  getQuestionGaps: async (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    const response = await fetch(`${API_URL}/admin/question-gaps${query}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch question gaps report');
    return response.json() as Promise<QuestionGapReport>;
  }
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface Anomaly {
  id: string;
  name: string | null;
  category: string;
  lat: number | null;
  lng: number | null;
  address: string | null;
  city: string | null;
  district: string | null;
  source: string;
  updated_at: string | null;
  created_at: string | null;
  anomaly_types: string[];
  reasons: string[];
  confidence: number;
  priority: 'high' | 'medium' | 'low';
  iforest_score: number | null;
}

export interface QualitySummary {
  total_checked: number;
  total_anomalies: number;
  anomaly_rate: number;
  by_category: Record<string, number>;
  priority_breakdown: { high: number; medium: number; low: number };
  degraded: boolean;
}

export interface DataQualityReport {
  summary: QualitySummary;
  anomalies: Anomaly[];
  source_counts: Record<string, number>;
}

// ── AI Question Gap Report (Idea #17) ───────────────────────────────────────

export interface QuestionGapCluster {
  cluster_id: number;
  topic: string;
  total_queries: number;
  gap_count: number;
  gap_rate: number;
  top_terms: string[];
  representative_query: string;
  gap_queries: string[];
  recommended_docs: string[];
}

export interface QuestionGapItem {
  query_text: string;
  retrieved_doc_count: number;
  retrieval_status: string;
  response_quality: number;
  created_at: string | null;
}

export interface QuestionGapPrivacy {
  user_id_hashed: boolean;
  hash_algorithm: string;
  ttl_days: number;
}

export interface QuestionGapReport {
  status: string;
  degraded: boolean;
  reason?: string;
  generated_at: string;
  total_queries: number;
  date_range: { start: string | null; end: string | null };
  limit_applied: number;
  privacy: QuestionGapPrivacy;
  clusters: QuestionGapCluster[];
  top_gaps: QuestionGapItem[];
  summary: string;
  cached?: boolean;
}
