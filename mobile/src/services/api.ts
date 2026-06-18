import { Platform } from 'react-native';

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api')).replace(/\/$/, '');

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${BASE_URL}${endpoint}`;
    
    const headers: any = {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(id);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
         throw new Error('Connection timeout (10s). Please check your internet connection.');
      }
      console.error(`Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, body: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // === Specific Endpoints ===

  async getLocations() {
    return this.get('/map/locations');
  }

  async getMentors() {
    return this.get('/mentoring/mentors');
  }

  async getLibrary() {
    return this.get('/library/resources');
  }

  async sendChatMessage(message: string, history: any[] = []) {
    return this.post('/ai/chat', {
      message,
      history,
      context: {
        source: 'mobile',
      },
    });
  }

  async getScholarships(page: number = 1, limit: number = 10) {
    return this.get(`/scholarships?page=${page}&limit=${limit}`);
  }

  async getInternships(page: number = 1, limit: number = 10) {
    return this.get(`/internships?page=${page}&limit=${limit}`);
  }
}

export const apiService = new ApiService();
