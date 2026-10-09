"use client";
import React, { useState, useMemo } from 'react';
import { Search, Filter, ExternalLink, Code, Server, Globe, Package, Layers } from 'lucide-react';
import { EduMapLogo } from '@/components/ui/Logo';

interface EndpointInfo {
  name: string;
  path: string;
  type: 'page' | 'api' | 'controller' | 'component' | 'service';
  feature: string;
  method?: string;
  description?: string;
}

// All endpoints, components, controllers, and services
const ALL_ENDPOINTS: EndpointInfo[] = [
  // ─── FRONTEND PAGES ───
  { name: 'Trang chủ', path: '/', type: 'page', feature: 'Core' },
  { name: 'Bản đồ', path: '/map', type: 'page', feature: 'Map' },
  { name: 'Đăng nhập', path: '/auth/login', type: 'page', feature: 'Auth' },
  { name: 'Đăng ký', path: '/auth/register', type: 'page', feature: 'Auth' },
  { name: 'Quên mật khẩu', path: '/auth/forgot-password', type: 'page', feature: 'Auth' },
  { name: 'Học bổng', path: '/scholarships', type: 'page', feature: 'Scholarship' },
  { name: 'Chi tiết học bổng', path: '/scholarships/[id]', type: 'page', feature: 'Scholarship' },
  { name: 'Ngành nghề', path: '/career', type: 'page', feature: 'Career' },
  { name: 'Việc làm', path: '/career/jobs', type: 'page', feature: 'Career' },
  { name: 'Chi tiết việc làm', path: '/career/jobs/[id]', type: 'page', feature: 'Career' },
  { name: 'Dự báo nghề', path: '/career/predictive', type: 'page', feature: 'Career' },
  { name: 'Đường dẫn nghề', path: '/career/roadmap', type: 'page', feature: 'Career' },
  { name: 'Quiz nghề', path: '/career/quiz', type: 'page', feature: 'Career' },
  { name: 'Hồ sơ nghề', path: '/career/profile', type: 'page', feature: 'Career' },
  { name: 'Mentor', path: '/mentor', type: 'page', feature: 'Mentor' },
  { name: 'Chi tiết mentor', path: '/mentor/[id]', type: 'page', feature: 'Mentor' },
  { name: 'Cuộc gọi mentor', path: '/mentor/call', type: 'page', feature: 'Mentor' },
  { name: 'Thư viện', path: '/library', type: 'page', feature: 'Library' },
  { name: 'Tài nguyên', path: '/library/resources/[id]', type: 'page', feature: 'Library' },
  { name: 'Tìm wifi', path: '/wifi', type: 'page', feature: 'Wifi' },
  { name: 'STEM Labs', path: '/stem', type: 'page', feature: 'STEM' },
  { name: 'Chi tiết lab', path: '/stem/labs/[id]', type: 'page', feature: 'STEM' },
  { name: 'Cộng đồng', path: '/community', type: 'page', feature: 'Community' },
  { name: 'Bài viết', path: '/community/post/[id]', type: 'page', feature: 'Community' },
  { name: 'Sự kiện', path: '/events', type: 'page', feature: 'Event' },
  { name: 'Chi tiết sự kiện', path: '/events/[id]', type: 'page', feature: 'Event' },
  { name: 'Tình nguyện', path: '/volunteer', type: 'page', feature: 'Volunteer' },
  { name: 'Thực tập', path: '/internships', type: 'page', feature: 'Internship' },
  { name: 'Chi tiết thực tập', path: '/internships/[id]', type: 'page', feature: 'Internship' },
  { name: 'Trang trải nghiệm', path: '/hackathon', type: 'page', feature: 'Hackathon' },
  { name: 'Chi tiết hackathon', path: '/hackathon/[id]', type: 'page', feature: 'Hackathon' },
  { name: 'Quà tặng', path: '/marketplace', type: 'page', feature: 'Marketplace' },
  { name: 'Sản phẩm', path: '/marketplace/products', type: 'page', feature: 'Marketplace' },
  { name: 'Dịch vụ', path: '/marketplace/services', type: 'page', feature: 'Marketplace' },
  { name: 'Giỏ hàng', path: '/marketplace/cart', type: 'page', feature: 'Marketplace' },
  { name: 'Sách', path: '/marketplace/books', type: 'page', feature: 'Marketplace' },
  { name: 'Quyên góp', path: '/donate', type: 'page', feature: 'Donate' },
  { name: 'Chiến dịch', path: '/donate/campaign/[id]', type: 'page', feature: 'Donate' },
  { name: 'Chứng chỉ', path: '/certificates', type: 'page', feature: 'Certificate' },
  { name: 'Xác minh CC', path: '/certificates/verify/[code]', type: 'page', feature: 'Certificate' },
  { name: 'Bảng xếp hạng', path: '/leaderboard', type: 'page', feature: 'Gamification' },
  { name: 'Hoạt động', path: '/summer', type: 'page', feature: 'Summer' },
  { name: 'Khảo sát', path: '/surveys', type: 'page', feature: 'Survey' },
  { name: 'Chi tiết khảo sát', path: '/surveys/[id]', type: 'page', feature: 'Survey' },
  { name: 'Dashboard', path: '/dashboard', type: 'page', feature: 'Dashboard' },
  { name: 'Hồ sơ', path: '/profile', type: 'page', feature: 'Profile' },
  { name: 'Tài nguyên xanh', path: '/green', type: 'page', feature: 'Green' },
  { name: 'Kết nối trường', path: '/hs-connection', type: 'page', 'feature': 'HS-Connection' },
  { name: 'Cơ hội', path: '/opportunities', type: 'page', feature: 'Opportunity' },
  { name: 'Chi tiết cơ hội', path: '/opportunities/[id]', type: 'page', feature: 'Opportunity' },
  { name: 'Đơn hàng', path: '/storage', type: 'page', feature: 'Storage' },
  { name: 'Báo cáo', path: '/admin/reports', type: 'page', feature: 'Admin' },
  { name: 'Quản lý người dùng', path: '/admin/users', type: 'page', feature: 'Admin' },
  { name: 'Quản lý vai trò', path: '/admin/roles', type: 'page', feature: 'Admin' },
  { name: 'Dashboard admin', path: '/admin/dashboard', type: 'page', feature: 'Admin' },
  { name: 'Biểu đồ nhiệt', path: '/admin/analytics/heatmap', type: 'page', feature: 'Admin' },
  { name: 'Phân tích', path: '/analytics', type: 'page', feature: 'Analytics' },
  { name: 'Xu hướng', path: '/analytics/trends', type: 'page', feature: 'Analytics' },
  { name: 'AI Chat', path: '/ai-chat', type: 'page', feature: 'AI' },
  { name: 'Moderator', path: '/moderator', type: 'page', feature: 'Community' },
  { name: 'Thông báo', path: '/notifications', type: 'page', feature: 'Notifications' },
  { name: 'Đơn thực tập', path: '/mobile-unit', type: 'page', feature: 'Mobile' },

  // ─── API ROUTES (BFF) ───
  { name: 'Auth login', path: '/api/auth/login', type: 'api', method: 'POST', feature: 'Auth' },
  { name: 'Auth register', path: '/api/auth/register', type: 'api', method: 'POST', feature: 'Auth' },
  { name: 'Auth profile', path: '/api/auth/profile', type: 'api', method: 'GET/PATCH', feature: 'Auth' },
  { name: 'Auth refresh', path: '/api/auth/refresh', type: 'api', method: 'POST', feature: 'Auth' },
  { name: 'Auth Google', path: '/api/auth/google', type: 'api', method: 'POST', feature: 'Auth' },
  { name: 'Auth forgot', path: '/api/auth/forgot-password', type: 'api', method: 'POST', feature: 'Auth' },
  { name: 'Auth reset', path: '/api/auth/reset-password', type: 'api', method: 'POST', feature: 'Auth' },
  { name: 'Auth change pw', path: '/api/auth/change-password', type: 'api', method: 'POST', feature: 'Auth' },
  { name: 'Config', path: '/api/config', type: 'api', method: 'GET', feature: 'Core' },
  { name: 'Scholarships', path: '/api/scholarships', type: 'api', method: 'GET', feature: 'Scholarship' },
  { name: 'Apply scholarship', path: '/api/scholarships/[id]/apply', type: 'api', method: 'POST', feature: 'Scholarship' },
  { name: 'Check eligibility', path: '/api/scholarships/[id]/check-eligibility', type: 'api', method: 'GET', feature: 'Scholarship' },
  { name: 'My applications', path: '/api/scholarships/me/applications', type: 'api', method: 'GET', feature: 'Scholarship' },
  { name: 'Career paths', path: '/api/career/paths', type: 'api', method: 'GET', feature: 'Career' },
  { name: 'Career jobs', path: '/api/career/jobs', type: 'api', method: 'GET', feature: 'Career' },
  { name: 'Apply job', path: '/api/career/applications', type: 'api', method: 'POST', feature: 'Career' },
  { name: 'User skills', path: '/api/career/user-skills', type: 'api', method: 'GET/POST', feature: 'Career' },
  { name: 'Upload resume', path: '/api/career/upload-resume', type: 'api', method: 'POST', feature: 'Career' },
  { name: 'Mentors', path: '/api/mentoring/mentors', type: 'api', method: 'GET', feature: 'Mentor' },
  { name: 'Book mentor', path: '/api/mentoring/book', type: 'api', method: 'POST', feature: 'Mentor' },
  { name: 'My bookings', path: '/api/mentoring/me/bookings', type: 'api', method: 'GET', feature: 'Mentor' },
  { name: 'Booking status', path: '/api/mentoring/bookings/[id]/status', type: 'api', method: 'PATCH', feature: 'Mentor' },
  { name: 'Mentor slots', path: '/api/mentoring/mentors/[id]/slots', type: 'api', method: 'GET', feature: 'Mentor' },
  { name: 'Mentor recommend', path: '/api/mentoring/mentors/[id]/recommend', type: 'api', method: 'GET', feature: 'Mentor' },
  { name: 'Map POIs', path: '/api/map/pois', type: 'api', method: 'GET', feature: 'Map' },
  { name: 'Map categories', path: '/api/map/categories', type: 'api', method: 'GET', feature: 'Map' },
  { name: 'Map locations', path: '/api/map/locations', type: 'api', method: 'GET', feature: 'Map' },
  { name: 'Map routing', path: '/api/map/routing/route/route', type: 'api', method: 'GET', feature: 'Map' },
  { name: 'Map stats', path: '/api/map/stats', type: 'api', method: 'GET', feature: 'Map' },
  { name: 'Map AI analysis', path: '/api/map/ai-analysis', type: 'api', method: 'POST', feature: 'Map' },
  { name: 'AI chat', path: '/api/ai/chat', type: 'api', method: 'POST', feature: 'AI' },
  { name: 'AI history', path: '/api/ai/history', type: 'api', method: 'GET', feature: 'AI' },
  { name: 'AI learning path', path: '/api/ai/learning-path', type: 'api', method: 'POST', feature: 'AI' },
  { name: 'AI analytics stats', path: '/api/ai/analytics/stats', type: 'api', method: 'GET', feature: 'AI' },
  { name: 'Library resources', path: '/api/library/resources', type: 'api', method: 'GET', feature: 'Library' },
  { name: 'Library search', path: '/api/library/search', type: 'api', method: 'GET', feature: 'Library' },
  { name: 'Library summary', path: '/api/library/resources/[id]/summary', type: 'api', method: 'GET', feature: 'Library' },
  { name: 'Wifi locations', path: '/api/wifi/locations', type: 'api', method: 'GET', feature: 'Wifi' },
  { name: 'Wifi nearby', path: '/api/wifi/locations/nearby', type: 'api', method: 'GET', feature: 'Wifi' },
  { name: 'STEM labs', path: '/api/stem/labs', type: 'api', method: 'GET', feature: 'STEM' },
  { name: 'Book lab', path: '/api/stem/labs/[id]/book', type: 'api', method: 'POST', feature: 'STEM' },
  { name: 'Community posts', path: '/api/community/posts', type: 'api', method: 'GET/POST', feature: 'Community' },
  { name: 'Community comments', path: '/api/community/posts/[id]/comments', type: 'api', method: 'GET/POST', feature: 'Community' },
  { name: 'Like post', path: '/api/community/posts/[id]/like', type: 'api', method: 'POST', feature: 'Community' },
  { name: 'Groups', path: '/api/community/groups', type: 'api', method: 'GET', feature: 'Community' },
  { name: 'Moderation', path: '/api/community/moderation', type: 'api', method: 'GET', feature: 'Community' },
  { name: 'Events', path: '/api/events', type: 'api', method: 'GET', feature: 'Event' },
  { name: 'Register event', path: '/api/events/[id]/register', type: 'api', method: 'POST', feature: 'Event' },
  { name: 'Volunteers', path: '/api/volunteers', type: 'api', method: 'GET', feature: 'Volunteer' },
  { name: 'Activities', path: '/api/volunteers/activities', type: 'api', method: 'GET', feature: 'Volunteer' },
  { name: 'Internships', path: '/api/internships', type: 'api', method: 'GET', feature: 'Internship' },
  { name: 'Apply internship', path: '/api/internships/[id]/apply', type: 'api', method: 'POST', feature: 'Internship' },
  { name: 'Hackathons', path: '/api/hackathons', type: 'api', method: 'GET', feature: 'Hackathon' },
  { name: 'Hackathon teams', path: '/api/hackathons/teams/[teamId]/submit', type: 'api', method: 'POST', feature: 'Hackathon' },
  { name: 'Donations', path: '/api/donations/campaigns', type: 'api', method: 'GET', feature: 'Donate' },
  { name: 'Donate', path: '/api/donations/campaigns/[id]', type: 'api', method: 'POST', feature: 'Donate' },
  { name: 'Certificates', path: '/api/certificates/portfolio', type: 'api', method: 'GET', feature: 'Certificate' },
  { name: 'Issue certificate', path: '/api/certificates/issue', type: 'api', method: 'POST', feature: 'Certificate' },
  { name: 'Verify certificate', path: '/api/certificates/verify/[code]', type: 'api', method: 'GET', feature: 'Certificate' },
  { name: 'Leaderboard', path: '/api/gamification/leaderboard', type: 'api', method: 'GET', feature: 'Gamification' },
  { name: 'My badges', path: '/api/gamification/my-badges', type: 'api', method: 'GET', feature: 'Gamification' },
  { name: 'My progress', path: '/api/gamification/my-progress', type: 'api', method: 'GET', feature: 'Gamification' },
  { name: 'Submit activity', path: '/api/gamification/submit-activity', type: 'api', method: 'POST', feature: 'Gamification' },
  { name: 'Pending activities', path: '/api/gamification/pending-activities', type: 'api', method: 'GET', feature: 'Gamification' },
  { name: 'Analytics', path: '/api/analytics', type: 'api', method: 'GET', feature: 'Analytics' },
  { name: 'AI analytics', path: '/api/ai/analytics/stats', type: 'api', method: 'GET', feature: 'AI' },
  { name: 'Dashboard overview', path: '/api/dashboard/overview', type: 'api', method: 'GET', feature: 'Dashboard' },
  { name: 'Dashboard insight', path: '/api/dashboard/insight', type: 'api', method: 'GET', feature: 'Dashboard' },
  { name: 'Admin dashboard', path: '/api/admin/dashboard', type: 'api', method: 'GET', feature: 'Admin' },
  { name: 'Admin users', path: '/api/admin/users', type: 'api', method: 'GET', feature: 'Admin' },
  { name: 'Business', path: '/api/business', type: 'api', method: 'GET', feature: 'Marketplace' },
  { name: 'Checkout', path: '/api/business/checkout', type: 'api', method: 'POST', feature: 'Marketplace' },
  { name: 'Orders', path: '/api/business/orders', type: 'api', method: 'GET', feature: 'Marketplace' },
  { name: 'Cart', path: '/api/business/cart', type: 'api', method: 'GET/POST', feature: 'Marketplace' },
  { name: 'Products', path: '/api/business/products', type: 'api', method: 'GET', feature: 'Marketplace' },
  { name: 'Services', path: '/api/business/services', type: 'api', method: 'GET', feature: 'Marketplace' },
  { name: 'Payment checkout', path: '/api/payment/checkout', type: 'api', method: 'POST', feature: 'Payment' },
  { name: 'Payment process', path: '/api/payment/process', type: 'api', method: 'POST', feature: 'Payment' },
  { name: 'Share items', path: '/api/share/items', type: 'api', method: 'GET', feature: 'Share' },
  { name: 'Share requests', path: '/api/share/requests', type: 'api', method: 'POST', feature: 'Share' },
  { name: 'Storage upload', path: '/api/storage/upload', type: 'api', method: 'POST', feature: 'Storage' },
  { name: 'Storage files', path: '/api/storage/my-files', type: 'api', method: 'GET', feature: 'Storage' },
  { name: 'Roles', path: '/api/roles', type: 'api', method: 'GET/POST', feature: 'Admin' },
  { name: 'Notifications', path: '/api/notifications', type: 'api', method: 'GET', feature: 'Notifications' },
  { name: 'Read notification', path: '/api/notifications/[id]/read', type: 'api', method: 'POST', feature: 'Notifications' },
  { name: 'Intl alumni', path: '/api/intl/alumni', type: 'api', method: 'GET', feature: 'Intl' },
  { name: 'Intl programs', path: '/api/intl/programs', type: 'api', method: 'GET', feature: 'Intl' },
  { name: 'Intl nearby', path: '/api/intl/alumni/nearby', type: 'api', method: 'GET', feature: 'Intl' },
  { name: 'Summer campaigns', path: '/api/summer-campaigns', type: 'api', method: 'GET', feature: 'Summer' },
  { name: 'Register campaign', path: '/api/summer-campaigns/[id]/register', type: 'api', method: 'POST', feature: 'Summer' },
  { name: 'Daily report', path: '/api/summer-campaigns/[id]/daily-report', type: 'api', method: 'POST', feature: 'Summer' },
  { name: 'Mobile units', path: '/api/mobile-config/units', type: 'api', method: 'GET', feature: 'Mobile' },
  { name: 'Unit schedule', path: '/api/mobile-config/units/[id]/schedule', type: 'api', method: 'GET', feature: 'Mobile' },
  { name: 'Green challenges', path: '/api/green/challenges', type: 'api', method: 'GET', feature: 'Green' },
  { name: 'Blockchain verify', path: '/api/blockchain/verify/[code]', type: 'api', method: 'GET', feature: 'Certificate' },

  // ─── BACKEND CONTROLLERS ───
  { name: 'AuthController', path: 'auth.controller.ts', type: 'controller', feature: 'Auth', description: 'Login, register, JWT, Google OAuth' },
  { name: 'MapController', path: 'map.controller.ts', type: 'controller', feature: 'Map', description: 'POIs, locations, categories, stats' },
  { name: 'RoutingController', path: 'routing.controller.ts', type: 'controller', feature: 'Map', description: 'OSRM routing, flood zones, traffic' },
  { name: 'AIController', path: 'ai.controller.ts', type: 'controller', feature: 'AI', description: 'Chat, history, learning-path' },
  { name: 'ScholarshipController', path: 'scholarship.controller.ts', type: 'controller', feature: 'Scholarship', description: 'Học bổng CRUD' },
  { name: 'CareerController', path: 'career.controller.ts', type: 'controller', feature: 'Career', description: 'Jobs, paths, applications' },
  { name: 'MentorController', path: 'mentor.controller.ts', type: 'controller', feature: 'Mentor', description: 'Mentor CRUD, bookings' },
  { name: 'LibraryController', path: 'library.controller.ts', type: 'controller', feature: 'Library', description: 'Resources, search' },
  { name: 'CommunityController', path: 'community.controller.ts', type: 'controller', feature: 'Community', description: 'Posts, comments, groups' },
  { name: 'EventsController', path: 'events.controller.ts', type: 'controller', feature: 'Event', description: 'Events, registration' },
  { name: 'InternshipController', path: 'internship.controller.ts', type: 'controller', feature: 'Internship', description: 'Internships, applications' },
  { name: 'HackathonController', path: 'hackathon.controller.ts', type: 'controller', feature: 'Hackathon', description: 'Hackathons, teams' },
  { name: 'DonateController', path: 'donate.controller.ts', type: 'controller', feature: 'Donate', description: 'Campaigns, donations' },
  { name: 'CertificateController', path: 'certificate.controller.ts', type: 'controller', feature: 'Certificate', description: 'Issue, verify, portfolio' },
  { name: 'BusinessController', path: 'business.controller.ts', type: 'controller', feature: 'Marketplace', description: 'Products, cart, checkout, orders' },
  { name: 'PaymentController', path: 'payment.controller.ts', type: 'controller', feature: 'Payment', description: 'Payment processing' },
  { name: 'AdminController', path: 'admin.controller.ts', type: 'controller', feature: 'Admin', description: 'Dashboard, users' },
  { name: 'AnalyticsController', path: 'analytics.controller.ts', type: 'controller', feature: 'Analytics', description: 'Stats, trends' },
  { name: 'GamificationController', path: 'gamification.controller.ts', type: 'controller', feature: 'Gamification', description: 'Leaderboard, badges, progress' },
  { name: 'WiFiController', path: 'wifi.controller.ts', type: 'controller', feature: 'Wifi', description: 'Locations, nearby' },
  { name: 'STEMController', path: 'stem.controller.ts', type: 'controller', feature: 'STEM', description: 'Labs, booking' },
  { name: 'VolunteerController', path: 'volunteer.controller.ts', type: 'controller', feature: 'Volunteer', description: 'Activities' },
  { name: 'SurveyController', path: 'survey.controller.ts', type: 'controller', feature: 'Survey', description: 'Surveys, submissions' },
  { name: 'NotificationController', path: 'notifications.controller.ts', type: 'controller', feature: 'Notifications', description: 'Push notifications' },
  { name: 'ShareController', path: 'share.controller.ts', type: 'controller', feature: 'Share', description: 'Shared items' },
  { name: 'StorageController', path: 'storage.controller.ts', type: 'controller', feature: 'Storage', description: 'File upload, management' },
  { name: 'SummerController', path: 'summer.controller.ts', type: 'controller', feature: 'Summer', description: 'Campaigns, reports' },
  { name: 'IntlController', path: 'intl.controller.ts', type: 'controller', feature: 'Intl', description: 'Alumni, programs' },
  { name: 'RoleController', path: 'role.controller.ts', type: 'controller', feature: 'Admin', description: 'RBAC roles' },
  { name: 'DashboardController', path: 'dashboard.controller.ts', type: 'controller', feature: 'Dashboard', description: 'Overview insights' },
  { name: 'MobileConfigController', path: 'mobile-config.controller.ts', type: 'controller', feature: 'Mobile', description: 'Units, schedule' },
  { name: 'CrawlerController', path: 'crawler.controller.ts', type: 'controller', feature: 'Crawler', description: 'Data crawling trigger' },
  { name: 'HealthController', path: 'health.controller.ts', type: 'controller', feature: 'Core', description: 'Health check endpoint' },
  { name: 'FeatureController', path: 'feature.controller.ts', type: 'controller', feature: 'Core', description: 'Feature flags' },
  { name: 'ModuleController', path: 'module.controller.ts', type: 'controller', feature: 'Core', description: 'Module info' },
  { name: 'BlockchainController', path: 'blockchain.controller.ts', type: 'controller', feature: 'Certificate', description: 'Certificate blockchain verify' },
  { name: 'HSConnectionController', path: 'hs-connection.controller.ts', type: 'controller', feature: 'HS-Connection', description: 'High school connection' },

  // ─── UI COMPONENTS ───
  { name: 'Logo', path: 'components/ui/Logo.tsx', type: 'component', feature: 'Core', description: 'EduMapLogo + EduMapWordmark SVG' },
  { name: 'TopBar', path: 'components/TopBar.tsx', type: 'component', feature: 'Core', description: 'Header navigation' },
  { name: 'Footer', path: 'components/Footer.tsx', type: 'component', feature: 'Core', description: 'Footer' },
  { name: 'MobileNav', path: 'components/MobileNav.tsx', type: 'component', feature: 'Core', description: 'Mobile drawer nav' },
  { name: 'MapComponent', path: 'components/ui/MapComponent.tsx', type: 'component', feature: 'Map', description: 'Leaflet map + RoutingPanel' },
  { name: 'RoutingPanel', path: 'components/map/RoutingPanel.tsx', type: 'component', feature: 'Map', description: 'Route panel, flood/traffic analysis' },
  { name: 'RoutePolyline', path: 'components/map/RoutePolyline.tsx', type: 'component', feature: 'Map', description: 'Route geometry rendering' },
  { name: 'HeatmapLayer', path: 'components/map/HeatmapLayer.tsx', type: 'component', feature: 'Map', description: 'Heatmap rendering' },
  { name: 'Button', path: 'components/ui/button.tsx', type: 'component', feature: 'UI', description: 'Themed button (shadcn)' },
  { name: 'Card', path: 'components/ui/card.tsx', type: 'component', feature: 'UI', description: 'Themed card' },
  { name: 'Input', path: 'components/ui/input.tsx', type: 'component', feature: 'UI', description: 'Themed input' },
  { name: 'Avatar', path: 'components/ui/avatar.tsx', type: 'component', feature: 'UI', description: 'User avatar' },
  { name: 'SearchInput', path: 'components/ui/SearchInput.tsx', type: 'component', feature: 'UI', description: 'Search input with icon' },
  { name: 'FilterDropdown', path: 'components/ui/FilterDropdown.tsx', type: 'component', feature: 'UI', description: 'Filter dropdown' },
  { name: 'Pagination', path: 'components/ui/Pagination.tsx', type: 'component', feature: 'UI', description: 'Pagination' },
  { name: 'LoadingSpinner', path: 'components/ui/LoadingSpinner.tsx', type: 'component', feature: 'UI', description: 'Spinner' },
  { name: 'Skeleton', path: 'components/ui/skeleton.tsx', type: 'component', feature: 'UI', description: 'Skeleton loader' },
  { name: 'EmptyState', path: 'components/ui/EmptyState.tsx', type: 'component', feature: 'UI', description: 'Empty state' },
  { name: 'ErrorBoundary', path: 'components/ui/ErrorBoundary.tsx', type: 'component', feature: 'UI', description: 'Error boundary' },
  { name: 'ConfirmDialog', path: 'components/ui/ConfirmDialog.tsx', type: 'component', feature: 'UI', description: 'Confirmation dialog' },
  { name: 'Toast', path: 'components/ui/Toast.tsx', type: 'component', feature: 'UI', description: 'Toast notification' },
  { name: 'SkipLink', path: 'components/ui/SkipLink.tsx', type: 'component', feature: 'UI', description: 'Skip to content link' },
  { name: 'StatsBoard', path: 'components/home/StatsBoard.tsx', type: 'component', feature: 'Home', description: 'Stats board widget' },

  // ─── SERVICES ───
  { name: 'authService', path: 'src/services/auth.service.ts', type: 'service', feature: 'Auth', description: 'Login, register, profile, Google OAuth' },
  { name: 'scholarshipService', path: 'src/services/scholarship.service.ts', type: 'service', feature: 'Scholarship', description: 'Scholarship CRUD' },
  { name: 'careerService', path: 'src/services/career.service.ts', type: 'service', feature: 'Career', description: 'Jobs, paths' },
  { name: 'mentorService', path: 'src/services/mentor.service.ts', type: 'service', feature: 'Mentor', description: 'Mentors, bookings' },
  { name: 'libraryService', path: 'src/services/library.service.ts', type: 'service', feature: 'Library', description: 'Resources, search' },
  { name: 'communityService', path: 'src/services/community.service.ts', type: 'service', feature: 'Community', description: 'Posts, comments' },
  { name: 'eventsService', path: 'src/services/events.service.ts', type: 'service', feature: 'Event', description: 'Events' },
  { name: 'internshipService', path: 'src/services/internship.service.ts', type: 'service', feature: 'Internship', description: 'Internships' },
  { name: 'hackathonService', path: 'src/services/hackathon.service.ts', type: 'service', feature: 'Hackathon', description: 'Hackathons' },
  { name: 'donateService', path: 'src/services/donate.service.ts', type: 'service', feature: 'Donate', description: 'Donations' },
  { name: 'certificateService', path: 'src/services/certificate.service.ts', type: 'service', feature: 'Certificate', description: 'Certificates' },
  { name: 'businessService', path: 'src/services/business.service.ts', type: 'service', feature: 'Marketplace', description: 'Products, orders' },
  { name: 'paymentService', path: 'src/services/payment.service.ts', type: 'service', feature: 'Payment', description: 'Payments' },
  { name: 'adminService', path: 'src/services/admin.service.ts', type: 'service', feature: 'Admin', description: 'Admin dashboard' },
  { name: 'analyticsService', path: 'src/services/analytics.service.ts', type: 'service', feature: 'Analytics', description: 'Analytics data' },
  { name: 'gamificationService', path: 'src/services/gamification.service.ts', type: 'service', feature: 'Gamification', description: 'Badges, progress' },
  { name: 'wifiService', path: 'src/services/wifi.service.ts', type: 'service', feature: 'Wifi', description: 'WiFi locations' },
  { name: 'stemService', path: 'src/services/stem.service.ts', type: 'service', feature: 'STEM', description: 'Lab booking' },
  { name: 'volunteerService', path: 'src/services/volunteer.service.ts', type: 'service', feature: 'Volunteer', description: 'Volunteer activities' },
  { name: 'surveyService', path: 'src/services/survey.service.ts', type: 'service', feature: 'Survey', description: 'Surveys' },
  { name: 'notificationService', path: 'src/services/notification.service.ts', type: 'service', feature: 'Notifications', description: 'Notifications' },
  { name: 'shareService', path: 'src/services/share.service.ts', type: 'service', feature: 'Share', description: 'Sharing' },
  { name: 'storageService', path: 'src/services/storage.service.ts', type: 'service', feature: 'Storage', description: 'File storage' },
  { name: 'summerService', path: 'src/services/summer.service.ts', type: 'service', feature: 'Summer', description: 'Summer campaigns' },
  { name: 'intlService', path: 'src/services/intl.service.ts', type: 'service', feature: 'Intl', description: 'Intl programs' },
  { name: 'roleService', path: 'src/services/role.service.ts', type: 'service', feature: 'Admin', description: 'RBAC' },
  { name: 'dashboardService', path: 'src/services/dashboard.service.ts', type: 'service', feature: 'Dashboard', description: 'Dashboard data' },
  { name: 'mobileUnitService', path: 'src/services/mobile-unit.service.ts', type: 'service', feature: 'Mobile', description: 'Mobile units' },
  { name: 'aiService', path: 'src/services/ai.service.ts', type: 'service', feature: 'AI', description: 'AI chat, learning path' },
  { name: 'searchService', path: 'src/services/search.service.ts', type: 'service', feature: 'Core', description: 'Global search' },
  { name: 'socketService', path: 'src/services/socket.service.ts', type: 'service', feature: 'Core', description: 'Socket.io' },
  { name: 'moderatorService', path: 'src/services/moderator.service.ts', type: 'service', feature: 'Community', description: 'Moderation' },
];

