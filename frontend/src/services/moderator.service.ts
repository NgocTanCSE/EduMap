import { authService } from './auth.service';

class ModeratorService {
  private readonly GAMIFICATION_URL = '/api/gamification';
  private readonly COMMUNITY_URL = '/api/community/moderation';

  // --- GREEN ACTIVITIES ---
  async getPendingActivities(): Promise<any[]> {
    const token = authService.getAccessToken();
    try {
      const response = await fetch(`${this.GAMIFICATION_URL}/pending-activities`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch pending activities');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  // --- COMMUNITY POSTS ---
  async getPendingPosts(): Promise<any[]> {
    const token = authService.getAccessToken();
    try {
      const response = await fetch(`${this.COMMUNITY_URL}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch pending posts');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async moderatePost(id: string, action: 'approve' | 'reject'): Promise<any> {
    const token = authService.getAccessToken();
    try {
      const response = await fetch(`${this.COMMUNITY_URL}/posts/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      });
      if (!response.ok) throw new Error('Moderation failed');
      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // --- COMMUNITY COMMENTS ---
  async getPendingComments(): Promise<any[]> {
    const token = authService.getAccessToken();
    try {
      const response = await fetch(`${this.COMMUNITY_URL}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch pending comments');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async moderateComment(id: string, action: 'approve' | 'reject'): Promise<any> {
    const token = authService.getAccessToken();
    try {
      const response = await fetch(`${this.COMMUNITY_URL}/comments/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      });
      if (!response.ok) throw new Error('Moderation failed');
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
}

export const moderatorService = new ModeratorService();
