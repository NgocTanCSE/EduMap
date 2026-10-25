import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

const API_BASE_URL = '/api/mentoring';

class MentorService {
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

  async getMentors(specialty?: string) {
    const url = specialty ? `${API_BASE_URL}/mentors?specialty=${encodeURIComponent(specialty)}` : `${API_BASE_URL}/mentors`;
    return this.fetchWithAuth(url);
  }

  async getMentorById(id: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/mentors/${id}`);
  }

  async getRecommendations(userId: string, options?: { specialty?: string; region?: string }) {
    const params = new URLSearchParams();
    if (options?.specialty) params.append('specialty', options.specialty);
    if (options?.region) params.append('region', options.region);
    const query = params.toString();
    const url = query
      ? `${API_BASE_URL}/mentors/recommend/${userId}?${query}`
      : `${API_BASE_URL}/mentors/recommend/${userId}`;
    return this.fetchWithAuth(url);
  }

  async getMentorSlots(mentorId: string, date?: string) {
    const queryDate = date || new Date().toISOString().split('T')[0];
    return this.fetchWithAuth(`${API_BASE_URL}/mentors/${mentorId}/slots?date=${queryDate}`);
  }

  async bookMentor(mentorId: string, slot: { start: string; end: string }) {
    return this.fetchWithAuth(`${API_BASE_URL}/book`, {
      method: 'POST',
      body: JSON.stringify({ mentorId, slot }),
    });
  }

  async getMyBookings() {
    return this.fetchWithAuth(`${API_BASE_URL}/me/bookings`);
  }

  async updateBookingStatus(id: string, status: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
}

export const mentorService = new MentorService();
