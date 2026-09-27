import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors, FontSize } from '../theme';
import type { RootParamList } from './types';

// Screens — Home
import HomeScreen from '../screens/HomeScreen';
// Screens — Map
import MapScreen from '../screens/MapScreen';
import LocationDetailScreen from '../screens/LocationDetailScreen';
import RouteScreen from '../screens/RouteScreen';
// Screens — Career
import CareerJobsScreen from '../screens/CareerJobsScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import CareerRoadmapScreen from '../screens/CareerRoadmapScreen';
import AiAdviceScreen from '../screens/AiAdviceScreen';
import CareersPathsScreen from '../screens/CareersPathsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
// Screens — More (hub)
import MoreDashboardScreen from '../screens/MoreDashboardScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatHistoryScreen from '../screens/ChatHistoryScreen';
import AiSearchScreen from '../screens/AiSearchScreen';
import LearningPathScreen from '../screens/LearningPathScreen';
import ScholarshipListScreen from '../screens/ScholarshipListScreen';
import ScholarshipDetailScreen from '../screens/ScholarshipDetailScreen';
import CheckEligibilityScreen from '../screens/CheckEligibilityScreen';
import ApplyScholarshipScreen from '../screens/ApplyScholarshipScreen';
import StemLabsScreen from '../screens/StemLabsScreen';
import BookEquipmentScreen from '../screens/BookEquipmentScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ResourceDetailScreen from '../screens/ResourceDetailScreen';
import MentorListScreen from '../screens/MentorListScreen';
import MentorDetailScreen from '../screens/MentorDetailScreen';
import BookMentorScreen from '../screens/BookMentorScreen';
import MyBookingsScreen from '../screens/MyBookingsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import GreenChallengesScreen from '../screens/GreenChallengesScreen';
import LogActivityScreen from '../screens/LogActivityScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import MyBadgesScreen from '../screens/MyBadgesScreen';
import MyProgressScreen from '../screens/MyProgressScreen';
import SubmitActivityScreen from '../screens/SubmitActivityScreen';
import DonateScreen from '../screens/DonateScreen';
import CampaignDetailScreen from '../screens/CampaignDetailScreen';
import CertificatePortfolioScreen from '../screens/CertificatePortfolioScreen';
import VerifyCertificateScreen from '../screens/VerifyCertificateScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UpdateProfileScreen from '../screens/UpdateProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import MyFilesScreen from '../screens/MyFilesScreen';
import UploadFileScreen from '../screens/UploadFileScreen';

type TabParamList = { Home: undefined; Map: undefined; Career: undefined; More: undefined };
const Tab = createBottomTabNavigator<TabParamList>();
const HomeStack = createNativeStackNavigator<RootParamList>();
const MapStack = createNativeStackNavigator<RootParamList>();
const CareerStack = createNativeStackNavigator<RootParamList>();
const MoreStack = createNativeStackNavigator<RootParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: Colors.card },
  headerTintColor: Colors.text,
  headerTintLabelStyle: { color: Colors.text },
} as const;

function HomeStackScreen() {
  return (
    <HomeStack.Navigator id="home-stack" screenOptions={screenOptions}>
      <HomeStack.Screen name="Home" component={HomeScreen} options={{ title: 'Trang chủ' }} />
    </HomeStack.Navigator>
  );
}

function MapStackScreen() {
  return (
    <MapStack.Navigator id="map-stack" screenOptions={screenOptions}>
      <MapStack.Screen name="MapList" component={MapScreen} options={{ title: 'Bản đồ' }} />
      <MapStack.Screen name="LocationDetail" component={LocationDetailScreen} options={{ title: 'Chi tiết' }} />
      <MapStack.Screen name="RouteScreen" component={RouteScreen} options={{ title: 'Đường đi' }} />
    </MapStack.Navigator>
  );
}

function CareerStackScreen() {
  return (
    <CareerStack.Navigator id="career-stack" screenOptions={screenOptions}>
      <CareerStack.Screen name="CareerJobs" component={CareerJobsScreen} options={{ title: 'Việc làm' }} />
      <CareerStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Chi tiết việc' }} />
      <CareerStack.Screen name="CareerRoadmap" component={CareerRoadmapScreen} options={{ title: 'Lộ trình' }} />
      <CareerStack.Screen name="AiAdvice" component={AiAdviceScreen} options={{ title: 'Lời khuyên AI' }} />
      <CareerStack.Screen name="CareersPaths" component={CareersPathsScreen} options={{ title: 'Ngành nghề' }} />
      <CareerStack.Screen name="UserProfileScreen" component={UserProfileScreen} options={{ title: 'Hồ sơ ngành' }} />
    </CareerStack.Navigator>
  );
}

