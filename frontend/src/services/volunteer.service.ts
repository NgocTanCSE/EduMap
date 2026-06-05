import { authService } from './auth.service';

export interface VolunteerActivity {
  id: string;
  title: string;
  description: string;
  campaign_name: string;
  hours: number;
  date: string;
  status: string; // pending, verified
  created_at: string;
}

export interface VolunteerStats {
  activities: VolunteerActivity[];
  total_hours: number;
}

class VolunteerService {
  private readonly API_URL = '/api/volunteers';

  async getMyActivities(): Promise<VolunteerStats> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/activities`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Không thể tải lịch sử tình nguyện');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async logActivity(data: { title: string; description: string; campaign_name: string; hours: number; date: string }): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để ghi nhận hoạt động');

    try {
      const response = await fetch(`${this.API_URL}/activities`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Ghi nhận thất bại');
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

export const volunteerService = new VolunteerService();
