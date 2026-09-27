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
      const data = await response.json();
      // Hỗ trợ cả response bọc trong { success, data } và response raw
      return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
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
      // Hỗ trợ cả response bọc trong { success, data } và response raw
      const raw = data.data || data;
      // Chuẩn hóa trường file_url cho UserFile interface
      return {
        id: raw.id || raw.fileName,
        original_name: raw.original_name || file.name,
        file_url: raw.file_url || raw.url,
        mime_type: raw.mime_type || file.type,
        size_kb: raw.size_kb || 0,
        created_at: raw.created_at || new Date().toISOString(),
      };
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
