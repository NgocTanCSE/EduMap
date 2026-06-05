import { authService } from './auth.service';

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

  /**
   * Lấy bảng xếp hạng
   */
  async getLeaderboard(): Promise<LeaderboardUser[]> {
    try {
      const response = await fetch(`${this.API_URL}/leaderboard`);
      if (!response.ok) {
        throw new Error('Không thể tải bảng xếp hạng');
      }
      return await response.json();
    } catch (error) {
      console.error("GamificationService.getLeaderboard Error:", error);
      throw error;
    }
  }

  /**
   * Lấy tiến độ cá nhân
   */
  async getMyProgress(): Promise<UserProgress> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/my-progress`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Không thể tải tiến độ cá nhân');
      }
      return await response.json();
    } catch (error) {
      console.error("GamificationService.getMyProgress Error:", error);
      throw error;
    }
  }

  /**
   * Lấy danh sách huy hiệu cá nhân
   */
  async getMyBadges(): Promise<any[]> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/my-badges`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Không thể tải danh sách huy hiệu');
      }
      return await response.json();
    } catch (error) {
      console.error("GamificationService.getMyBadges Error:", error);
      throw error;
    }
  }
}

export const gamificationService = new GamificationService();
