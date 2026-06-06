const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const analyticsService = {
  async trackEvent(eventType: string, metadata: any = {}) {
    try {
      await fetch(`${API_URL}/analytics/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: eventType,
          metadata: {
            ...metadata,
            url: typeof window !== 'undefined' ? window.location.href : '',
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  },

  async getStats() {
    const response = await fetch(`${API_URL}/analytics/stats`);
    return response.json();
  },

  async getAiTrends() {
    const aiServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || '';
    const response = await fetch(`${aiServiceUrl}/api/ai/analytics/stats`);
    return response.json();
  }
};
