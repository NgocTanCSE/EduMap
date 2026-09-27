import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

/**
 * Single shared param-list for the whole app. Every feature stack reuses this so
 * screens can navigate across the app cleanly (cross-stack links remain within
 * one navigator at runtime).
 */
export type RootParamList = {
  // Auth
  Login: undefined;
  Register: undefined;
  TwoFactor: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string };

  // Root
  MainTabs: undefined;

  // Home
  Home: undefined;

  // Map
  MapList: undefined;
  LocationDetail: { id: string; name?: string; category?: string; address?: string; lat?: number; lng?: number };
  RouteScreen: { origin?: string; destination?: string };

  // AI
  Chat: undefined;
  ChatHistory: undefined;
  AiSearch: undefined;
  LearningPath: undefined;

  // Career
  CareerJobs: undefined;
  JobDetail: { id: string };
  CareerRoadmap: { careerId: string };
  AiAdvice: undefined;
  CareersPaths: undefined;
  UserProfileScreen: undefined;

  // Scholarships
  ScholarshipList: { query?: string; category?: string };
  ScholarshipDetail: { id: string; title?: string; description?: string; amount?: number; deadline?: string; requirements?: string; status?: string };
  CheckEligibility: { scholarshipId: string };
  ApplyScholarship: { scholarshipId: string };

  // STEM
  StemLabs: undefined;
  BookEquipment: { labId: string };

  // Library
  Library: { query?: string };
  ResourceDetail: { id: string };

  // Mentor
  MentorList: { specialty?: string };
  MentorDetail: { id: string };
  BookMentor: { mentorId: string };
  MyBookings: undefined;

  // Community
  Community: undefined;
  PostDetail: { id: string };
  CreatePost: undefined;

  // Green
  GreenChallenges: undefined;
  LogActivity: { challengeId?: string };

  // Gamification
  Leaderboard: undefined;
  MyBadges: undefined;
  MyProgress: undefined;
  SubmitActivity: undefined;

  // Donate
  Donate: undefined;
  CampaignDetail: { id: string };

  // Certificates
  CertificatePortfolio: undefined;
  VerifyCertificate: { code?: string };

  // Profile / Storage
  Profile: undefined;
  UpdateProfile: undefined;
  ChangePassword: undefined;
  MyFiles: undefined;
  UploadFile: undefined;

  // Misc
  MoreDashboard: undefined;
};

export type ScreenProps<T extends keyof RootParamList> = NativeStackScreenProps<RootParamList, T>;
export type NavProp = NativeStackNavigationProp<RootParamList>;
export type RouteOf<T extends keyof RootParamList> = RouteProp<RootParamList, T>;
