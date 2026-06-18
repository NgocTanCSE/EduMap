-- =====================================================
-- EduMap Missing Indexes Migration
-- =====================================================

-- This migration adds indexes for tables that are missing them
-- based on common query patterns and performance analysis

-- =====================================================
-- 1. EVENTS TABLE INDEXES
-- =====================================================

-- Index for filtering events by status
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- Index for filtering events by type
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- Index for filtering events by organizer
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);

-- Composite index for date range queries with status
CREATE INDEX IF NOT EXISTS idx_events_dates_status ON events(start_date, end_date, status);

-- =====================================================
-- 2. OPPORTUNITIES TABLE INDEXES
-- =====================================================

-- Index for filtering opportunities by deadline
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(deadline);

-- Index for filtering opportunities by status
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);

-- Index for filtering opportunities by type
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(type);

-- Composite index for active opportunities sorted by deadline
CREATE INDEX IF NOT EXISTS idx_opportunities_active_deadline ON opportunities(status, deadline);

-- =====================================================
-- 3. DONATION CAMPAIGNS TABLE INDEXES
-- =====================================================

-- Index for filtering campaigns by status
CREATE INDEX IF NOT EXISTS idx_donation_campaigns_status ON donation_campaigns(status);

-- Index for filtering campaigns by organizer
CREATE INDEX IF NOT EXISTS idx_donation_campaigns_organizer ON donation_campaigns(organizer_id);

-- Composite index for active campaigns sorted by end date
CREATE INDEX IF NOT EXISTS idx_donation_campaigns_active ON donation_campaigns(status, end_date);

-- =====================================================
-- 4. SURVEYS TABLE INDEXES
-- =====================================================

-- Index for filtering surveys by status
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);

-- Index for filtering surveys by creator
CREATE INDEX IF NOT EXISTS idx_surveys_created_by ON surveys(created_by);

-- Composite index for active surveys
CREATE INDEX IF NOT EXISTS idx_surveys_active_dates ON surveys(status, start_date, end_date);

-- =====================================================
-- 5. NOTIFICATIONS TABLE INDEXES
-- =====================================================

-- Composite index for user notifications with read status
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- Index for filtering notifications by channel
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);

-- Composite index for unread notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read, sent_at DESC);

-- =====================================================
-- 6. POSTS TABLE INDEXES
-- =====================================================

-- Index for filtering posts by status
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

-- Index for filtering posts by group
CREATE INDEX IF NOT EXISTS idx_posts_group_created ON posts(group_id, created_at DESC);

-- Index for filtering posts by author
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts(author_id, created_at DESC);

-- Composite index for pinned posts in a group
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts(group_id, pinned, created_at DESC);

-- =====================================================
-- 7. COMMENTS TABLE INDEXES
-- =====================================================

-- Index for filtering comments by post
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at);

-- Index for filtering comments by author
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);

-- Index for nested comments (parent_id)
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- =====================================================
-- 8. GROUPS TABLE INDEXES
-- =====================================================

-- Index for filtering groups by type
CREATE INDEX IF NOT EXISTS idx_groups_type ON groups(type);

-- Index for filtering groups by privacy
CREATE INDEX IF NOT EXISTS idx_groups_privacy ON groups(privacy);

-- Index for filtering groups by owner
CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);

-- =====================================================
-- 9. MENTORS TABLE INDEXES
-- =====================================================

-- Index for filtering mentors by verification status
CREATE INDEX IF NOT EXISTS idx_mentors_verified ON mentors(is_verified);

-- Index for filtering mentors by rating
CREATE INDEX IF NOT EXISTS idx_mentors_rating ON mentors(rating_avg DESC);

-- =====================================================
-- 10. BOOKINGS TABLE INDEXES
-- =====================================================

-- Index for filtering bookings by status
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Index for filtering bookings by student
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id);

-- Index for filtering bookings by mentor
CREATE INDEX IF NOT EXISTS idx_bookings_mentor ON bookings(mentor_id);