function MoreStackScreen() {
  return (
    <MoreStack.Navigator id="more-stack" screenOptions={screenOptions}>
      <MoreStack.Screen name="MoreDashboard" component={MoreDashboardScreen} options={{ title: 'Tính năng' }} />
      <MoreStack.Screen name="Chat" component={ChatScreen} options={{ title: 'AI Chat' }} />
      <MoreStack.Screen name="ChatHistory" component={ChatHistoryScreen} options={{ title: 'Lịch sử chat' }} />
      <MoreStack.Screen name="AiSearch" component={AiSearchScreen} options={{ title: 'Tìm AI' }} />
      <MoreStack.Screen name="LearningPath" component={LearningPathScreen} options={{ title: 'Lộ trình học' }} />
      <MoreStack.Screen name="ScholarshipList" component={ScholarshipListScreen} options={{ title: 'Học bổng' }} />
      <MoreStack.Screen name="ScholarshipDetail" component={ScholarshipDetailScreen} options={{ title: 'Chi tiết học bổng' }} />
      <MoreStack.Screen name="CheckEligibility" component={CheckEligibilityScreen} options={{ title: 'Kiểm tra' }} />
      <MoreStack.Screen name="ApplyScholarship" component={ApplyScholarshipScreen} options={{ title: 'Nộp đơn' }} />
      <MoreStack.Screen name="StemLabs" component={StemLabsScreen} options={{ title: 'Lab STEM' }} />
      <MoreStack.Screen name="BookEquipment" component={BookEquipmentScreen} options={{ title: 'Đặt thiết bị' }} />
      <MoreStack.Screen name="Library" component={LibraryScreen} options={{ title: 'Thư viện' }} />
      <MoreStack.Screen name="ResourceDetail" component={ResourceDetailScreen} options={{ title: 'Chi tiết tài nguyên' }} />
      <MoreStack.Screen name="MentorList" component={MentorListScreen} options={{ title: 'Mentor' }} />
      <MoreStack.Screen name="MentorDetail" component={MentorDetailScreen} options={{ title: 'Chi tiết mentor' }} />
      <MoreStack.Screen name="BookMentor" component={BookMentorScreen} options={{ title: 'Đặt lịch' }} />
      <MoreStack.Screen name="MyBookings" component={MyBookingsScreen} options={{ title: 'Lịch hẹn' }} />
      <MoreStack.Screen name="Community" component={CommunityScreen} options={{ title: 'Cộng đồng' }} />
      <MoreStack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Bài viết' }} />
      <MoreStack.Screen name="CreatePost" component={CreatePostScreen} options={{ title: 'Tạo bài' }} />
      <MoreStack.Screen name="GreenChallenges" component={GreenChallengesScreen} options={{ title: 'Thử thách xanh' }} />
      <MoreStack.Screen name="LogActivity" component={LogActivityScreen} options={{ title: 'Ghi nhận' }} />
      <MoreStack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Bảng xếp hạng' }} />
      <MoreStack.Screen name="MyBadges" component={MyBadgesScreen} options={{ title: 'Huy hiệu' }} />
      <MoreStack.Screen name="MyProgress" component={MyProgressScreen} options={{ title: 'Tiến độ' }} />
      <MoreStack.Screen name="SubmitActivity" component={SubmitActivityScreen} options={{ title: 'Gửi hoạt động' }} />
      <MoreStack.Screen name="Donate" component={DonateScreen} options={{ title: 'Quyên góp' }} />
      <MoreStack.Screen name="CampaignDetail" component={CampaignDetailScreen} options={{ title: 'Chiến dịch' }} />
      <MoreStack.Screen name="CertificatePortfolio" component={CertificatePortfolioScreen} options={{ title: 'Chứng chỉ' }} />
      <MoreStack.Screen name="VerifyCertificate" component={VerifyCertificateScreen} options={{ title: 'Xác minh' }} />
      <MoreStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Tôi' }} />
      <MoreStack.Screen name="UpdateProfile" component={UpdateProfileScreen} options={{ title: 'Cập nhật hồ sơ' }} />
      <MoreStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Đổi mật khẩu' }} />
      <MoreStack.Screen name="MyFiles" component={MyFilesScreen} options={{ title: 'Tệ tin' }} />
      <MoreStack.Screen name="UploadFile" component={UploadFileScreen} options={{ title: 'Tải lên' }} />
    </MoreStack.Navigator>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      id="main-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: FontSize.xs, paddingBottom: 4 },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackScreen} options={{ title: 'Trang chủ' }} />
      <Tab.Screen name="Map" component={MapStackScreen} options={{ title: 'Bản đồ' }} />
      <Tab.Screen name="Career" component={CareerStackScreen} options={{ title: 'Ngành nghề' }} />
      <Tab.Screen name="More" component={MoreStackScreen} options={{ title: 'Tính năng' }} />
    </Tab.Navigator>
  );
}

export default MainTabs;
