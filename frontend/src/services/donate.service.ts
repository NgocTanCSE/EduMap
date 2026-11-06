import { authService } from './auth.service';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export interface DonationCampaign {
    id: string;
    title: string;
    description: string;
    target_amount: number;
    current_amount: number;
    end_date: string;
    status: string;
    created_at: string;
    location_point?: string;
    address?: string;
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
    async getAllCampaigns(): Promise<DonationCampaign[]> {
        try {
            const response = await fetchWithRetry(`${this.API_URL}/campaigns`);
            if (!response.ok) {
                throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
            }
            return unwrapApiResponse<any>(await response.json());
        }
        catch (error) {
            console.error("DonateService.getAllCampaigns Error:", error);
            throw error;
        }
    }
    async getCampaignById(id: string): Promise<DonationCampaign> {
        try {
            const response = await fetchWithRetry(`${this.API_URL}/campaigns/${id}`);
            if (!response.ok) {
                if (response.status === 404)
                    throw new Error('Chiến dịch không tồn tại');
                throw new Error('Không thể tải thông tin chiến dịch');
            }
            return unwrapApiResponse<any>(await response.json());
        }
        catch (error) {
            console.error(`DonateService.getCampaignById(${id}) Error:`, error);
            throw error;
        }
    }
    async getDonorsByCampaignId(id: string): Promise<any[]> {
        try {
            const response = await fetchWithRetry(`${this.API_URL}/campaigns/${id}/donors`);
            if (!response.ok) {
                throw new Error('Không thể tải danh sách người đóng góp');
            }
            return unwrapApiResponse<any>(await response.json());
        }
        catch (error) {
            console.error(`DonateService.getDonorsByCampaignId(${id}) Error:`, error);
            throw error;
        }
    }
    async processDonation(campaign_id: string, amount: number, is_anonymous: boolean): Promise<DonationResponse> {
        const token = authService.getAccessToken();
        if (!campaign_id)
            throw new Error('Mã chiến dịch không hợp lệ');
        if (amount <= 0)
            throw new Error('Số tiền quyên góp phải lớn hơn 0');
        try {
            const response = await fetchWithRetry(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    campaign_id,
                    amount,
                    is_anonymous,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error((data as any)?.message || 'Giao dịch quyên góp thất bại');
            }
            return unwrapApiResponse(data);
        }
        catch (error) {
            console.error("DonateService.processDonation Error:", error);
            throw error;
        }
    }
}
export const donateService = new DonateService();
