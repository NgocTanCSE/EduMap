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
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    return response.json();
  },

  async getAiTrends() {
    const [statsResponse] = await Promise.allSettled([
      fetch(`${API_URL}/ai/analytics/stats`)
    ]);
    
    if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
      const statsData = await statsResponse.value.json();
      if (statsData.status === 'success' || statsData.historical_data) {
        const trending_skills = [
          { name: 'AI Engineering', growth: '+95%' },
          { name: 'Sustainability', growth: '+80%' },
          { name: 'Cybersecurity', growth: '+75%' },
          { name: 'Cloud Computing', growth: '+70%' }
        ];
        
        return {
          success: true,
          status: 'online',
          historical_data: statsData.historical_data || [],
          insights: statsData.insights || {},
          trending_skills
        };
      }
    }
    
    throw new Error('AI trends service unavailable');
  }
};
