import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';

export interface LeaderboardUser {
  id: string;
  full_name: string;
  avatar_url: string;
  points: number;
  level: number;
}

export interface UserProgress {
  points: number;
  level: number;
  next_level_points: number;
  progress_percent: number;
  points_needed: number;
}

class GamificationService {
  private readonly API_URL = '/api/gamification';

  async getLeaderboard(): Promise<LeaderboardUser[]> {
    try {
      const response = await fetchWithRetry(`${this.API_URL}/leaderboard`, { retries: 2 });
      if (!response.ok) {
        throw new Error('Không thể tải bảng xếp hạng');
      }
      const data = await response.json();
      return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("GamificationService.getLeaderboard Error:", error);
      throw error;
    }
  }

  async getMyProgress(): Promise<UserProgress> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetchWithRetry(`${this.API_URL}/my-progress`, {
        headers: { 'Authorization': `Bearer ${token}` },
        retries: 2
      });
      if (!response.ok) {
        throw new Error('Không thể tải tiến độ cá nhân');
      }
      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error("GamificationService.getMyProgress Error:", error);
      throw error;
    }
  }

  async getMyBadges(): Promise<any[]> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetchWithRetry(`${this.API_URL}/my-badges`, {
        headers: { 'Authorization': `Bearer ${token}` },
        retries: 2
      });
      if (!response.ok) {
        throw new Error('Không thể tải danh sách huy hiệu');
      }
      const data = await response.json();
      return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("GamificationService.getMyBadges Error:", error);
      throw error;
    }
  }
}

export const gamificationService = new GamificationService();
