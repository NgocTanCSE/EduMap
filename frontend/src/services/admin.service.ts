import { authService } from './auth.service';

const API_URL = '/api';

export interface User {
  id: string;
  email: string;
  full_name: string;
  status: string;
  role: string;
  created_at: string;
  last_login: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const getHeaders = () => {
    const token = authService.getAccessToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const adminService = {
  getUsers: async (params: { page?: number; limit?: number; search?: string; role?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/admin/users?${query}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json() as Promise<PaginatedResponse<User>>;
  },

  updateUserStatus: async (userId: string, status: string, reason?: string) => {
    const response = await fetch(`${API_URL}/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, reason }),
    });
    if (!response.ok) throw new Error('Failed to update user status');
    return response.json();
  },

  getStats: async () => {
    const response = await fetch(`${API_URL}/admin/dashboard`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  getAuditLogs: async (params: { page?: number; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${API_URL}/audit-logs?${query}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch audit logs');
    return response.json();
  },

  getRoles: async () => {
    const response = await fetch(`${API_URL}/roles`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch roles');
    return response.json() as Promise<{ id: number; name: string; description: string }[]>;
  },

  createRole: async (name: string, description: string) => {
    const response = await fetch(`${API_URL}/roles`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) throw new Error('Failed to create role');
    return response.json();
  }
};
