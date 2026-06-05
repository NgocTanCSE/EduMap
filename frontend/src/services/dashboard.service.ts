import { authService } from './auth.service';

const API_BASE_URL = '/api/dashboard';

class DashboardService {
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

  async getOverview() {
    return this.fetchWithAuth(`${API_BASE_URL}/overview`);
  }

  async getDailyInsight() {
    return this.fetchWithAuth(`${API_BASE_URL}/insight`);
  }
}

export const dashboardService = new DashboardService();
