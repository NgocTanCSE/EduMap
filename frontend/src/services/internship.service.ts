import { authService } from './auth.service';

export interface Internship {
  id: string;
  title: string;
  description: string;
  field: string;
  salary_range: string;
  status: string;
  created_at: string;
  company: {
    id: string;
    full_name: string; // Company Name
    avatar_url: string; // Company Logo
  };
  location?: any;
}

export interface ApplicationResponse {
  success: boolean;
  tracking_id: string;
  status: string;
  message: string;
}

class InternshipService {
  private readonly API_URL = '/api/internships';

  /**
   * Lấy danh sách thực tập
   */
  async getInternships(): Promise<Internship[]> {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) {
        throw new Error('Không thể tải danh sách thực tập');
      }
      return await response.json();
    } catch (error) {
      console.error("InternshipService.getInternships Error:", error);
      throw error;
    }
  }

  /**
   * Lấy chi tiết thực tập theo ID
   */
  async getInternshipById(id: string): Promise<Internship> {
    try {
      const response = await fetch(`${this.API_URL}/${id}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Không tìm thấy cơ hội thực tập');
        throw new Error('Không thể tải chi tiết thực tập');
      }
      return await response.json();
    } catch (error) {
      console.error(`InternshipService.getInternshipById(${id}) Error:`, error);
      throw error;
    }
  }

  /**
   * Ứng tuyển thực tập
   */
  async applyInternship(id: string, coverLetter: string): Promise<ApplicationResponse> {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('Vui lòng đăng nhập để ứng tuyển');
    }

    if (!coverLetter.trim()) {
        throw new Error('Vui lòng nhập thư giới thiệu (Cover Letter)');
    }

    try {
      const response = await fetch(`${this.API_URL}/${id}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coverLetter }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Ứng tuyển thất bại');
      }

      return result;
    } catch (error) {
      console.error("InternshipService.applyInternship Error:", error);
      throw error;
    }
  }
}

export const internshipService = new InternshipService();
