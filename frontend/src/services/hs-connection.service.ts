import { authService } from './auth.service';

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

  /**
   * Lấy mạng lưới kết nối của tôi
   */
  async getMyNetwork(): Promise<NetworkResponse> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để xem mạng lưới');

    try {
      const response = await fetch(`${this.API_URL}/network`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Không thể tải mạng lưới kết nối');
      return await response.json();
    } catch (error) {
      console.error("HsConnectionService.getMyNetwork Error:", error);
      throw error;
    }
  }

  /**
   * Gửi yêu cầu kết bạn
   */
  async sendRequest(receiverId: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/network/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiverId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gửi yêu cầu thất bại');
      return data;
    } catch (error) {
      console.error("HsConnectionService.sendRequest Error:", error);
      throw error;
    }
  }

  /**
   * Phản hồi yêu cầu kết bạn
   */
  async respondToRequest(connectionId: string, accept: boolean): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/network/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
