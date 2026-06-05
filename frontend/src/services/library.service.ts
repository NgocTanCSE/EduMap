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

  async searchMaterials(q: string = '', category?: string, type?: string) {
    let url = `${API_BASE_URL}/search?q=${encodeURIComponent(q)}`;
    if (category && category !== 'Tất cả') url += `&category=${encodeURIComponent(category)}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    return this.fetchWithAuth(url);
  }

  async getMaterialDetail(id: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/${id}`);
  }

  async getMaterialSummary(id: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/${id}/summary`);
  }
}

export const libraryService = new LibraryService();
