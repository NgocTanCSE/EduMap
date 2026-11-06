
import { Platform } from 'react-native';

export const BASE_URL: string =
  (process.env.EXPO_PUBLIC_API_BASE_URL ||
    (Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api')).replace(/\/$/, '');

const TIMEOUT = 10000;

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

function buildQuery(params: QueryParams): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    q.append(k, String(v));
  });
  const out = q.toString();
  return out ? `?${out}` : '';
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }


  private headers(extra: any = {}): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(extra as Record<string, string>),
    };
    if (this.token) {
      h.Authorization = `Bearer ${this.token}`;
    }
    return h;
  }

  async request(endpoint: string, options: RequestInit & { query?: QueryParams } = {}): Promise<any> {
    const { query, headers: extraHeaders, ...rest } = options;
    const url = `${BASE_URL}${endpoint}${query ? buildQuery(query) : ''}`;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const response = await fetch(url, {
        ...rest,
        headers: this.headers(extraHeaders || {}),
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = {};
        }
        throw new ApiError(
          response.status,
          errorData?.message || errorData?.error || `API Error: ${response.status}`
        );
      }
      return await response.json().catch(() => ({}));
    } catch (error: any) {
      clearTimeout(id);
      if (error?.name === 'AbortError') {
        throw new Error('Connection timeout (10s). Please check your internet connection.');
      }
      console.error(`Request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  get(endpoint: string, query?: QueryParams, headers?: Record<string, string>) {
    return this.request(endpoint, { method: 'GET', query, headers });
  }

  post(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  put(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  patch(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  delete(endpoint: string, body?: any, headers?: Record<string, string>) {
    return this.request(endpoint, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }


  async upload(endpoint: string, fieldName: string, file: { uri: string; name: string; type?: string }): Promise<any> {
    const form = new FormData();
    const payload: any = {
      uri: file.uri,
      name: file.name,
      type: file.type || 'application/octet-stream',
    };
    (form as any).append(fieldName, payload);

    const url = `${BASE_URL}${endpoint}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: this.token ? `Bearer ${this.token}` : '' },
        body: form as any,
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = {};
        }
        throw new ApiError(response.status, errorData?.message || errorData?.error || `API Error: ${response.status}`);
      }
      return await response.json().catch(() => ({}));
    } catch (error: any) {
      clearTimeout(id);
      if (error?.name === 'AbortError') {
        throw new Error('Connection timeout (10s). Please check your internet connection.');
      }
      throw error;
    }
  }


  getLocations = (params?: QueryParams) => this.get('/map/locations', params);
  getMentors = (params: { q?: string; specialty?: string; min_rating?: number } = {}) =>
    this.get('/mentoring/mentors', params);
  getLibrary = (params: { page?: number; limit?: number; q?: string; type?: string; category?: string } = {}) =>
    this.get('/library/resources', params);
  sendChatMessage = (message: string, history: any[] = []) =>
    this.post('/ai/chat', { message, history, context: { source: 'mobile' } });
  getScholarships = (params: { page?: number; limit?: number; q?: string; category?: string } = {}) =>
    this.get('/scholarships', params);
  getInternships = (params: { page?: number; limit?: number; q?: string } = {}) =>
    this.get('/internships', params);
  getCareerJobs = (params: { page?: number; limit?: number; q?: string; location?: string; type?: string } = {}) =>
    this.get('/career/jobs', params);
  getWifiLocations = (params?: QueryParams) => this.get('/wifi/locations', params);


  getPOIs = () => this.get('/map/pois');
  getCategories = () => this.get('/map/categories');
  getMapStats = () => this.get('/map/stats');
  getRoute = (params: { origin: string; destination: string; profile?: string }) =>
    this.get('/map/routing/route', params);
  getSafeRoute = (params: { origin: string; destination: string }) =>
    this.get('/map/routing/route', { ...params, avoid_flood: true });
  getFloodZones = () => this.get('/map/routing/flood-zones');
  getNearestPoint = (params: { lat: number; lng: number; type?: string }) =>
    this.get('/map/routing/nearest', params);
  aiMapAnalysis = (payload: { northEast: [number, number]; southWest: [number, number]; categories?: string[] }) =>
    this.post('/map/ai-analysis', payload);


  getChatHistory = () => this.get('/ai/history');
  aiSearch = (q: string, limit = 5) => this.get('/ai/search', { q, limit });
  learningPath = (payload: { goals: string; background?: string; interests?: string[] }) =>
    this.post('/ai/learning-path', payload);
  careerQuiz = (answers: any) => this.post('/ai/career-quiz', { answers });
  aiTrends = (subject?: string) => this.get('/ai/trends', subject ? { subject } : undefined);
  aiAnalyticsStats = () => this.get('/ai/analytics/stats');


  createScholarship = (scholarship: any) => this.post('/scholarships', scholarship);

  checkEligibility = (id: string) => this.get(`/scholarships/${id}/check-eligibility`);
  applyScholarship = (id: string, application: { personal_statement?: string; cv_url?: string }) =>
    this.post(`/scholarships/${id}/apply`, application);
  getMyScholarshipApplications = () => this.get('/scholarships/me/applications');


  getCareerJob = (id: string) => this.get(`/career/jobs/${id}`);
  createCareerJob = (job: any) => this.post('/career/jobs', job);
  updateCareerJob = (id: string, job: any) => this.patch(`/career/jobs/${id}`, job);
  deleteCareerJob = (id: string) => this.delete(`/career/jobs/${id}`);
  getCareerPaths = () => this.get('/career/paths');
  getCareerPath = (id: string) => this.get(`/career/paths/${id}`);
  createCareerPath = (path: any) => this.post('/career/paths', path);
  getRoadmap = (careerId: string) => this.get(`/career/roadmap/${careerId}`);
  getUserCareers = () => this.get('/career/user-careers');
  createUserCareer = (career: any) => this.post('/career/user-careers', career);
  updateUserCareer = (id: string, career: any) => this.patch(`/career/user-careers/${id}`, career);
  getUserSkills = () => this.get('/career/user-skills');
  createUserSkill = (skill: any) => this.post('/career/user-skills', skill);
  updateUserSkill = (id: string, skill: any) => this.patch(`/career/user-skills/${id}`, skill);
  getAiAdvice = (params?: { careerId?: string; skills?: string }) => this.get('/career/ai-advice', params);
  getCareerApplications = () => this.get('/career/applications');
  applyToJob = (jobId: string, payload: { resume_url?: string; cover_letter?: string }) =>
    this.post('/career/applications', { jobId, ...payload });
  uploadResume = (file: { uri: string; name: string; type?: string }) => this.upload('/career/upload-resume', 'resume', file);


  getStemLabs = (params: { lat?: number; lng?: number; radius?: number; q?: string } = {}) =>
    this.get('/stem/labs', params);
  getNearbyLabs = (params: { lat: number; lng: number; radius?: number }) =>
    this.get('/stem/labs/nearby', params);
  createStemLab = (lab: any) => this.post('/stem/labs', lab);
  bookEquipment = (labId: string, payload: { equipment_id?: string; slot_start: string; slot_end: string; purpose?: string; participants?: number }) =>
    this.post(`/stem/labs/${labId}/book`, payload);


  searchLibrary = (q: string, limit = 10) => this.get('/library/search', { q, limit });
  getResource = (id: string) => this.get(`/library/resources/${id}`);
  getResourceSummary = (id: string) => this.get(`/library/resources/${id}/summary`);
  createResource = (resource: any) => this.post('/library/resources', resource);


  getMentor = (id: string) => this.get(`/mentoring/mentors/${id}`);
  getMentorSlots = (mentorId: string, params: { date?: string } = {}) =>
    this.get(`/mentoring/mentors/${mentorId}/slots`, params);
  recommendMentors = (userId: string) => this.get(`/mentoring/mentors/recommend/${userId}`);
  setAvailability = (payload: any) => this.post('/mentoring/availability', payload);
  getMyAvailability = () => this.get('/mentoring/me/availability');
  bookSession = (payload: { mentorId: string; slot: { start: string; end: string }; notes?: string }) =>
    this.post('/mentoring/book', payload);
  updateBookingStatus = (id: string, status: string) => this.patch(`/mentoring/bookings/${id}/status`, { status });
  getMyBookings = () => this.get('/mentoring/me/bookings');
  getStudentBookings = (studentId: string) => this.get(`/mentoring/student/${studentId}/bookings`);
  getMentorBookings = (mentorId: string) => this.get(`/mentoring/mentor/${mentorId}/bookings`);
  registerMentor = (userId: string, payload: any) => this.post(`/mentoring/register/${userId}`, payload);


  getPosts = (params?: QueryParams) => this.get('/community/posts', params);
  getPost = (id: string) => this.get(`/community/posts/${id}`);
  createPost = (post: { title: string; content: string; group_id?: string; tags?: string[] }) =>
    this.post('/community/posts', post);
  likePost = (id: string) => this.post(`/community/posts/${id}/like`);
  getComments = (postId: string) => this.get(`/community/posts/${postId}/comments`);
  createComment = (postId: string, comment: { content: string }) =>
    this.post(`/community/posts/${postId}/comments`, comment);
  getGroups = () => this.get('/community/groups');
  createGroup = (group: any) => this.post('/community/groups', group);
  joinGroup = (groupId: string) => this.post(`/community/groups/${groupId}/join`);
  getPendingPosts = () => this.get('/community/moderation/posts');
  moderatePost = (id: string, action: string) => this.post(`/community/moderation/posts/${id}`, { action });
  getPendingComments = () => this.get('/community/moderation/comments');
  moderateComment = (id: string, action: string) => this.post(`/community/moderation/comments/${id}`, { action });


  getChallenges = () => this.get('/green/challenges');
  logActivity = (payload: { challengeId: string; carbonSavedKg?: number }) => this.post('/green/activities', payload);
  getMyActivities = () => this.get('/green/activities/me');
  getGreenImpacts = () => this.get('/green/impacts');
  logImpact = (payload: { initiative: string; carbon_saved_kg: number; date: string }) =>
    this.post('/green/impacts', payload);


  getMyBadges = () => this.get('/gamification/my-badges');
  getMyProgress = () => this.get('/gamification/my-progress');
  getProgress = (userId: string) => this.get(`/gamification/progress/${userId}`);
  submitActivity = (payload: { challenge_id?: string; description: string; proof?: string }) =>
    this.post('/gamification/submit-activity', payload);
  getLeaderboard = () => this.get('/gamification/leaderboard');


  getCampaigns = (params?: QueryParams) => this.get('/donations/campaigns', params);
  getCampaign = (id: string) => this.get(`/donations/campaigns/${id}`);
  getDonors = (campaignId: string) => this.get(`/donations/campaigns/${campaignId}/donors`);
  createCampaign = (campaign: any) => this.post('/donations/campaigns', campaign);
  createPaymentUrl = (payload: { amount: number; campaignId?: string; bank_code?: string; description?: string }) =>
    this.post('/donations/payment-url', payload);
  donate = (payload: { campaignId: string; amount: number; is_anonymous?: boolean; transaction_id?: string }) =>
    this.post('/donations', payload);


  issueCertificate = (payload: { user_id: string; template_id: string; data?: any }) =>
    this.post('/certificates/issue', payload);
  verifyCertificate = (code: string) => this.get(`/certificates/verify/${code}`);
  getPortfolio = () => this.get('/certificates/portfolio');
  downloadCertificate = (code: string) => `${BASE_URL}/certificates/download/${code}.pdf`;


  getMyFiles = () => this.get('/storage/my-files');
  uploadFile = (file: { uri: string; name: string; type?: string }) =>
    this.upload('/storage/upload', 'file', file);
  deleteFile = (id: string) => this.delete(`/storage/files/${id}`);


  login = (payload: { email: string; password: string }) => this.post('/auth/login', payload);
  register = (payload: { email: string; password: string; full_name: string; phone?: string }) =>
    this.post('/auth/register', payload);
  getProfile = () => this.get('/auth/me');
  updateProfile = (data: any) => this.patch('/auth/profile', data);
  changePassword = (payload: { old_password: string; new_password: string }) =>
    this.post('/auth/change-password', {
      currentPassword: payload.old_password,
      newPassword: payload.new_password,
    });
  forgotPassword = (email: string) => this.post('/auth/forgot-password', { email });
  resetPassword = (payload: { token: string; new_password: string }) =>
    this.post('/auth/reset-password', {
      token: payload.token,
      newPassword: payload.new_password,
    });
  verifyTwoFactor = (payload: { userId: string; token: string }) => this.post('/auth/2fa/verify', payload);
  generate2FASecret = () => this.post('/auth/2fa/generate');


  refreshToken = (refreshToken: string, userId: string) => this.post('/auth/refresh', { refreshToken, userId });

  getProfileLegacy = () => this.get('/auth/profile');
}

export const apiService = new ApiService();

export default apiService;
