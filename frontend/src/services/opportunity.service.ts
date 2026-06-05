import { authService } from './auth.service';

export interface Opportunity {
  id: string;
  title: string;
  category: string;
  description: string;
  location: any;
  address: string;
  deadline: string | null;
  is_team_finding_open: boolean;
  tags: string[];
  created_at: string;
}

class OpportunityService {
  private readonly API_URL = '/api/opportunities';

  async getOpportunities(type?: string, field?: string, bounds?: string): Promise<Opportunity[]> {
    try {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (field) params.append('field', field);
      if (bounds) params.append('bounds', bounds);

      const response = await fetch(`${this.API_URL}?${params.toString()}`);
      if (!response.ok) throw new Error('Không thể tải danh sách cơ hội');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getOpportunityById(id: string): Promise<Opportunity> {
    try {
      const response = await fetch(`${this.API_URL}/${id}`);
      if (!response.ok) throw new Error('Không thể tải chi tiết cơ hội');
      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  async toggleTeamFinding(id: string): Promise<Opportunity> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/${id}/team-finding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Cập nhật trạng thái thất bại');
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
}

export const opportunityService = new OpportunityService();
