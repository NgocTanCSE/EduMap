// Always use the same-origin BFF (`/api/*`) instead of an absolute
// NEXT_PUBLIC_API_URL. The latter is inlined at build time and, on Hugging
// Face Spaces, was baked as `http://localhost:7680/api` (or a different
// deployment's domain), so every browser call failed even though the app was
// served from the Space. Relative URLs work on localhost, Docker and HF alike.
const API_URL = '/api';

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
    const response = await fetch(`${API_URL}/ai/analytics/stats`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`AI trends service unavailable (HTTP ${response.status})`);
    }

    const statsData = await response.json();
    const payload = statsData?.data || statsData; // backend nests payload under data

    if (payload?.status === 'success' || payload?.historical_data) {
      // Never invent skills here. If the jobs table has no active postings,
      // return an empty list so the UI can show an honest empty state instead
      // of displaying made-up "trending" skills.
      const trendingSkills = Array.isArray(payload.trending_skills)
        ? payload.trending_skills
        : [];

      return {
        success: true,
        status: 'online',
        historical_data: payload.historical_data || [],
        sectors: payload.sectors || [],
        insights: payload.insights || {},
        trending_skills: trendingSkills,
      };
    }

    throw new Error('AI trends service returned an unexpected payload');
  }
};
