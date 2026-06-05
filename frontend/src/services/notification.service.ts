import { authService } from './auth.service';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  channel: string;
  is_read: boolean;
  sent_at: string;
  read_at: string | null;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

class NotificationService {
  private readonly API_URL = '/api/notifications';

  async getMyNotifications(): Promise<NotificationsResponse> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(this.API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Không thể tải thông báo');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async markAsRead(id: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Cập nhật trạng thái thất bại');
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