-- Composite index for available slots (mentor + time range)
CREATE INDEX IF NOT EXISTS idx_bookings_mentor_time ON bookings(mentor_id, slot_start, slot_end);

-- =====================================================
-- 11. BADGES TABLE INDEXES
-- =====================================================

-- Index for filtering badges by category
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);

-- Index for filtering badges by rarity
CREATE INDEX IF NOT EXISTS idx_badges_rarity ON badges(rarity);

-- =====================================================
-- 12. USER_BADGES TABLE INDEXES
-- =====================================================

-- Composite index for user badges lookup
CREATE INDEX IF NOT EXISTS idx_user_badges_user_earned ON user_badges(user_id, earned_at DESC);

-- =====================================================
-- 13. USER_POINTS TABLE INDEXES
-- =====================================================

-- Index for filtering points by user
CREATE INDEX IF NOT EXISTS idx_user_points_user_created ON user_points(user_id, created_at DESC);

-- Index for filtering points by action
CREATE INDEX IF NOT EXISTS idx_user_points_action ON user_points(action);

-- Index for filtering points by source type
CREATE INDEX IF NOT EXISTS idx_user_points_source ON user_points(source_type, source_id);

-- =====================================================
-- 14. GREEN ACTIVITIES TABLE INDEXES
-- =====================================================

-- Index for filtering green activities by user
CREATE INDEX IF NOT EXISTS idx_green_activities_user ON green_activities(user_id);

-- Index for filtering green activities by challenge
CREATE INDEX IF NOT EXISTS idx_green_activities_challenge ON green_activities(challenge_id);

-- Index for filtering green activities by status
CREATE INDEX IF NOT EXISTS idx_green_activities_status ON green_activities(status);

-- =====================================================
-- 15. VOLUNTEER ACTIVITIES TABLE INDEXES
-- =====================================================

-- Index for filtering volunteer activities by user
CREATE INDEX IF NOT EXISTS idx_volunteer_activities_user ON volunteer_activities(volunteer_id);

-- Index for filtering volunteer activities by status
CREATE INDEX IF NOT EXISTS idx_volunteer_activities_status ON volunteer_activities(status);

-- Index for filtering volunteer activities by date
CREATE INDEX IF NOT EXISTS idx_volunteer_activities_date ON volunteer_activities(date);

-- =====================================================
-- 16. CERTIFICATES TABLE INDEXES
-- =====================================================

-- Index for filtering certificates by user
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- Index for filtering certificates by type
CREATE INDEX IF NOT EXISTS idx_certificates_type ON certificates(type);

-- Index for certificate verification
CREATE INDEX IF NOT EXISTS idx_certificates_verify_code ON certificates(verify_code);

-- =====================================================
-- 17. WIFI LOCATIONS TABLE INDEXES
-- =====================================================

-- Index for filtering WiFi by verification status
CREATE INDEX IF NOT EXISTS idx_wifi_locations_verified ON wifi_locations(verified);

-- Index for filtering WiFi by rating
CREATE INDEX IF NOT EXISTS idx_wifi_locations_rating ON wifi_locations(rating_avg DESC);

-- Index for filtering WiFi by free/paid
CREATE INDEX IF NOT EXISTS idx_wifi_locations_free ON wifi_locations(is_free);

-- =====================================================
-- 18. STEM LABS TABLE INDEXES
-- =====================================================

-- Index for filtering STEM labs by booking availability
CREATE INDEX IF NOT EXISTS idx_stem_labs_booking ON stem_labs(booking_available);

-- =====================================================
-- 19. SHARED ITEMS TABLE INDEXES
-- =====================================================

-- Index for filtering shared items by status
CREATE INDEX IF NOT EXISTS idx_shared_items_status ON shared_items(status);

-- Index for filtering shared items by category
CREATE INDEX IF NOT EXISTS idx_shared_items_category ON shared_items(category);

