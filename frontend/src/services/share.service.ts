import { authService } from './auth.service';

export interface SharedItem {
  id: string;
  name: string;
  category: string;
  description: string;
  status: string;
  owner_id: string;
  created_at: string;
  owner: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface BorrowRequest {
  id: string;
  item_id: string;
  requester_id: string;
  message: string;
  status: string;
  created_at: string;
  item: SharedItem;
}

class ShareService {
  private readonly API_URL = '/api/share';

  /**
   * Tạo tài liệu/học cụ mới
   */
  async createItem(name: string, description: string, category: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để chia sẻ');

    try {
      const response = await fetch(`${this.API_URL}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description, category }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Thêm tài liệu thất bại');
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Lấy danh sách tài liệu
   */
  async getItems(category?: string): Promise<SharedItem[]> {
    try {
      const url = category ? `${this.API_URL}/items?category=${category}` : `${this.API_URL}/items`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Không thể tải danh sách tài liệu');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Mượn tài liệu
   */
  async requestItem(itemId: string, message: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để mượn');

    try {
      const response = await fetch(`${this.API_URL}/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item_id: itemId, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Mượn thất bại');
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Lấy danh sách yêu cầu mượn của tôi
   */
  async getMyRequests(): Promise<BorrowRequest[]> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Không thể tải danh sách yêu cầu');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

export const shareService = new ShareService();
