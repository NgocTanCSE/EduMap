const API_URL = '/api';
export const analyticsService = {
    async trackEvent(eventType: string, metadata: any = {}) {
        const accessToken = typeof window !== 'undefined' ? localStorage.getItem('edumap-access-token') : null;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (accessToken)
            headers['Authorization'] = `Bearer ${accessToken}`;
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
        }
        catch (error) {
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
        const payload = statsData?.data || statsData;
        if (payload?.status === 'success' || payload?.historical_data) {
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
                trending_skills_source: payload.trending_skills_source || 'local',
            };
        }
        throw new Error('AI trends service returned an unexpected payload');
    }
};
