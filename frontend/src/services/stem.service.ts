import { authService } from './auth.service';

export interface StemLab {
  id: string;
  name: string;
  description: string;
  location: any;
  address: string;
  contact_email: string;
  equipment: string[];
  status: string;
  created_at: string;
}

class StemService {
  private readonly API_URL = '/api/stem';

  /**
   * Lấy danh sách STEM Labs
   */
  async getLabs(): Promise<StemLab[]> {
    try {
      const response = await fetch(`${this.API_URL}/labs`);
      if (!response.ok) throw new Error('Không thể tải danh sách STEM Labs');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Đặt mượn thiết bị
   */
  async bookEquipment(labId: string, equipmentName: string, startTime: string, endTime: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để đặt mượn thiết bị');

    try {
      const response = await fetch(`${this.API_URL}/labs/${labId}/book`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ equipmentName, startTime, endTime }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Đặt thiết bị thất bại');
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

export const stemService = new StemService();