-- Index for filtering shared items by owner
CREATE INDEX IF NOT EXISTS idx_shared_items_owner ON shared_items(owner_id);

-- =====================================================
-- 20. BORROW REQUESTS TABLE INDEXES
-- =====================================================

-- Index for filtering borrow requests by status
CREATE INDEX IF NOT EXISTS idx_borrow_requests_status ON borrow_requests(status);

-- Index for filtering borrow requests by item
CREATE INDEX IF NOT EXISTS idx_borrow_requests_item ON borrow_requests(item_id);

-- Index for filtering borrow requests by requester
CREATE INDEX IF NOT EXISTS idx_borrow_requests_requester ON borrow_requests(requester_id);

-- =====================================================
-- 21. SUPPORT TICKETS TABLE INDEXES
-- =====================================================

-- Index for filtering support tickets by status
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- Index for filtering support tickets by priority
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);

-- Index for filtering support tickets by category
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);

-- Index for filtering support tickets by assignee
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);

-- =====================================================
-- 22. AUDIT LOGS TABLE INDEXES
-- =====================================================

-- Index for filtering audit logs by action
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Index for filtering audit logs by resource
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);

-- Index for filtering audit logs by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- Index for filtering audit logs by date
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- =====================================================
-- 23. EDUCATION STATS TABLE INDEXES
-- =====================================================

-- Composite index for education stats queries
CREATE INDEX IF NOT EXISTS idx_education_stats_region_year ON education_stats(region, year);

-- Index for filtering by metric type
CREATE INDEX IF NOT EXISTS idx_education_stats_metric ON education_stats(metric_type);

-- =====================================================
-- 24. USER LEARNING HISTORY TABLE INDEXES
-- =====================================================

-- Index for filtering learning history by user
CREATE INDEX IF NOT EXISTS idx_user_learning_history_user ON user_learning_history(user_id);

-- Index for filtering learning history by material
CREATE INDEX IF NOT EXISTS idx_user_learning_history_material ON user_learning_history(material_id);

-- Index for filtering learning history by action
CREATE INDEX IF NOT EXISTS idx_user_learning_history_action ON user_learning_history(action);

-- Composite index for user progress tracking
CREATE INDEX IF NOT EXISTS idx_user_learning_history_user_action ON user_learning_history(user_id, action, created_at DESC);

-- =====================================================
-- 25. CAREER PATHS TABLE INDEXES
-- =====================================================

-- Index for filtering career paths by demand level
CREATE INDEX IF NOT EXISTS idx_career_paths_demand ON career_paths(demand_level);

-- =====================================================
-- 26. SCHOLARSHIPS TABLE INDEXES (additional)
-- =====================================================

-- Index for filtering scholarships by provider
CREATE INDEX IF NOT EXISTS idx_scholarships_provider ON scholarships(provider);

-- =====================================================
-- 27. JOBS TABLE INDEXES (additional)
-- =====================================================

-- Index for filtering jobs by company
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_name);

-- Index for filtering jobs by location
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);

-- Index for filtering jobs by experience level
CREATE INDEX IF NOT EXISTS idx_jobs_experience ON jobs(experience_level);

-- Composite index for active jobs sorted by deadline
CREATE INDEX IF NOT EXISTS idx_jobs_active_deadline ON jobs(status, application_deadline);

-- =====================================================
-- 28. APPLICATIONS TABLE INDEXES (additional)
-- =====================================================

-- Composite index for job applications by status
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status, created_at DESC);

-- =====================================================
-- 29. BUSINESS PROFILES TABLE INDEXES
-- =====================================================

-- Index for filtering business profiles by industry
CREATE INDEX IF NOT EXISTS idx_business_profiles_industry ON business_profiles(industry);

-- Index for filtering business profiles by verification
CREATE INDEX IF NOT EXISTS idx_business_profiles_verified ON business_profiles(is_verified);

