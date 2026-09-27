/**
 * TypeScript models mirroring the EduMap backend resources (Bảng 6.2).
 * Types are intentionally permissive (responses are `{ success, data, ... }`)
 * to match the backend's actual shape without a live DB to introspect from.
 */

export type UUID = string;
export type ISODate = string;

export interface Poi {
  id: string;
  name: string;
  category: string;
  address: string;
  location: { lat: number; lng: number };
  status?: string;
  description?: string;
  images?: string[];
}

export interface LocationPoint {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  category_id?: number;
}

export interface FloodZone {
  id: string;
  name: string;
  severity: string;
  geometry: any;
  risk_level?: number;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  geometry: [number, number][];
}

export interface RouteResponse {
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
  steps?: RouteStep[];
  waypoints?: any[];
}

export interface Scholarship {
  id: string;
  title: string;
  description: string;
  amount: number;
  deadline: ISODate;
  requirements?: string;
  category?: string;
  status?: string;
  created_at?: ISODate;
}

export interface ScholarshipApplication {
  id: string;
  scholarshipId: string;
  user_id: string;
  status: string;
  personal_statement?: string;
  cv_url?: string;
  created_at?: ISODate;
}

export interface CareerPath {
  id: string;
  field: string;
  title: string;
  description: string;
  required_skills?: string[];
}

export interface SkillRoadmap {
  careerId: string;
  title: string;
  phases?: { name: string; skills: string[]; estimated_weeks?: number }[];
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  type?: string;
  description?: string;
  requirements?: string;
  status?: string;
  created_at?: ISODate;
}

export interface CareerApplication {
  id: string;
  jobId: string;
  user_id: string;
  status: string;
  resume_url?: string;
  cover_letter?: string;
  created_at?: ISODate;
}

export interface UserCareer {
  id: string;
  user_id: string;
  field: string;
  current_role?: string;
  target_role?: string;
  experience_years?: number;
  skills?: string[];
}

export interface StemLab {
  id: string;
  name: string;
  location: string;
  capacity?: number;
  description?: string;
  equipment?: any[];
  available_slots?: number;
}

export interface LibraryResource {
  id: string;
  title: string;
  author?: string;
  type?: string;
  category?: string;
  file_url?: string;
  description?: string;
  tags?: string[];
  created_at?: ISODate;
}

export interface Mentor {
  id: string;
  user_id?: string;
  full_name: string;
  email?: string;
  specialty: string;
  bio?: string;
  experience?: string;
  hourly_rate?: number;
  avatar_url?: string;
  rating?: number;
}

export interface MentorSlot {
  start: string;
  end: string;
  is_booked: boolean;
}

export interface Booking {
  id: string;
  mentor_id: string;
  student_id: string;
  slot_start: ISODate;
  slot_end: ISODate;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  amount?: number;
  payment_status?: string;
  meeting_url?: string;
  mentor?: Mentor;
  student?: { id: string; full_name: string };
}

export interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  author?: { id: string; full_name: string; avatar_url?: string };
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  group_id?: string;
  created_at: ISODate;
  updated_at?: ISODate;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: ISODate;
}

export interface GreenChallenge {
  id: string;
  title: string;
  description?: string;
  points?: number;
  carbon_saved_kg?: number;
  image_url?: string;
  status?: string;
  participants_count?: number;
}

export interface GreenImpact {
  id: string;
  initiative: string;
  carbon_saved_kg: number;
  date: string;
}

export interface GreenActivity {
  id: string;
  user_id: string;
  challenge_id: string;
  carbon_saved_kg: number;
  points_earned: number;
  created_at: ISODate;
}

export interface Badge {
  id: number;
  name: string;
  category?: string;
  rarity?: string;
  description?: string;
  points_criteria?: number;
}

export interface UserBadge {
  id: string;
  badge_id: number;
  badge?: Badge;
  name?: string;
  earned_at: ISODate;
}

export interface LeaderboardUser {
  id: string;
  full_name: string;
  avatar_url?: string;
  points: number;
  level?: number;
}

export interface DonationCampaign {
  id: string;
  title: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  end_date?: ISODate;
  status?: string;
  created_at?: ISODate;
  image_url?: string;
}

export interface Donation {
  id: string;
  campaign_id: string;
  user_id?: string;
  amount: number;
  transaction_id?: string;
  status?: string;
  is_anonymous?: boolean;
  created_at?: ISODate;
}

export interface Certificate {
  id: string;
  code: string;
  user_id: string;
  title: string;
  issued_at?: ISODate;
  expires_at?: ISODate;
  issuer?: string;
  template_id?: string;
  file_url?: string;
}

export interface VerifiedCertificate {
  valid: boolean;
  certificate?: Certificate;
  message?: string;
}

export interface UserFile {
  id: string;
  user_id: string;
  original_name: string;
  file_size?: number;
  mime_type?: string;
  url?: string;
  created_at?: ISODate;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  role?: string;
  role_id?: number;
  points?: number;
  level?: number;
  status?: string;
  email_verified?: boolean;
  two_factor_enabled?: boolean;
  preferences?: any;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  userId: string;
  email: string;
  full_name?: string;
  role?: string;
  message?: string;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
}

export interface DashboardStat {
  total_predictions?: number;
  accuracy_rate?: number;
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
