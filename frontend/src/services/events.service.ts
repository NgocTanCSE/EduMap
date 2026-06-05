import { authService } from './auth.service';

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  start_date: string;
  end_date: string;
  capacity: number;
  registered_count: number;
  organizer_id: string;
  status: string;
  image_url?: string;
  created_at: string;
}

export interface EventRegistrationResponse {
  message: string;
  event_title: string;
  ticket_code: string;
  ticket_qr: string; // Base64 Data URL
  start_date: string;
  location: string;
}

class EventsService {
  private readonly API_URL = '/api/events';

  /**
   * Lấy danh sách tất cả sự kiện
   */
  async getAllEvents(): Promise<Event[]> {
    try {
      const response = await fetch(this.API_URL);
      if (!response.ok) {
        throw new Error('Không thể tải danh sách sự kiện');
      }
      return await response.json();
    } catch (error) {
      console.error("EventsService.getAllEvents Error:", error);
      throw error;
    }
  }

  /**
   * Lấy chi tiết sự kiện theo ID
   */
  async getEventById(id: string): Promise<Event> {
    try {
      const response = await fetch(`${this.API_URL}/${id}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Sự kiện không tồn tại');
        throw new Error('Không thể tải thông tin sự kiện');
      }
      return await response.json();
    } catch (error) {
      console.error(`EventsService.getEventById(${id}) Error:`, error);
      throw error;
    }
  }

  /**
   * Đăng ký tham gia sự kiện
   */
  async registerEvent(eventId: string): Promise<EventRegistrationResponse> {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('Vui lòng đăng nhập để đăng ký tham gia sự kiện');
    }

    try {
      const response = await fetch(`${this.API_URL}/${eventId}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Đăng ký sự kiện thất bại');
      }

      return data;
    } catch (error) {
      console.error("EventsService.registerEvent Error:", error);
      throw error;
    }
  }
}

export const eventsService = new EventsService();
