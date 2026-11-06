import { fetchWithRetry } from '@/src/lib/fetch-with-retry';

class ConfigService {
  private readonly API_URL = '/api/config';

  async get(): Promise<Record<string, unknown>> {
    const response = await fetchWithRetry(this.API_URL, { cache: 'no-store' });
    if (!response.ok)
      throw new Error('Không thể tải cấu hình ứng dụng');
    const data = await response.json();
    return (data?.data ?? data) as Record<string, unknown>;
  }
}

export const configService = new ConfigService();