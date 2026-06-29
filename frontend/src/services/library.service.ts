import { authService } from './auth.service';

const API_BASE_URL = '/api/library';

class LibraryService {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const accessToken = authService.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      ...options.headers,
    } as any;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API request failed with status ${response.status}`);
      }
      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - vui lòng kiểm tra kết nối mạng');
      }
      throw error;
    }
  }

  async searchMaterials(q: string = '', category?: string, type?: string, page: number = 1, limit: number = 10) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (q) params.append('q', q);
    if (category && category !== 'Tất cả') params.append('subject', category);
    if (type) params.append('type', type);
    return this.fetchWithAuth(`${API_BASE_URL}/search?${params.toString()}`);
  }

  async getMaterialDetail(id: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/resources/${id}`);
  }

  async getMaterialSummary(id: string) {
    return this.fetchWithAuth(`/api/ai/library/summarize`, {
      method: 'POST',
      body: JSON.stringify({ material_id: id })
    });
  }
}

export const libraryService = new LibraryService();
