import { authService } from './auth.service';

export interface Scholarship {
  id: string;
  title: string;
  description: string;
  provider: string;
  value_amount: number;
  deadline: string;
  requirements: any;
}

export interface EligibilityResponse {
  is_eligible: boolean;
  message: string;
}

export interface ScholarshipApplication {
  id: string;
  scholarship_id: string;
  status: string;
  created_at: string;
  scholarship: Scholarship;
}

class ScholarshipService {
  private readonly API_URL = '/api/scholarships';

  /**
   * Lấy danh sách tất cả học bổng
   */
  async getScholarships(): Promise<Scholarship[]> {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) {
        throw new Error('Không thể tải danh sách học bổng');
      }
      return await response.json();
    } catch (error) {
      console.error("ScholarshipService.getScholarships Error:", error);
      throw error;
    }
  }

  /**
   * Kiểm tra điều kiện nộp đơn
   */
  async checkEligibility(id: string): Promise<EligibilityResponse> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để kiểm tra điều kiện');

    try {
      const response = await fetch(`${this.API_URL}/${id}/check-eligibility`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Kiểm tra thất bại');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Nộp đơn ứng tuyển học bổng
   */
  async applyScholarship(id: string, personalStatement: string, cvUrl: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để nộp đơn');

    try {
      const response = await fetch(`${this.API_URL}/${id}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ personal_statement: personalStatement, cv_url: cvUrl }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Nộp đơn thất bại');
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Lấy danh sách hồ sơ của tôi
   */
  async getMyApplications(): Promise<ScholarshipApplication[]> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/me/applications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Không thể tải hồ sơ');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

export const scholarshipService = new ScholarshipService();
