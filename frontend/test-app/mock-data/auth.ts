// Mock data for EduMap auth
// Used by the test-app mock server — NOT in production Docker/HF deployment.

export interface MockUser {
  id: string;
  userId: string;
  email: string;
  full_name: string;
  fullName: string;
  role: 'student' | 'teacher' | 'admin' | 'moderator';
  avatar_url: string;
  phone: string;
  bio: string;
  major: string;
}

export const mockAuth = {
  user: {
    id: 'mock-user-001',
    userId: 'mock-user-001',
    email: 'test@edumap.vn',
    full_name: 'Nguyễn Văn Test',
    fullName: 'Nguyễn Văn Test',
    role: 'student' as const,
    avatar_url: 'https://ui-avatars.com/api/?name=Nguyen+Van+Test&background=random',
    phone: '0123456789',
    bio: 'Sinh viên năm cuối chuyên ngành Công nghệ thông tin',
    major: 'Công nghệ thông tin',
  } as MockUser,

  tokens: {
    access_token: 'mock-access-jwt-token-for-testing',
    refresh_token: 'mock-refresh-jwt-token-for-testing',
  },
};
