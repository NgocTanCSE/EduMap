import { authService } from './auth.service';

export interface WifiLocation {
  id: string;
  name: string;
  ssid: string;
  password?: string;
  is_free: boolean;
  speed_mbps: number;
  provider?: string;
  location: any; // GeoJSON Point
  verified: boolean;
  reported_by: string;
  created_at: string;
}

class WifiService {
  private readonly API_URL = '/api/wifi';

  async getLocations(): Promise<WifiLocation[]> {
    try {
      const response = await fetch(`${this.API_URL}/locations`);
      if (!response.ok) throw new Error('Không thể tải danh sách Wifi');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getNearby(lat: number, lng: number, radius?: number): Promise<WifiLocation[]> {
    try {
      let url = `${this.API_URL}/locations/nearby?lat=${lat}&lng=${lng}`;
      if (radius) url += `&radius=${radius}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Không thể tìm kiếm Wifi lân cận');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async reportWifi(data: any): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để báo cáo Wifi');

    try {
      const response = await fetch(`${this.API_URL}/locations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Báo cáo thất bại');
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async submitSpeedTest(id: string, downloadSpeed: number, uploadSpeed: number, rating: number): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để thực hiện');

    try {
      const response = await fetch(`${this.API_URL}/locations/${id}/speed-test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ downloadSpeed, uploadSpeed, rating }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Gửi đánh giá thất bại');
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

export const wifiService = new WifiService();
