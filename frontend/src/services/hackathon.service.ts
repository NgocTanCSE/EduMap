import { authService } from './auth.service';

export interface Hackathon {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export interface HackathonTeam {
  team_name: string;
  hackathon_id: string;
  members: string[];
}

class HackathonService {
  private readonly API_URL = '/api/hackathons';

  /**
   * Lấy danh sách Hackathon
   */
  async getHackathons(): Promise<Hackathon[]> {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) {
        throw new Error('Không thể tải danh sách Hackathon');
      }
      return await response.json();
    } catch (error) {
      console.error("HackathonService.getHackathons Error:", error);
      throw error;
    }
  }

  /**
   * Lấy chi tiết Hackathon theo ID
   */
  async getHackathonById(id: string): Promise<Hackathon> {
    try {
      const response = await fetch(`${this.API_URL}/${id}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Không tìm thấy cuộc thi');
        throw new Error('Không thể tải chi tiết Hackathon');
      }
      return await response.json();
    } catch (error) {
      console.error(`HackathonService.getHackathonById(${id}) Error:`, error);
      throw error;
    }
  }

  /**
   * Đăng ký đội thi tham dự Hackathon
   */
  async registerTeam(data: HackathonTeam): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('Vui lòng đăng nhập để đăng ký');
    }

    if (!data.team_name || !data.hackathon_id) {
        throw new Error('Tên đội và ID cuộc thi là bắt buộc');
    }

    try {
      const response = await fetch(`${this.API_URL}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Đăng ký đội thi thất bại');
      }

      return result;
    } catch (error) {
      console.error("HackathonService.registerTeam Error:", error);
      throw error;
    }
  }

  /**
   * Nộp sản phẩm dự thi
   */
  async submitProject(teamId: string, repoUrl: string, demoVideo: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/teams/${teamId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl, demoVideo }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Nộp sản phẩm thất bại');
      
      return result;
    } catch (error) {
      console.error("HackathonService.submitProject Error:", error);
      throw error;
    }
  }
}

export const hackathonService = new HackathonService();
