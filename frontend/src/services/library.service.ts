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

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'API request failed');
    }
    return response.json();
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
    return this.fetchWithAuth(`${API_BASE_URL}/resources/${id}/summary`);
  }
}

export const libraryService = new LibraryService();
