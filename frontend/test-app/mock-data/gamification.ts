// Mock data for EduMap gamification & analytics
// Used by the test-app mock server — NOT in production Docker/HF deployment.

export const mockGamification = {
  leaderboard: [
    { id: 'user-001', full_name: 'Nguyễn Văn Test', avatar_url: 'https://ui-avatars.com/api/?name=Test', points: 1250, rank: 1, badges: 5 },
    { id: 'user-002', full_name: 'Trần Thị A', avatar_url: 'https://ui-avatars.com/api/?name=A', points: 1100, rank: 2, badges: 4 },
    { id: 'user-003', full_name: 'Lê Văn B', avatar_url: 'https://ui-avatars.com/api/?name=B', points: 980, rank: 3, badges: 3 },
    { id: 'user-004', full_name: 'Phạm Thị C', avatar_url: 'https://ui-avatars.com/api/?name=C', points: 875, rank: 4, badges: 3 },
    { id: 'user-005', full_name: 'Đỗ Văn D', avatar_url: 'https://ui-avatars.com/api/?name=D', points: 760, rank: 5, badges: 2 },
  ],

  userProgress: {
    points: 1250,
    level: 5,
    badges: 5,
    streak: 12,
    activities: [
      { id: 'act-001', type: 'map_view', description: 'Xem bản đồ 5 lần', points: 50, date: '2025-01-15' },
      { id: 'act-002', type: 'ai_chat', description: 'Trò chuyện với AI 3 lần', points: 30, date: '2025-01-14' },
      { id: 'act-003', type: 'bookmark', description: 'Lưu 2 trường học', points: 20, date: '2025-01-13' },
    ],
  },

  analytics: {
    total_users: 1250,
    active_today: 87,
    map_views: 4500,
    ai_queries: 230,
    growth_rate: '+' + 15.2 + '%',
  },

  dashboardOverview: {
    total_schools: 428,
    total_libraries: 15,
    total_wifi: 47,
    total_books: 80,
    active_users: 1250,
    ai_interactions: 230,
  },
};
