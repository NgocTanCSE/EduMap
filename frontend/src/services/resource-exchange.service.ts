import { authService } from "./auth.service";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";

const API_BASE_URL = "/api/resource-exchange";

export type ResourceType = "book" | "device" | "volunteer_hours";
export type ResourceStatus = "available" | "reserved" | "unavailable";
export type RequestUrgency = "critical" | "high" | "medium" | "low";
export type RequestStatus = "open" | "filled" | "closed";
export type MatchStatus = "pending" | "accepted" | "rejected" | "completed";

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  description?: string;
  condition: number; // 0–5 sao
  location: string;
  lat?: number;
  lng?: number;
  available_from?: string | null;
  cost: number;
  contact_method?: string;
  status: ResourceStatus;
  is_verified: boolean;
  tags: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ResourceRequest {
  id: string;
  need_type: ResourceType;
  title: string;
  description?: string;
  urgency: RequestUrgency;
  location: string;
  lat?: number;
  lng?: number;
  deadline?: string | null;
  preferred_min_condition: number;
  contact_method?: string;
  status: RequestStatus;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ResourceMatch {
  id: string;
  resource_id: string;
  request_id: string;
  match_score: number;
  explanation?: string;
  status: MatchStatus;
  scheduled_pickup?: string | null;
  transport_plan?: string | null;
  created_at: string;
  updated_at: string;
  resource?: Resource;
  request?: ResourceRequest;
}

export interface MatchResult {
  resource_id: string;
  request_id: string;
  match_score: number;
  explanation: string;
  match_reasons: string[];
  next_steps: string[];
  scheduled_pickup?: string | null;
  resource?: any;
  request?: any;
}

export interface TransportSlot {
  resource_id: string;
  request_id: string;
  pickup_datetime: string;
  pickup_order: number;
}

export interface MatchResourcesResponse {
  ranked_matches: MatchResult[];
  transport_plan?: TransportSlot[];
  pre_filter_summary: {
    total_resources: number;
    total_requests: number;
    pre_filtered_pairs: number;
    max_pairs: number;
  };
  degraded: boolean;
  reason?: string;
}

export interface CreateResourcePayload {
  type: ResourceType;
  title: string;
  description?: string;
  condition: number;
  location: string;
  lat?: number;
  lng?: number;
  available_from?: string;
  cost?: number;
  contact_method?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CreateResourceRequestPayload {
  need_type: ResourceType;
  title: string;
  description?: string;
  urgency: RequestUrgency;
  location: string;
  lat?: number;
  lng?: number;
  deadline?: string;
  preferred_min_condition?: number;
  contact_method?: string;
  tags?: string[];
}

class ResourceExchangeService {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const accessToken = authService.getAccessToken();
    const headers = {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    } as any;

    const response = await fetchWithRetry(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "API request failed");
    }
    return unwrapApiResponse<any>(await response.json());
  }

  // ── Resources (Cung cấp) ────────────────────────────────────────
  async getResources(params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    location?: string;
  }): Promise<{ items: Resource[]; meta: any }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    if (params?.type) qs.append("type", params.type);
    if (params?.status) qs.append("status", params.status);
    if (params?.location) qs.append("location", params.location);
    const query = qs.toString();
    const url = query
      ? `${API_BASE_URL}/resources?${query}`
      : `${API_BASE_URL}/resources`;
    return this.fetchWithAuth(url);
  }

  async getResourceById(id: string): Promise<Resource> {
    return this.fetchWithAuth(`${API_BASE_URL}/resources/${id}`);
  }

  async createResource(data: CreateResourcePayload): Promise<Resource> {
    return this.fetchWithAuth(`${API_BASE_URL}/resources`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ── Requests (Cần nhận) ──────────────────────────────────────────
  async getRequests(params?: {
    page?: number;
    limit?: number;
    need_type?: string;
    status?: string;
    location?: string;
  }): Promise<{ items: ResourceRequest[]; meta: any }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    if (params?.need_type) qs.append("need_type", params.need_type);
    if (params?.status) qs.append("status", params.status);
    if (params?.location) qs.append("location", params.location);
    const query = qs.toString();
    const url = query
      ? `${API_BASE_URL}/requests?${query}`
      : `${API_BASE_URL}/requests`;
    return this.fetchWithAuth(url);
  }

  async getRequestById(id: string): Promise<ResourceRequest> {
    return this.fetchWithAuth(`${API_BASE_URL}/requests/${id}`);
  }

  async createRequest(
    data: CreateResourceRequestPayload,
  ): Promise<ResourceRequest> {
    return this.fetchWithAuth(`${API_BASE_URL}/requests`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ── Match (AI ranking + greedy scheduling) ───────────────────────
  async matchResources(params?: {
    region?: string;
    type?: string;
    max_results?: number;
  }): Promise<MatchResourcesResponse> {
    return this.fetchWithAuth(`${API_BASE_URL}/match`, {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
  }
}

export const resourceExchangeService = new ResourceExchangeService();
