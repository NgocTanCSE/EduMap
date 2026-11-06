import apiService from './api';
import * as WebBrowser from 'expo-web-browser';


export const donateService = {
  async getCampaigns(params: { page?: number; limit?: number; q?: string } = {}) {
    return apiService.getCampaigns(params);
  },

  async getCampaign(id: string) {
    return apiService.getCampaign(id);
  },

  async getDonors(campaignId: string) {
    return apiService.getDonors(campaignId);
  },

  async createPaymentUrl(payload: { amount: number; campaignId?: string; bank_code?: string; description?: string }) {
    const res = await apiService.createPaymentUrl(payload);

    return res?.paymentUrl || res?.data?.paymentUrl;
  },

  async payViaVnPay(payload: { amount: number; campaignId?: string; bank_code?: string; description?: string }) {
    const paymentUrl = await this.createPaymentUrl(payload);
    if (!paymentUrl) throw new Error('Không tạo được URL thanh toán VNPay');

    const result = await WebBrowser.openBrowserAsync(paymentUrl);
    return result;
  },

  async donate(payload: { campaignId: string; amount: number; is_anonymous?: boolean; transaction_id?: string }) {
    return apiService.donate(payload);
  },
};

export default donateService;
