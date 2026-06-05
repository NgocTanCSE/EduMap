import { authService } from './auth.service';

export interface InternationalProgram {
  id: string;
  title: string;
  type: string;
  description: string;
  host_country: string;
  organization: string;
  application_deadline: string;
  benefits: string[];
  apply_url: string;
  created_at: string;
}

export interface AlumniNetwork {
  id: string;
  full_name: string;
  university: string;
  country: string;
  major: string;
  location: any; // GeoJSON Point
  contact_email: string;
  status: string;
  created_at: string;
}

class IntlService {
  private readonly API_URL = '/api/intl';

  /**
   * Lấy danh sách chương trình trao đổi/học bổng
   */
  async getPrograms(type?: string): Promise<InternationalProgram[]> {
    try {
      const url = type ? `${this.API_URL}/programs?type=${type}` : `${this.API_URL}/programs`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Không thể tải danh sách chương trình quốc tế');
      return await response.json();
    } catch (error) {
      console.error("IntlService.getPrograms Error:", error);
      throw error;
    }
  }

  /**
   * Lấy danh sách lưu học sinh
   */
  async getAlumni(): Promise<AlumniNetwork[]> {
    try {
      const response = await fetch(`${this.API_URL}/alumni`);
      if (!response.ok) throw new Error('Không thể tải mạng lưới cựu sinh viên');
      return await response.json();
    } catch (error) {
      console.error("IntlService.getAlumni Error:", error);
      throw error;
    }
  }

  /**
   * Tìm lưu học sinh lân cận
   */
  async getAlumniNearby(lat: number, lng: number, radius?: number): Promise<AlumniNetwork[]> {
    try {
      let url = `${this.API_URL}/alumni/nearby?latitude=${lat}&longitude=${lng}`;
      if (radius) url += `&radius=${radius}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Không thể tìm kiếm lưu học sinh lân cận');
      return await response.json();
    } catch (error) {
      console.error("IntlService.getAlumniNearby Error:", error);
      throw error;
    }
  }

  /**
   * Đăng ký vào mạng lưới lưu học sinh
   */
  async registerAlumni(data: any): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để đăng ký mạng lưới');

    try {
      const response = await fetch(`${this.API_URL}/alumni`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Đăng ký mạng lưới thất bại');
      return result;
    } catch (error) {
      console.error("IntlService.registerAlumni Error:", error);
      throw error;
    }
  }
}

export const intlService = new IntlService();
