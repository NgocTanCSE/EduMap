/**
 * Reporting-specific TypeScript types.
 * Used by the reporting interface pages and services.
 */

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  fullName?: string;
  role: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  last_login?: string;
}

export interface AdminStats {
  total_users: number;
  total_schools: number;
  total_libraries: number;
  total_wifi: number;
  total_books: number;
  active_users: number;
  ai_interactions: number;
  growth_rate: string;
}

export interface AnalyticsEvent {
  event_type: string;
  user_id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface DashboardOverview {
  total_schools: number;
  total_libraries: number;
  total_wifi: number;
  total_books: number;
  active_users: number;
  ai_interactions: number;
}

export interface LeaderboardEntry {
  id: string;
  full_name: string;
  avatar_url: string;
  points: number;
  rank: number;
  badges: number;
}

export interface UserProgress {
  points: number;
  level: number;
  badges: number;
  streak: number;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    points: number;
    date: string;
  }>;
}

export interface NotificationReport {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}
