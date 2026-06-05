import { authService } from './auth.service';

const API_BASE_URL = '/api/mentoring';

class MentorService {
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

  async getMentors(specialty?: string) {
    const url = specialty ? `${API_BASE_URL}/mentors?specialty=${encodeURIComponent(specialty)}` : `${API_BASE_URL}/mentors`;
    return this.fetchWithAuth(url);
  }

  async getMentorById(id: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/mentors/${id}`);
  }

  async getRecommendations(userId: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/mentors/recommend/${userId}`);
  }

  async getMentorSlots(mentorId: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/mentors/${mentorId}/slots`);
  }

  async bookMentor(mentorId: string, slotStart: string, slotEnd: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/book`, {
      method: 'POST',
      body: JSON.stringify({ mentorId, slotStart, slotEnd }),
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
