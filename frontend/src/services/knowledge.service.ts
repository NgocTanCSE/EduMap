import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * Type definitions for the AI Knowledge Graph (Idea #8).
 */

export interface KnowledgeNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  province?: string | null;
  url?: string | null;
  metadata?: Record<string, any>;
  confidence: number;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  metadata?: Record<string, any>;
}

export interface KnowledgeGraphResponse {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  meta: Record<string, any>;
  degraded?: boolean;
}

export interface GraphQueryResponse {
  start_node: KnowledgeNode | null;
  neighbors: KnowledgeNode[];
  edges: KnowledgeEdge[];
  meta: Record<string, any>;
}

export interface ExtractedEntity {
  text: string;
  type: string;
  confidence: number;
}

export interface LinkedNode {
  entity_text: string;
  entity_type: string;
  node_id: string;
  node_type: string;
  node_name: string;
  node_url?: string;
  confidence: number;
}

export interface ExtractResponse {
  entities: ExtractedEntity[];
  linked_nodes: LinkedNode[];
  confidence: number;
  degraded: boolean;
  reason?: string;
}

export interface PartnerSuggestion {
  node_id: string;
  type: string;
  name: string;
  description?: string;
  url?: string;
  match_score: number;
  city?: string;
  province?: string;
}

export interface SuggestPartnersResponse {
  query: string;
  focus_type?: string | null;
  count: number;
  suggestions: PartnerSuggestion[];
  degraded?: boolean;
}

class KnowledgeGraphService {
  private readonly API_URL = '/api/ai/knowledge';

  async getGraph(nodeTypes?: string[], limit: number = 500): Promise<KnowledgeGraphResponse> {
    try {
      const params = new URLSearchParams();
      if (nodeTypes && nodeTypes.length) params.set('node_types', nodeTypes.join(','));
      params.set('limit', String(limit));

      const token = authService.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetchWithRetry(`${this.API_URL}/graph?${params.toString()}`, { headers });
      if (!response.ok) {
        throw new Error('Không thể tải knowledge graph');
      }
      return unwrapApiResponse<KnowledgeGraphResponse>(await response.json());
    } catch (error) {
      console.error('KnowledgeGraphService.getGraph Error:', error);
      // Graceful degradation: return empty graph so the UI shows an empty state
      return { nodes: [], edges: [], meta: {}, degraded: true };
    }
  }

  async queryGraph(
    nodeId: string,
    edgeTypes?: string[],
    depth: number = 1,
    limit: number = 50,
  ): Promise<GraphQueryResponse> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để truy vấn knowledge graph');

    try {
      const response = await fetchWithRetry(`${this.API_URL}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ node_id: nodeId, edge_types: edgeTypes, depth, limit }),
      });
      if (!response.ok) throw new Error('Truy vấn knowledge graph thất bại');
      return unwrapApiResponse<GraphQueryResponse>(await response.json());
    } catch (error) {
      console.error('KnowledgeGraphService.queryGraph Error:', error);
      throw error;
    }
  }

  async suggestPartners(
    query: string,
    limit: number = 10,
    focusType?: string,
  ): Promise<SuggestPartnersResponse> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để sử dụng tính năng gợi ý');

    try {
      const response = await fetchWithRetry(`${this.API_URL}/suggest-partners`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit, focus_type: focusType }),
      });
      if (!response.ok) throw new Error('Gợi ý tài trợ thất bại');
      return unwrapApiResponse<SuggestPartnersResponse>(await response.json());
    } catch (error) {
      console.error('KnowledgeGraphService.suggestPartners Error:', error);
      throw error;
    }
  }

  async extractEntities(text: string): Promise<ExtractResponse> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để trích xuất thực thể');

    try {
      const response = await fetchWithRetry(`${this.API_URL}/extract`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error('Trích xuất thực thể thất bại');
      return unwrapApiResponse<ExtractResponse>(await response.json());
    } catch (error) {
      console.error('KnowledgeGraphService.extractEntities Error:', error);
      throw error;
    }
  }

  async getReviews(status: string = 'pending', limit: number = 100): Promise<any[]> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetchWithRetry(
        `${this.API_URL}/reviews?status=${encodeURIComponent(status)}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error('Lỗi tải review queue');
      const data = unwrapApiResponse<any>(await response.json());
      return data.reviews || [];
    } catch (error) {
      console.error('KnowledgeGraphService.getReviews Error:', error);
      throw error;
    }
  }

  async sync(background: boolean = true): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetchWithRetry(`${this.API_URL}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ background }),
      });
      if (!response.ok) throw new Error('Sync knowledge graph thất bại');
      return unwrapApiResponse<any>(await response.json());
    } catch (error) {
      console.error('KnowledgeGraphService.sync Error:', error);
      throw error;
    }
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
