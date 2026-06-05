import { authService } from './auth.service';

export interface DonationCampaign {
  id: string;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  end_date: string;
  status: string;
  created_at: string;
}

export interface DonationResponse {
  status: string;
  message: string;
  transaction_id: string;
  campaign: {
    id: string;
    title: string;
    current_amount: number;
    target_amount: number;
  };
}

class DonateService {
  private readonly API_URL = '/api/donations';

  /**
   * Lấy danh sách tất cả chiến dịch quyên góp
   */
  async getAllCampaigns(): Promise<DonationCampaign[]> {
    try {
      const response = await fetch(`${this.API_URL}/campaigns`);
      if (!response.ok) {
        throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("DonateService.getAllCampaigns Error:", error);
      throw error;
    }
  }

  /**
   * Lấy chi tiết chiến dịch quyên góp theo ID
   */
  async getCampaignById(id: string): Promise<DonationCampaign> {
    try {
      const response = await fetch(`${this.API_URL}/campaigns/${id}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Chiến dịch không tồn tại');
        throw new Error('Không thể tải thông tin chiến dịch');
      }
      return await response.json();
    } catch (error) {
      console.error(`DonateService.getCampaignById(${id}) Error:`, error);
      throw error;
    }
  }

  /**
   * Lấy danh sách người đóng góp của một chiến dịch
   */
  async getDonorsByCampaignId(id: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.API_URL}/campaigns/${id}/donors`);
      if (!response.ok) {
        throw new Error('Không thể tải danh sách người đóng góp');
      }
      return await response.json();
    } catch (error) {
      console.error(`DonateService.getDonorsByCampaignId(${id}) Error:`, error);
      throw error;
    }
  }

  /**
   * Thực hiện quyên góp
   */
  async processDonation(campaign_id: string, amount: number, is_anonymous: boolean): Promise<DonationResponse> {
    const token = authService.getAccessToken();
    
    // Kiểm tra đầu vào phía client (Defensive Programming)
    if (!campaign_id) throw new Error('Mã chiến dịch không hợp lệ');
    if (amount <= 0) throw new Error('Số tiền quyên góp phải lớn hơn 0');

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          campaign_id,
          amount,
          is_anonymous
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Giao dịch quyên góp thất bại');
      }

      return data;
    } catch (error) {
      console.error("DonateService.processDonation Error:", error);
      throw error;
    }
  }
}

export const donateService = new DonateService();
