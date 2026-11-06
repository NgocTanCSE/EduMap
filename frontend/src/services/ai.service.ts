import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export interface LearningPath {
  id?: string;
  target_role: string;
  current_level: string;
  steps?: Array<{ title: string; description: string; duration?: string }>;
  resources?: Array<{ title: string; url: string }>;
  estimated_duration?: string;
}

export interface PdfTranscript {
  gpa?: string;
  overall_grade?: string;
  courses?: Array<{ course: string; credit?: string; grade: string }>;
  student_name?: string;
}

class AiService {
  private readonly API_URL = '/api/ai';

  private buildHeaders(): Record<string, string> {
    const accessToken = authService.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  }

  private async request(url: string, options: RequestInit = {}) {
    const headers = this.buildHeaders();
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }
    const response = await fetchWithRetry(url, { ...options, headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as any)?.detail || (data as any)?.message || 'Yêu cầu thất bại');
    }
    return response;
  }

  async getHistory() {
    const response = await this.request(`${this.API_URL}/history`);
    return unwrapApiResponse<any[]>(await response.json());
  }

  async chatStream(payload: {
    message: string;
    history: Array<{ role: string; content: string }>;
    context?: Record<string, unknown>;
    session_id?: string;
  }) {
    return this.request(`${this.API_URL}/chat-stream`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getLearningPath(payload: {
    target_role: string;
    current_level: string;
    time_commitment_hours_per_week: number;
  }) {
    const response = await this.request(`${this.API_URL}/learning-path`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return unwrapApiResponse<any>(await response.json());
  }

  async getPdfTranscript(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.request(`${this.API_URL}/pdf-transcript`, {
      method: 'POST',
      body: formData,
    });
    return unwrapApiResponse<any>(await response.json());
  }

  async getAnalyticsStats() {
    const response = await this.request(`${this.API_URL}/analytics/stats`);
    return unwrapApiResponse<any>(await response.json());
  }
}

export const aiService = new AiService();