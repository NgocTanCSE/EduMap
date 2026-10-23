import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

const API_BASE_URL = '/api/certificates';

class CertificateService {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const accessToken = authService.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      ...options.headers,
    } as any;

    const response = await fetchWithRetry(url, { ...options, headers });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'API request failed');
    }
    return unwrapApiResponse<any>(await response.json());
  }

  async getPortfolio() {
    return this.fetchWithAuth(`${API_BASE_URL}/portfolio`);
  }

  async verifyCertificate(code: string) {
    // This is a public endpoint, no auth needed
    const response = await fetchWithRetry(`${API_BASE_URL}/verify/${code}`);
    return unwrapApiResponse<any>(await response.json());
  }
}

export const certificateService = new CertificateService();