const FEATURES = [
  'Core', 'Auth', 'Map', 'AI', 'Scholarship', 'Career', 'Mentor', 'Library',
  'Wifi', 'STEM', 'Community', 'Event', 'Volunteer', 'Internship', 'Hackathon',
  'Marketplace', 'Donate', 'Certificate', 'Gamification', 'Analytics', 'Admin',
  'Dashboard', 'Payment', 'Share', 'Storage', 'Summer', 'Intl', 'Notifications',
  'Mobile', 'HS-Connection', 'UI',
];

const TYPE_ICONS = {
  page: Globe,
  api: Server,
  controller: Code,
  component: Layers,
  service: Package,
};

const TYPE_COLORS = {
  page: 'text-sky-400',
  api: 'text-emerald-400',
  controller: 'text-amber-400',
  component: 'text-cyan-400',
  service: 'text-rose-400',
};

export default function EndpointMapPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterFeature, setFilterFeature] = useState<string>('all');

  const filtered = useMemo(() => {
    return ALL_ENDPOINTS.filter(ep => {
      const matchesSearch = ep.name.toLowerCase().includes(search.toLowerCase()) ||
        ep.path.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'all' || ep.type === filterType;
      const matchesFeature = filterFeature === 'all' || ep.feature === filterFeature;
      return matchesSearch && matchesType && matchesFeature;
    });
  }, [search, filterType, filterFeature]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ep of ALL_ENDPOINTS) {
      counts[ep.type] = (counts[ep.type] || 0) + 1;
      counts[`${ep.type}-${ep.feature}`] = (counts[`${ep.type}-${ep.feature}`] || 0) + 1;
    }
    return counts;
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <EduMapLogo className="h-7 w-7 text-primary" />
            <span className="font-bold text-xl">EduMap</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-sm text-muted-foreground">Endpoint Map</span>
          </div>
          <div className="text-xs text-muted-foreground/60">
            {ALL_ENDPOINTS.length} tổng cộng • {stats.page} trang • {stats.api} API • {stats.controller} controller • {stats.component} component • {stats.service} service
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Tìm endpoint, component, service..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-muted/30 text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Tất cả loại</option>
              <option value="page">Trang</option>
              <option value="api">API</option>
              <option value="controller">Controller</option>
              <option value="component">Component</option>
              <option value="service">Service</option>
            </select>
            <select
              value={filterFeature}
              onChange={e => setFilterFeature(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Tất cả feature</option>
              {FEATURES.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {Object.entries({
            page: { label: 'Trang', count: stats.page, Icon: Globe, color: 'text-sky-400' },
            api: { label: 'API', count: stats.api, Icon: Server, color: 'text-emerald-400' },
            controller: { label: 'Controller', count: stats.controller, Icon: Code, color: 'text-amber-400' },
            component: { label: 'Component', count: stats.component, Icon: Layers, color: 'text-cyan-400' },
            service: { label: 'Service', count: stats.service, Icon: Package, color: 'text-rose-400' },
          }).map(([type, info]) => {
            const Icon = info.Icon;
            return (
              <div key={type} className="bg-muted/20 rounded-xl p-3 flex items-center gap-3">
                <Icon className={`w-5 h-5 ${info.color}`} />
                <div>
                  <div className="text-sm text-muted-foreground/60">{info.label}</div>
                  <div className="text-2xl font-bold text-foreground">{info.count}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Groups */}
        <div className="space-y-6">
          {Array.from(new Set(filtered.map(ep => ep.feature))).sort().map(feature => {
            const items = filtered.filter(ep => ep.feature === feature);
            if (!items.length) return null;

            return (
              <div key={feature} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2 bg-muted/30 border-b border-border text-sm font-medium text-primary flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  {feature}
                </div>
                <div className="divide-y divide-border">
                  {items.map((ep, i) => {
                    const Icon = TYPE_ICONS[ep.type as keyof typeof TYPE_ICONS];
                    const colorClass = TYPE_COLORS[ep.type as keyof typeof TYPE_COLORS];
                    const typeLabel = ep.type === 'page' ? 'Trang' : ep.type === 'api' ? 'API' : ep.type === 'controller' ? 'Ctrl' : ep.type === 'component' ? 'Comp' : 'Svc';
                    return (
                      <div key={`${ep.type}-${ep.path}-${i}`} className="px-4 py-2.5 flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-lg bg-muted/30 flex items-center justify-center ${colorClass}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded bg-muted/40 ${colorClass}`}>{typeLabel}</span>
                              <span className="font-medium text-foreground">{ep.name}</span>
                            </div>
                            {ep.method && (
                              <span className="text-xs text-muted-foreground/50 font-mono">{ep.method}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {ep.description && (
                            <span className="text-xs text-muted-foreground/50 hidden sm:block">{ep.description}</span>
                          )}
                          <code className={`text-xs px-2 py-0.5 rounded bg-muted/40 text-muted-foreground/60 font-mono`}>
                            {ep.path}
                          </code>
                          {ep.type === 'page' && (
                            <a
                              href={ep.path}
                              className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-primary/20 transition-colors opacity-0 group-hover:opacity-100"
                              title={`Mở ${ep.path}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
