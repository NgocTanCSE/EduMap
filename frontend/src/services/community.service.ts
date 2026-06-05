import { authService } from './auth.service';

export interface UserInfo {
  id: string;
  full_name: string;
  avatar_url: string;
  role: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  group_id?: string;
  like_count: number;
  comment_count: number;
  status: string;
  created_at: string;
  author: UserInfo;
  group?: Group;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  like_count: number;
  status: string;
  created_at: string;
  author: UserInfo;
}

class CommunityService {
  private readonly API_URL = '/api/community';

  /**
   * Tạo bài đăng mới (có AI kiểm duyệt)
   */
  async createPost(title: string, content: string, groupId?: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để đăng bài');

    try {
      const response = await fetch(`${this.API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content, group_id: groupId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Đăng bài thất bại');
      return data;
    } catch (error) {
      console.error("CommunityService.createPost Error:", error);
      throw error;
    }
  }

  /**
   * Lấy danh sách bài đăng (có phân trang)
   */
  async getPosts(page: number = 1, limit: number = 10): Promise<{posts: Post[], total: number}> {
    try {
      const response = await fetch(`${this.API_URL}/posts?page=${page}&limit=${limit}`);
      if (!response.ok) throw new Error('Không thể tải bài viết');
      return await response.json();
    } catch (error) {
      console.error("CommunityService.getPosts Error:", error);
      throw error;
    }
  }

  /**
   * Lấy chi tiết bài đăng
   */
  async getPostById(id: string): Promise<Post> {
    try {
      const response = await fetch(`${this.API_URL}/posts/${id}`);
      if (!response.ok) throw new Error('Không thể tải bài viết');
      return await response.json();
    } catch (error) {
      console.error("CommunityService.getPostById Error:", error);
      throw error;
    }
  }

  /**
   * Lấy danh sách bình luận của bài đăng
   */
  async getComments(postId: string, page: number = 1, limit: number = 20): Promise<{comments: Comment[], total: number}> {
    try {
      const response = await fetch(`${this.API_URL}/posts/${postId}/comments?page=${page}&limit=${limit}`);
      if (!response.ok) throw new Error('Không thể tải bình luận');
      return await response.json();
    } catch (error) {
      console.error("CommunityService.getComments Error:", error);
      throw error;
    }
  }

  /**
   * Thêm bình luận (có AI kiểm duyệt)
   */
  async addComment(postId: string, content: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập để bình luận');

    try {
      const response = await fetch(`${this.API_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Bình luận thất bại');
      return data;
    } catch (error) {
      console.error("CommunityService.addComment Error:", error);
      throw error;
    }
  }

  /**
   * Thích bài đăng
   */
  async likePost(postId: string): Promise<any> {
    const token = authService.getAccessToken();
    if (!token) throw new Error('Vui lòng đăng nhập');

    try {
      const response = await fetch(`${this.API_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Thao tác thất bại');
      return data;
    } catch (error) {
      console.error("CommunityService.likePost Error:", error);
      throw error;
    }
  }

  /**
   * Lấy danh sách nhóm
   */
  async getGroups(): Promise<Group[]> {
    try {
      const response = await fetch(`${this.API_URL}/groups`);
      if (!response.ok) throw new Error('Không thể tải danh sách nhóm');
      return await response.json();
    } catch (error) {
      console.error("CommunityService.getGroups Error:", error);
      throw error;
    }
  }
}

export const communityService = new CommunityService();
