import { authService } from './auth.service';

export interface UserFile {
  id: string;
  original_name: string;
  file_url: string;
  mime_type: string;
  size_kb: number;
  created_at: string;
}

class StorageService {
  private readonly API_URL = '/api/storage';

  async getMyFiles(): Promise<UserFile[]> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/my-files`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Không thể tải danh sách tập tin');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async uploadFile(file: File): Promise<UserFile> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để tải lên');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.API_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Tải lên thất bại');
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async deleteFile(id: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Xóa tập tin thất bại');
      return data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

export const storageService = new StorageService();
