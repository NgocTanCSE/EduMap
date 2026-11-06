import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';


export type RootParamList = {

  Login: undefined;
  Register: undefined;
  TwoFactor: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string };


  MainTabs: undefined;


  Home: undefined;


  MapList: undefined;
  LocationDetail: { id: string; name?: string; category?: string; address?: string; lat?: number; lng?: number };
  RouteScreen: { origin?: string; destination?: string };


  Chat: undefined;
  ChatHistory: undefined;
  AiSearch: undefined;
  LearningPath: undefined;
  OfflineTutor: undefined;


  CareerJobs: undefined;
  JobDetail: { id: string };
  CareerRoadmap: { careerId: string };
  AiAdvice: undefined;
  CareersPaths: undefined;
  UserProfileScreen: undefined;


  ScholarshipList: { query?: string; category?: string };
  ScholarshipDetail: { id: string; title?: string; description?: string; amount?: number; deadline?: string; requirements?: string; status?: string };
  CheckEligibility: { scholarshipId: string };
  ApplyScholarship: { scholarshipId: string };


  StemLabs: undefined;
  BookEquipment: { labId: string };


  Library: { query?: string };
  ResourceDetail: { id: string };


  MentorList: { specialty?: string };
  MentorDetail: { id: string };
  BookMentor: { mentorId: string };
  MyBookings: undefined;


  Community: undefined;
  PostDetail: { id: string };
  CreatePost: undefined;


  GreenChallenges: undefined;
  LogActivity: { challengeId?: string };


  Leaderboard: undefined;
  MyBadges: undefined;
  MyProgress: undefined;
  SubmitActivity: undefined;


  Donate: undefined;
  CampaignDetail: { id: string };


  CertificatePortfolio: undefined;
  VerifyCertificate: { code?: string };


  Profile: undefined;
  UpdateProfile: undefined;
  ChangePassword: undefined;
  MyFiles: undefined;
  UploadFile: undefined;


  MoreDashboard: undefined;
};

export type ScreenProps<T extends keyof RootParamList> = NativeStackScreenProps<RootParamList, T>;
export type NavProp = NativeStackNavigationProp<RootParamList>;
export type RouteOf<T extends keyof RootParamList> = RouteProp<RootParamList, T>;
