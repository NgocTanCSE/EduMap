import { authService } from './auth.service';

export interface SummerCampaign {
  id: string;
  name: string;
  year: number;
  location: string;
  status: string;
  description: string;
  created_at: string;
}

class SummerService {
  private readonly API_URL = '/api/summer-campaigns';

  async getCampaigns(): Promise<SummerCampaign[]> {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) throw new Error('Không thể tải danh sách chiến dịch');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getDailyReport(id: string, date: string): Promise<any> {
    try {
      const response = await fetch(`${this.API_URL}/${id}/daily-report?date=${date}`);
      if (!response.ok) throw new Error('Không thể tải báo cáo hằng ngày');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async registerVolunteer(id: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để đăng ký');

    try {
      const response = await fetch(`${this.API_URL}/${id}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Đăng ký thất bại');
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

export const summerService = new SummerService();