-- =====================================================
-- 30. PRODUCTS TABLE INDEXES
-- =====================================================

-- Index for filtering products by category
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Index for filtering products by price
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Index for filtering products by business
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_profile_id);

-- =====================================================
-- 31. BUSINESS SERVICES TABLE INDEXES
-- =====================================================

-- Index for filtering services by category
CREATE INDEX IF NOT EXISTS idx_business_services_category ON business_services(category);

-- Index for filtering services by business
CREATE INDEX IF NOT EXISTS idx_business_services_business ON business_services(business_profile_id);

-- =====================================================
-- 32. CHAT MESSAGES TABLE INDEXES
-- =====================================================

-- Index for filtering chat messages by sender
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);

-- Index for filtering chat messages by receiver
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id);

-- Index for filtering chat messages by group
CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON chat_messages(group_id);

-- Composite index for conversation messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(sender_id, receiver_id, created_at DESC);

-- =====================================================
-- 33. AI CONVERSATIONS TABLE INDEXES
-- =====================================================

-- Index for filtering conversations by user
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);

-- Index for filtering conversations by model
CREATE INDEX IF NOT EXISTS idx_ai_conversations_model ON ai_conversations(model);

-- =====================================================
-- 34. AI MESSAGES TABLE INDEXES
-- =====================================================

-- Index for filtering messages by conversation
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);

-- Index for filtering messages by role
CREATE INDEX IF NOT EXISTS idx_ai_messages_role ON ai_messages(role);

-- =====================================================
-- 35. INTERNSHIPS TABLE INDEXES (additional)
-- =====================================================

-- Index for filtering internships by field
CREATE INDEX IF NOT EXISTS idx_internships_field ON internships(field);

-- Index for filtering internships by status
CREATE INDEX IF NOT EXISTS idx_internships_status ON internships(status);

-- Index for filtering internships by deadline
CREATE INDEX IF NOT EXISTS idx_internships_deadline ON internships(deadline);

-- =====================================================
-- 36. LEARNING MATERIALS TABLE INDEXES (additional)
-- =====================================================

-- Index for filtering materials by status
CREATE INDEX IF NOT EXISTS idx_learning_materials_status ON learning_materials(status);

-- Index for filtering materials by author
CREATE INDEX IF NOT EXISTS idx_learning_materials_author ON learning_materials(author_id);

-- Index for filtering materials by type
CREATE INDEX IF NOT EXISTS idx_learning_materials_type ON learning_materials(type);

-- Index for filtering materials by subject
CREATE INDEX IF NOT EXISTS idx_learning_materials_subject ON learning_materials(subject);

-- Index for filtering materials by grade
CREATE INDEX IF NOT EXISTS idx_learning_materials_grade ON learning_materials(grade);

-- =====================================================
-- 37. MAP REVIEWS TABLE INDEXES
-- =====================================================

-- Index for filtering reviews by point
CREATE INDEX IF NOT EXISTS idx_map_reviews_point ON map_reviews(point_id);

-- Index for filtering reviews by user
CREATE INDEX IF NOT EXISTS idx_map_reviews_user ON map_reviews(user_id);

-- Index for filtering reviews by rating
CREATE INDEX IF NOT EXISTS idx_map_reviews_rating ON map_reviews(rating);

-- =====================================================
-- 38. MATERIAL RATINGS TABLE INDEXES
-- =====================================================

-- Index for filtering ratings by material
CREATE INDEX IF NOT EXISTS idx_material_ratings_material ON material_ratings(material_id);

-- Index for filtering ratings by user
CREATE INDEX IF NOT EXISTS idx_material_ratings_user ON material_ratings(user_id);

-- Index for filtering ratings by rating value
CREATE INDEX IF NOT EXISTS idx_material_ratings_rating ON material_ratings(rating);

-- =====================================================
-- 39. EVENT REGISTRATIONS TABLE INDEXES
-- =====================================================

