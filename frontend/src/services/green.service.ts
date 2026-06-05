import { authService } from './auth.service';

export interface GreenChallenge {
  id: string;
  title: string;
  description: string;
  points: number;
  carbon_saved_kg: number;
  image_url: string;
  status: string;
  participants_count: number;
}

class GreenService {
  private readonly API_URL = '/api/green';
  private readonly GAMIFICATION_URL = '/api/gamification';

  /**
   * Lấy danh sách thử thách sống xanh
   */
  async getChallenges(): Promise<GreenChallenge[]> {
    try {
      const response = await fetch(`${this.API_URL}/challenges`);
      if (!response.ok) {
        throw new Error('Không thể tải danh sách thử thách');
      }
      return await response.json();
    } catch (error) {
      console.error("GreenService.getChallenges Error:", error);
      throw error;
    }
  }

  /**
   * Nộp minh chứng hoạt động xanh cho AI duyệt
   */
  async submitProof(activityType: string, description: string, proofUrl: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('Vui lòng đăng nhập để nộp báo cáo');
    }

    // Defensive: Validate inputs
    if (!activityType || !proofUrl) {
      throw new Error('Vui lòng cung cấp đầy đủ thông tin loại hoạt động và hình ảnh minh chứng');
    }

    try {
      const response = await fetch(`${this.GAMIFICATION_URL}/submit-activity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: activityType,
          description: description,
          proofUrl: proofUrl
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Nộp báo cáo thất bại');
      }

      return data;
    } catch (error) {
      console.error("GreenService.submitProof Error:", error);
      throw error;
    }
  }
}

export const greenService = new GreenService();
