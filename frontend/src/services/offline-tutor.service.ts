import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export type TutorAction = 'explain' | 'practice' | 'suggest';

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  degraded: boolean;
  source: string;
}

export interface TutorStatus {
  model_loaded: boolean;
  model_failed: boolean;
  source: string;
}

class OfflineTutorService {
  private readonly API_URL = '/api/offline';

  async getStatus(): Promise<TutorStatus> {
    const response = await fetchWithRetry(`${this.API_URL}/tutor/status`);
    if (!response.ok) throw new Error('Không thể lấy trạng thái gia sư AI');
    return response.json() as Promise<TutorStatus>;
  }

  async sendMessage(payload: Record<string, any>) {
    const response = await fetchWithRetry(`${this.API_URL}/tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || 'Gia sư AI không phản hồi');
    }
    return unwrapApiResponse<any>(await response.json());
  }
}

export const offlineTutorService = new OfflineTutorService();