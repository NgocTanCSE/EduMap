const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const analyticsService = {
  async trackEvent(eventType: string, metadata: any = {}) {
    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('edumap-access-token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    try {
      await fetch(`${API_URL}/analytics/track`, {
        method: 'POST',
        headers,
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
    const response = await fetch(`${API_URL}/ai/trends`);
    if (!response.ok) {
      throw new Error('AI trends service unavailable');
    }
    return response.json();
  }
};
