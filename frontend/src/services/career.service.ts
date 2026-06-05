import { authService } from './auth.service';

const API_BASE_URL = '/api/career';

class CareerService {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const accessToken = authService.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      ...options.headers,
    } as any;

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'API request failed');
    }
    return response.json();
  }

  // Career Paths
  async getCareerPaths(field?: string) {
    const url = field ? `${API_BASE_URL}/paths?field=${field}` : `${API_BASE_URL}/paths`;
    return this.fetchWithAuth(url);
  }

  async getCareerPathById(id: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/paths/${id}`);
  }

  async getSkillRoadmap(careerId: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/roadmap/${careerId}`);
  }

  // Jobs
  async searchJobs(params: any) {
    const query = new URLSearchParams(params).toString();
    return this.fetchWithAuth(`${API_BASE_URL}/jobs?${query}`);
  }

  async getJobById(id: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/jobs/${id}`);
  }

  async createJob(jobData: any) {
    return this.fetchWithAuth(`${API_BASE_URL}/jobs`, {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // User Skills
  async getUserSkills() {
    return this.fetchWithAuth(`${API_BASE_URL}/user-skills`);
  }

  async addUserSkill(skillData: any) {
    return this.fetchWithAuth(`${API_BASE_URL}/user-skills`, {
      method: 'POST',
      body: JSON.stringify(skillData),
    });
  }

  async deleteUserSkill(id: string) {
    return this.fetchWithAuth(`${API_BASE_URL}/user-skills/${id}`, {
      method: 'DELETE',
    });
  }

  // User Careers (Aspirations)
  async getUserCareers() {
    return this.fetchWithAuth(`${API_BASE_URL}/user-careers`);
  }

  async addUserCareer(careerData: any) {
    return this.fetchWithAuth(`${API_BASE_URL}/user-careers`, {
      method: 'POST',
      body: JSON.stringify(careerData),
    });
  }

  // Applications
  async applyToJob(applicationData: any) {
    return this.fetchWithAuth(`${API_BASE_URL}/applications`, {
      method: 'POST',
      body: JSON.stringify(applicationData),
    });
  }

  async getUserApplications() {
    return this.fetchWithAuth(`${API_BASE_URL}/applications`);
  }

  // AI Integration
  async getAIAdvice() {
    return this.fetchWithAuth(`${API_BASE_URL}/ai-advice`);
  }

  async getCareerSuggestions() {
    return this.fetchWithAuth(`${API_BASE_URL}/suggest`, { method: 'POST' });
  }
}

export const careerService = new CareerService();
