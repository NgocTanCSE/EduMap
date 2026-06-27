import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';

export interface HSUser {
  id: string;
  full_name: string;
  avatar_url: string;
  level: number;
  points: number;
  bio?: string;
  connection_id?: string;
}

export interface NetworkResponse {
  friends: HSUser[];
  requests: HSUser[];
  suggestions: HSUser[];
}

class HsConnectionService {
  private readonly API_URL = '/api/hs-connection';

  async getMyNetwork(): Promise<NetworkResponse> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để xem mạng lưới');

    try {
      const response = await fetchWithRetry(`${this.API_URL}/requests`, {
        headers: { 'Authorization': `Bearer ${token}` },
        retries: 2
      });
      if (!response.ok) throw new Error('Không thể tải mạng lưới kết nối');
      return await response.json();
    } catch (error) {
      console.error("HsConnectionService.getMyNetwork Error:", error);
      throw error;
    }
  }

  async sendRequest(receiverId: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetchWithRetry(`${this.API_URL}/connect/${receiverId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        retries: 2
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gửi yêu cầu thất bại');
      return data;
    } catch (error) {
      console.error("HsConnectionService.sendRequest Error:", error);
      throw error;
    }
  }

  async respondToRequest(connectionId: string, accept: boolean): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetchWithRetry(`${this.API_URL}/network/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        retries: 2,
        body: JSON.stringify({ connectionId, accept })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Phản hồi thất bại');
      return data;
    } catch (error) {
      console.error("HsConnectionService.respondToRequest Error:", error);
      throw error;
    }
  }
}

export const hsConnectionService = new HsConnectionService();