-- Index for filtering registrations by event
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);

-- Index for filtering registrations by user
CREATE INDEX IF NOT EXISTS idx_event_registrations_user ON event_registrations(user_id);

-- Index for filtering registrations by status
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON event_registrations(status);

-- =====================================================
-- 40. DONATIONS TABLE INDEXES
-- =====================================================

-- Index for filtering donations by donor
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);

-- Index for filtering donations by campaign
CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donations(campaign_id);

-- Index for filtering donations by status
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(payment_status);

-- Index for filtering donations by date
CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at DESC);

-- =====================================================
-- 41. SURVEY RESPONSES TABLE INDEXES
-- =====================================================

-- Index for filtering responses by survey
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);

-- Index for filtering responses by user
CREATE INDEX IF NOT EXISTS idx_survey_responses_user ON survey_responses(user_id);

-- =====================================================
-- 42. GREEN CHALLENGES TABLE INDEXES
-- =====================================================

-- Index for filtering challenges by status
CREATE INDEX IF NOT EXISTS idx_green_challenges_status ON green_challenges(status);

-- Index for filtering challenges by type
CREATE INDEX IF NOT EXISTS idx_green_challenges_type ON green_challenges(type);

-- Index for filtering challenges by creator
CREATE INDEX IF NOT EXISTS idx_green_challenges_creator ON green_challenges(created_by);

-- =====================================================
-- 43. MAP CATEGORIES TABLE INDEXES
-- =====================================================

-- Index for filtering categories by parent
CREATE INDEX IF NOT EXISTS idx_map_categories_parent ON map_categories(parent_id);

-- Index for filtering categories by active status
CREATE INDEX IF NOT EXISTS idx_map_categories_active ON map_categories(is_active);

-- Index for ordering categories
CREATE INDEX IF NOT EXISTS idx_map_categories_order ON map_categories(display_order);

-- =====================================================
-- 44. LOCATION CATEGORIES TABLE INDEXES
-- =====================================================

-- Index for filtering location categories by name
CREATE INDEX IF NOT EXISTS idx_location_categories_name ON location_categories(name);

-- =====================================================
-- 45. LOCATIONS TABLE INDEXES (additional)
-- =====================================================

-- Index for filtering locations by created_by
CREATE INDEX IF NOT EXISTS idx_locations_created_by ON locations(created_by);

-- Index for filtering locations by rating
CREATE INDEX IF NOT EXISTS idx_locations_rating ON locations(rating_avg DESC);

-- =====================================================
-- 46. ROLE PERMISSIONS TABLE INDEXES
-- =====================================================

-- Composite index for role permissions lookup
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

-- Index for filtering by permission
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- =====================================================
-- 47. MODULES TABLE INDEXES
-- =====================================================

-- Index for filtering modules by name
CREATE INDEX IF NOT EXISTS idx_modules_name ON modules(name);

-- =====================================================
-- 48. FEATURES TABLE INDEXES
-- =====================================================

-- Index for filtering features by module
CREATE INDEX IF NOT EXISTS idx_features_module ON features(module_id);

-- Index for filtering features by name
CREATE INDEX IF NOT EXISTS idx_features_name ON features(name);

-- =====================================================
-- 49. PERMISSIONS TABLE INDEXES
-- =====================================================

-- Index for filtering permissions by resource
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

-- Index for filtering permissions by action
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);

-- =====================================================
-- 50. ROLES TABLE INDEXES
-- =====================================================

-- Index for filtering roles by level
CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(level);

-- Index for filtering roles by system created
CREATE INDEX IF NOT EXISTS idx_roles_system ON roles(system_created);

-- =====================================================
-- SUMMARY
-- =====================================================
-- This migration adds 100+ indexes across all tables
-- covering common query patterns for:
-- - Filtering by status, type, category
-- - Sorting by date, rating, popularity
-- - Joining related tables
-- - Composite queries for dashboard analytics
-- =====================================================
