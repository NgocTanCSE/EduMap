// Mock data for EduMap career features
// Used by the test-app mock server — NOT in production Docker/HF deployment.

export interface MockCareerPath {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_weeks: number;
  skills: string[];
}

export interface MockJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_range: string;
  description: string;
  requirements: string[];
  category: string;
  posted_at: string;
}

export const mockCareer = {
  paths: [
    {
      id: 'career-path-001',
      title: 'Lộ trình Phát triển Web Fullstack',
      description: 'Từ cơ bản đến nâng cao với React, Node.js, và PostgreSQL',
      difficulty: 'beginner' as const,
      duration_weeks: 12,
      skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'PostgreSQL'],
    },
    {
      id: 'career-path-002',
      title: 'Lộ trình Trí tuệ nhân tạo',
      description: 'Học máy và deep learning với Python',
      difficulty: 'advanced' as const,
      duration_weeks: 20,
      skills: ['Python', 'Machine Learning', 'TensorFlow', 'PyTorch'],
    },
    {
      id: 'career-path-003',
      title: 'Lộ trình Thiết kế UI/UX',
      description: 'Thiết kế giao diện người dùng chuyên nghiệp',
      difficulty: 'intermediate' as const,
      duration_weeks: 8,
      skills: ['Figma', 'UI Design', 'User Research', 'Prototyping'],
    },
  ] as MockCareerPath[],

  jobs: [
    {
      id: 'job-001',
      title: 'Frontend Developer (Internship)',
      company: 'Công ty TNHH Công nghệ EduMap',
      location: 'Biên Hòa, Đồng Nai',
      salary_range: '4-6 triệu/tháng',
      description: 'Phát triển giao diện web với React và TailwindCSS',
      requirements: ['React', 'TypeScript', 'TailwindCSS', 'Responsive Design'],
      category: 'technology',
      posted_at: '2025-01-15',
    },
    {
      id: 'job-002',
      title: 'Data Analyst',
      company: 'Công ty TNHH Dữ liệu Việt',
      location: 'TP. Hồ Chí Minh',
      salary_range: '8-12 triệu/tháng',
      description: 'Phân tích dữ liệu giáo dục và đưa ra đề xuất cải tiến',
      requirements: ['SQL', 'Python', 'Pandas', 'Data Visualization'],
      category: 'data',
      posted_at: '2025-01-10',
    },
  ] as MockJob[],
};
