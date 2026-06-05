import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const analyticsService = {
  async trackEvent(eventType: string, metadata: any = {}) {
    try {
      await axios.post(`${API_URL}/analytics/track`, {
        event_type: eventType,
        metadata: {
          ...metadata,
          url: typeof window !== 'undefined' ? window.location.href : '',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  },

  async getStats() {
    const response = await axios.get(`${API_URL}/analytics/stats`);
    return response.data;
  },

  async getAiTrends() {
    const response = await axios.get(`${process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000'}/api/ai/analytics/stats`);
    return response.data;
  }
};
