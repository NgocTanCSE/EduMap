import { authService } from './auth.service';

export interface Survey {
  id: string;
  title: string;
  questions_json: any[];
  status: string;
  created_at: string;
}

class SurveyService {
  private readonly API_URL = '/api/surveys';

  async getSurveys(): Promise<Survey[]> {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) throw new Error('Không thể tải danh sách khảo sát');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSurveyById(id: string): Promise<Survey> {
    try {
      const response = await fetch(`${this.API_URL}/${id}`);
      if (!response.ok) {
          if (response.status === 404) throw new Error('Khảo sát không tồn tại');
          throw new Error('Không thể tải chi tiết khảo sát');
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async submitResponse(id: string, answers: any): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để thực hiện khảo sát');

    try {
      const response = await fetch(`${this.API_URL}/${id}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gửi khảo sát thất bại');
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

export const surveyService = new SurveyService();
