//! Router: mounts `/api/*` endpoints and applies `AuthLayer` (routes that are
//! `@Public()` such as `GET /api/health` are skipped by the middleware).
//!
//! Routing table (public entry point):
//!
//! ```text
//! GET  /api/health, /api/health/db, /api/ping, /api/config, /api/ai/search,
//!      /api/ai/analytics/stats     -> public (no JWT)
//! POST /api/auth/{register,login,google,dev-login,refresh,...}  -> public login
//! POST /api/auth/{me,profile,preferences,...}                   -> JWT bearer
//! POST/GET /api/ai/{*rest} -> ai-service (proxy, all other AI paths)
//! ```
//!
//! The AI routes (`/api/ai/*`) are the routing topology change for Phase 1:
//! `/api/ai/*` no longer goes to the FastAPI ai-service; the Rust backend
//! owns it and forwards verbatim into the ai-service.
use axum::Router;
use axum::routing::get;
use axum::routing::post;
use axum::routing::put;
use axum::routing::patch;
use axum::routing::delete;
use axum::response::IntoResponse;

use crate::common::auth::AuthLayer;
use crate::common::response::ApiResponse;
use crate::db::pool::DbPool;
use crate::modules::admin;
use crate::modules::blockchain;
use crate::modules::bookmarks;
use crate::modules::business;
use crate::modules::ai;
use crate::modules::analytics;
use crate::modules::audit_log;
use crate::modules::offline_tutor;
use crate::modules::resource_exchange;
use crate::modules::payment;
use crate::modules::storage;
use crate::modules::auth;
use crate::modules::career;
use crate::modules::certificate;
use crate::modules::donate;
use crate::modules::dashboard;
use crate::modules::events;
use crate::modules::community;
use crate::modules::crawler;
use crate::modules::gamification;
use crate::modules::geo;
use crate::modules::green;
use crate::modules::hackathon;
use crate::modules::health;
use crate::modules::hs_connection;
use crate::modules::impact_measurement;
use crate::modules::impact_match;
use crate::modules::internship;
use crate::modules::intl;
use crate::modules::library;
use crate::modules::learning_community;
use crate::modules::map;
use crate::modules::mentor;
use crate::modules::notifications;
use crate::modules::opportunity;
use crate::modules::pin;
use crate::modules::role;
use crate::modules::scholar;
use crate::modules::share;
use crate::modules::summer;
use crate::modules::stem;
use crate::modules::survey;
use crate::modules::volunteer;
use crate::modules::wifi;

/// `/api/ping` — a quick route the frontend BFF touches every page load.
pub async fn ping() -> impl IntoResponse {
    axum::Json(ApiResponse::ok("pong"))
}

/// `/api/config` — tiny metadata the frontend asks for (kept in BFF).
pub async fn config() -> impl IntoResponse {
    axum::Json(ApiResponse::ok("config"))
}

/// Mount all `/api/*` routes on a router shared with the `DbPool` state.
pub fn create_router(pool: DbPool) -> Router {
    let health = Router::new()
        .route("/api/health", get(health::get_health))
        .route("/api/health/db", get(health::get_db_status))
        .route("/api/ping", get(ping))
        .route("/api/config", get(config))
        .with_state(pool);

    // `POST /api/auth/*` — account lifecycle (public login endpoints + JWT
    // guarded profile/preferences endpoints).
    let auth_routes = Router::new()
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/dev-login", post(auth::dev_login))
        .route("/api/auth/google", post(auth::google_auth))
        .route("/api/auth/refresh", post(auth::refresh))
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/profile", patch(auth::update_profile))
        .route("/api/auth/preferences", patch(auth::update_preferences))
        .route("/api/auth/preferences", get(auth::get_preferences))
        .route("/api/auth/change-password", post(auth::change_password))
        .route("/api/auth/2fa/generate", get(auth::generate_2fa))
        .route("/api/auth/2fa/verify", post(auth::verify_2fa))
        .route("/api/auth/forgot-password", post(auth::forgot_password))
        .route("/api/auth/reset-password", post(auth::reset_password))
        .route("/api/auth/logout", post(auth::logout))
        .with_state(pool);

    // `POST /api/ai/*` + `GET /api/ai/*` — AI proxy to the FastAPI ai-service
    // (streaming + genes + generic verbatim proxy).
    let ai_routes = Router::new()
        .route("/api/ai/chat-stream", post(ai::chat_stream))
        .route("/api/ai/chat/stream", post(ai::chat_stream))
        .route("/api/ai/agent/chat-stream", post(ai::agent_chat_stream))
        .route("/api/ai/chat", post(ai::chat))
        .route("/api/ai/agent/chat", post(ai::agent_chat))
        .route("/api/ai/history", get(ai::history))
        .route("/api/ai/search", get(ai::search))
        .route("/api/ai/speech/to-text", post(ai::speech_to_text))
        // Catch-all: every other `/api/ai/{*rest}` (knowledge/*, language/*,
        // learning-path, trends, pdf-transcript, route/explain, auto/*, ...)
        // is forwarded verbatim into the ai-service.
        .route("/api/ai/{*rest}", get(ai::proxy).post(ai::proxy))
        .with_state(pool);

    // `GET /api/map/*` + `POST /api/map/*` — the map hub (POIs, locations,
    // routing, climate, survey, gap-forecast, NL search). All read endpoints
    // are public (`/api/map/*` listed in `PUBLIC_PATHS` — the map page answers
    // for guests); the write handlers (`POST /api/map/pois`,
    // `POST /api/map/ai-analysis`) authenticate themselves and return 401
    // when the token is missing.
    let map_routes = Router::new()
        .route("/api/map/pois", get(map::get_pois).post(map::create_poi))
        .route("/api/map/locations", get(map::get_locations))
        .route("/api/map/categories", get(map::get_categories))
        .route("/api/map/poi/:id", get(map::get_poi_details))
        .route("/api/map/featured-pins", get(map::get_featured_pins))
        .route("/api/map/stats", get(map::get_stats))
        .route("/api/map/gap-forecast", get(map::gap_forecast))
        .route("/api/map/resource-optimization", get(map::resource_optimization))
        .route("/api/map/nl-search", get(map::nl_search))
        .route("/api/map/safe-route", get(map::get_safe_route))
        .route("/api/map/climate-risk", get(map::get_climate_risk))
        .route("/api/map/ai-analysis", post(map::ai_analysis))
        .route("/api/map/climate/alternatives", post(map::post_climate_alternatives))
        .route("/api/map/data-gaps", get(map::get_data_gaps))
        .route("/api/map/survey/priorities", get(map::get_survey_priorities))
        .route("/api/map/survey/next", get(map::get_survey_next))
        // routing (`/api/map/routing/*`)
        .route("/api/map/routing/route", get(map::get_route))
        .route("/api/map/routing/nearest", get(map::get_nearest_road))
        .route("/api/map/routing/table", get(map::get_distance_table))
        .route("/api/map/routing/flood-zones", get(map::get_flood_zones))
        .route("/api/map/routing/traffic-segments", get(map::traffic_segments))
        .with_state(pool);

    // `/api/certificates/*` — cấp chứng nhận số, xác thực, hồ sơ năng lực
    // và tải PDF chứng nhận.
    let certificate_routes = Router::new()
        .route("/api/certificates/issue", post(certificate::issue_certificate))
        .route("/api/certificates/verify/:code", get(certificate::verify_certificate))
        .route("/api/certificates/portfolio", get(certificate::get_portfolio))
        .route("/api/certificates/download/:code.pdf", get(certificate::download_certificate_pdf))
        .with_state(pool);

    // `/api/donations/*` — chiến dịch quyên góp (danh sách, chi tiết, nhà hảo
    // tâm), tạo chiến dịch, URL thanh toán VNPay và ghi nhận khoản quyên góp.
    // Danh sách/chi tiết là public; các write handler tự kiểm JWT.
    let donation_routes = Router::new()
        .route("/api/donations/campaigns", get(donate::get_campaigns).post(donate::create_campaign))
        .route("/api/donations/campaigns/:id", get(donate::get_campaign_by_id))
        .route(
            "/api/donations/campaigns/:id/donors",
            get(donate::get_donors_by_campaign_id),
        )
        .route("/api/donations/payment-url", post(donate::create_payment_url))
        .route("/api/donations", post(donate::process_donation))
        .with_state(pool);

    // `/api/events/*` — workshop/sự kiện (danh sách, chi tiết, tạo, cập nhật
    // và đăng ký tham gia). Danh sách/chi tiết là public; write handler tự
    // kiểm JWT.
    let events_routes = Router::new()
        .route("/api/events", get(events::get_events).post(events::create_event))
        .route("/api/events/:id", get(events::get_event_by_id).put(events::update_event))
        .route("/api/events/:id/register", post(events::register_event))
        .with_state(pool);

    // `/api/gamification/*` — bảng xếp hạng, huy hiệu, tiến độ và cấp điểm.
    // Leaderboard là public; các endpoint khác tự kiểm JWT/grant kiểm role.
    let gamification_routes = Router::new()
        .route("/api/gamification/leaderboard", get(gamification::get_leaderboard))
        .route("/api/gamification/my-progress", get(gamification::get_my_progress))
        .route("/api/gamification/my-badges", get(gamification::get_user_badges))
        .route("/api/gamification/submit-activity", post(gamification::submit_activity))
        .route("/api/gamification/progress/:userId", get(gamification::get_user_progress))
        .route("/api/gamification/grant-points", post(gamification::grant_points))
        .route("/api/gamification/grant-achievement", post(gamification::grant_achievement))
        .with_state(pool);

    // `/api/green/*` — thử thách Sống Xanh, ghi nhận hoạt động và impact xanh.
    // Danh sách là public; write handler tự kiểm JWT.
    let green_routes = Router::new()
        .route("/api/green/impacts", get(green::get_all_impacts).post(green::add_impact))
        .route("/api/green/challenges", get(green::get_challenges))
        .route("/api/green/activities", post(green::log_activity))
        .with_state(pool);

    // `/api/hackathons/*` — danh sách cuộc thi, đăng ký đội, nộp sản phẩm và
    // chấm điểm. Danh sách/chi tiết là public; write handler tự kiểm JWT.
    let hackathon_routes = Router::new()
        .route("/api/hackathons", get(hackathon::get_hackathons))
        .route("/api/hackathons/:id", get(hackathon::get_hackathon_by_id))
        .route("/api/hackathons/register", post(hackathon::register_team))
        .route("/api/hackathons/teams/:teamId/submit", post(hackathon::submit_project))
        .route("/api/hackathons/teams/:teamId/judge", post(hackathon::judge_project))
        .with_state(pool);

    // `/api/career/*` — jobs (list/search/create/update/delete), career paths +
    // skill roadmaps, user careers, user skills, applications, resume upload
    // and the AI career advice endpoints. `/api/career/jobs{,/:id}`,
    // `/api/career/paths{,/:id}` and `/api/career/roadmap/:id` are public (the
    // `AuthLayer` skips them); the rest need a JWT.
    let career_routes = Router::new()
        .route("/api/career/jobs", get(career::get_jobs).post(career::create_job))
        .route("/api/career/jobs/:id", get(career::get_job_by_id).patch(career::update_job).delete(career::delete_job))
        .route("/api/career/paths", get(career::get_paths).post(career::create_path))
        .route("/api/career/paths/:id", get(career::get_path_by_id))
        .route("/api/career/roadmap/:id", get(career::get_skill_roadmap))
        .route("/api/career/user-careers", get(career::get_user_careers).post(career::create_user_career))
        .route("/api/career/user-careers/:id", patch(career::update_user_career).delete(career::delete_user_career))
        .route("/api/career/user-skills", get(career::get_user_skills).post(career::create_user_skill))
        .route("/api/career/user-skills/:id", patch(career::update_user_skill).delete(career::delete_user_skill))
        .route("/api/career/applications", get(career::get_user_applications).post(career::apply_to_job))
        .route("/api/career/applications/:id", get(career::get_application_by_id))
        .route("/api/career/applications/:id/status", patch(career::update_application_status))
        .route("/api/career/applications/:id/withdraw", patch(career::withdraw_application))
        .route("/api/career/upload-resume", post(career::upload_resume))
        .route("/api/career/ai-advice", get(career::get_ai_advice))
        .route("/api/career/suggest", post(career::suggest_career))
        .with_state(pool);

    // `/api/admin/*` — admin dashboard stats, user management (list/detail,
    // status changes, soft-delete/restore), pending content review and the AI
    // reports (data-quality, question-gaps, auto-scheduler health). On the old
    // backend every route was `@Roles(ADMIN, MODERATOR)`; the `AuthLayer`
    // skips those routes joins `PUBLIC_PATHS`.
    let admin_routes = Router::new()
        .route("/api/admin/dashboard", get(admin::get_stats))
        .route("/api/admin/users", get(admin::get_users))
        .route("/api/admin/users/:id", get(admin::get_user_by_id).delete(admin::soft_delete_user))
        .route("/api/admin/users/:id/status", put(admin::update_user_status))
        .route("/api/admin/users/:id/restore", post(admin::restore_user))
        .route("/api/admin/content/pending", get(admin::get_pending_content))
        .route("/api/admin/data-quality/report", post(admin::data_quality_report))
        .route("/api/admin/question-gaps", get(admin::get_question_gaps))
        .route("/api/admin/auto-scheduler/health", get(admin::get_auto_scheduler_health))
        .route("/api/admin/crawl-map", post(admin::crawl_map))
        .with_state(pool);

    // `/api/audit-logs` — nhật ký hoạt động hệ thống (admin/moderator, giống
    // old backend `@Roles(ADMIN, MODERATOR)`).
    let audit_log_routes = Router::new()
        .route("/api/audit-logs", get(audit_log::get_logs))
        .with_state(pool);

    // `/api/community/*` — study-group posts, comments, likes and groups. The
    // read endpoints are public (`PUBLIC_PATHS`); the write endpoints
    // authenticate themselves (`authenticated_user`) and run every piece of
    // text through the ai-service content moderator before storing it.
    let community_routes = Router::new()
        .route("/api/community/posts", get(community::get_posts).post(community::create_post))
        .route("/api/community/posts/:id", get(community::get_post_by_id))
        .route("/api/community/posts/:id/like", post(community::like_post))
        .route("/api/community/posts/:id/comments", get(community::get_comments).post(community::add_comment))
        .route("/api/community/groups", get(community::get_groups).post(community::create_group))
        .route("/api/community/groups/:id/join", post(community::join_group))
        .with_state(pool);

    // `/api/business/*` — hồ sơ doanh nghiệp, sản phẩm, dịch vụ, đánh giá,
    // giỏ hàng, thanh toán và đơn hàng. Danh sách/chi tiết public
    // (marketplace cho khách chưa đăng nhập); các handler write tự kiểm JWT
    // và trả 401 khi thiếu token.
    let business_routes = Router::new()
        .route("/api/business", get(business::get_profiles))
        .route("/api/business/profile", post(business::create_or_update_profile))
        .route("/api/business/:id/profile", get(business::get_profile))
        .route("/api/business/:id/verify", post(business::verify_profile))
        .route("/api/business/:bpId/products", post(business::create_product).get(business::get_products))
        .route("/api/business/products/:id", get(business::get_product))
        .route("/api/business/:bpId/products/:id", put(business::update_product).delete(business::delete_product))
        .route("/api/business/:bpId/services", post(business::create_service).get(business::get_services))
        .route("/api/business/services/:id", get(business::get_service))
        .route("/api/business/:bpId/services/:id", put(business::update_service).delete(business::delete_service))
        .route("/api/business/products/:id/reviews", post(business::create_product_review).get(business::get_product_reviews))
        .route("/api/business/services/:id/reviews", post(business::create_service_review).get(business::get_service_reviews))
        .route("/api/business/cart", get(business::get_cart).delete(business::clear_cart))
        .route("/api/business/cart/add", post(business::add_to_cart))
        .route("/api/business/cart/:id", delete(business::remove_from_cart))
        .route("/api/business/checkout", post(business::checkout))
        .route("/api/business/orders/me", get(business::get_my_orders))
        .route("/api/business/orders/vendor", get(business::get_vendor_orders))
        .with_state(pool);

    // `/api/hs-connection/*` — tư vấn tuyển sinh, Campus Tour ảo, câu hỏi
    /// tư vấn và kết nối cựu HS–sinh viên. Danh sách (counseling, questions)
    /// là public; write handler tự kiểm JWT.
    let hs_connection_routes = Router::new()
        .route("/api/hs-connection/counseling", get(hs_connection::get_counseling))
        .route("/api/hs-connection/campus-tour", post(hs_connection::register_campus_tour))
        .route("/api/hs-connection/questions", get(hs_connection::get_questions).post(hs_connection::create_question))
        .route("/api/hs-connection/questions/:id/answers", post(hs_connection::answer_question))
        .route("/api/hs-connection/connect/:userId", post(hs_connection::connect))
        .route("/api/hs-connection/my-network", get(hs_connection::get_my_network))
        .route("/api/hs-connection/network/respond", post(hs_connection::respond_to_request))
        .with_state(pool);

    // `/api/internships/*` — cơ hội thực tập (danh sách, chi tiết, ứng tuyển,
    // tìm gần nhất); đăng tuyển (chỉ doanh nghiệp / JWT). Các endpoint đọc
    // là public; các handler write tự kiểm JWT.
    let internship_routes = Router::new()
        .route("/api/internships", get(internship::get_internships).post(internship::create_internship))
        .route("/api/internships/nearby", get(internship::get_nearby))
        .route("/api/internships/:id", get(internship::get_internship_by_id))
        .route("/api/internships/:id/apply", post(internship::apply_internship))
        .with_state(pool);

    // `/api/impact-match/*` — ImpactMatch: ghép nối nhu cầu ↔ nhà tài trợ.
    // Danh sách/chi tiết, xếp hạng AI (lưu ý: POST, ngọt mềm khớp body với
    // old backend `POST /api/impact-match/rank`) và cache auto-scheduler là
    // công khai; các write handler (tạo nhu cầu / hồ sơ nhà tài trợ) tự kiểm
    // JWT và trả 401 khi thiếu.
    let impact_match_routes = Router::new()
        .route("/api/impact-match/needs", get(impact_match::get_needs).post(impact_match::create_need))
        .route("/api/impact-match/needs/:id", get(impact_match::get_need_by_id))
        .route("/api/impact-match/sponsors", get(impact_match::get_sponsors).post(impact_match::create_sponsor))
        .route("/api/impact-match/sponsors/:id", get(impact_match::get_sponsor_by_id))
        .route("/api/impact-match/rank", post(impact_match::rank))
        .route("/api/impact-match/rankings/cached", get(impact_match::get_cached_rankings))
        .with_state(pool);

    // `/api/intl/*` — chương trình quốc tế `programs` + mạng lưới lưu học
    // sinh `alumni` (trong nước + gần nhất, PostGIS).
    let intl_routes = Router::new()
        .route("/api/intl/programs", get(intl::get_programs).post(intl::create_program))
        .route("/api/intl/alumni", get(intl::get_alumni).post(intl::create_alumni))
        .route("/api/intl/alumni/nearby", get(intl::get_alumni_nearby))
        .with_state(pool);

    // `/api/library/*` — tài liệu học tập (resources, search, chi tiết, tóm
    // tắt AI, tạo tài liệu). Các endpoint đọc là public; `POST /resources`
    // tự kiểm JWT.
    let library_routes = Router::new()
        .route("/api/library/resources", get(library::get_resources).post(library::create_resource))
        .route("/api/library/resources/:id", get(library::get_resource_by_id))
        .route("/api/library/resources/:id/summary", get(library::summarize_resource))
        .route("/api/library/search", get(library::search_resources))
        .with_state(pool);

    // `/api/learning-spots/*` — địa điểm học tập (lân cận, tính trạng chỗ
    // ngồi, gợi ý AI, giải thích, tạo địa điểm). Các endpoint đọc là public;
    // write handler tự kiểm JWT.
    let learning_community_routes = Router::new()
        .route("/api/learning-spots/nearby", get(learning_community::get_nearby))
        .route("/api/learning-spots/:id/availability", get(learning_community::get_availability))
        .route("/api/learning-spots/recommend", get(learning_community::recommend_spots))
        .route("/api/learning-spots/explain", post(learning_community::explain_spot))
        .route("/api/learning-spots", post(learning_community::create_spot))
        .with_state(pool);

    // `/api/impact-measurement/*` — báo cáo tác động AI (proxy `ai-service`),
    // gồm cả báo cáo auto-scheduler `auto-cached/{regionId}` (dữ liệu sẵn,
    // không chờ LLM).
    let impact_measurement_routes = Router::new()
        .route("/api/impact-measurement/metrics", get(impact_measurement::get_metrics))
        .route("/api/impact-measurement/measure", get(impact_measurement::measure))
        .route("/api/impact-measurement/auto-cached/:regionId", get(impact_measurement::get_auto_cached_measure))
        .with_state(pool);

    // `/api/blockchain/*` — ký/xác thực chứng chỉ (hash demo, không ghi DB);
    // `/api/blockchain/verify` là công khai, `/api/blockchain/issue` giữ JWT
    // (handler tự kiểm).
    let blockchain_routes = Router::new()
        .route("/api/blockchain/issue", post(blockchain::issue_certificate))
        .route("/api/blockchain/verify/:code", get(blockchain::verify))
        .with_state(pool);

    // `/api/bookmarks/*` — bookmark/unbookmark tài nguyên (danh sách theo
    // `?target_type=` + tiêu đề join, toggle). Cần JWT.
    let bookmarks_routes = Router::new()
        .route("/api/bookmarks", get(bookmarks::list).post(bookmarks::toggle))
        .with_state(pool);

    // `/api/offline/*` — Edge AI Tutor: proxy ai-service + đáp ứng mẫu
    // fallback (public, giống old controller `@Public()`).
    let offline_tutor_routes = Router::new()
        .route("/api/offline/tutor", post(offline_tutor::tutor))
        .route("/api/offline/status", get(offline_tutor::status))
        .with_state(pool);

    // `/api/payment/*` — thanh toán (giao dịch kinh doanh + lịch hẹn mentor).
    // Cần JWT (handler tự kiểm).
    let payment_routes = Router::new()
        .route("/api/payment/process/:transactionId", post(payment::process_payment))
        .route("/api/payment/booking/:bookingId", post(payment::create_booking_transaction))
        .with_state(pool);

    // `/api/storage/*` — tải lên, phục vụ file tĩnh (public) và xóa file
    // (JWT, kiểm chủ sở hữu).
    let storage_routes = Router::new()
        .route("/api/storage/my-files", get(storage::get_my_files))
        .route("/api/storage/upload", post(storage::upload_file))
        .route("/api/storage/media/:objectName", get(storage::serve_media))
        .route("/api/storage/:id", delete(storage::delete_file))
        .with_state(pool);

    // `/api/mentoring/*` — mentor registration, mentor search, AI matching,
    // availability slots, booking và cập nhật trạng thái lịch hẹn.
    let mentoring_routes = Router::new()
        .route("/api/mentoring/register/:userId", post(mentor::register_mentor))
        .route("/api/mentoring/mentors", get(mentor::get_mentors))
        .route("/api/mentoring/mentors/:id", get(mentor::get_mentor_by_id))
        .route("/api/mentoring/mentors/recommend/:userId", get(mentor::recommend_mentors))
        .route("/api/mentoring/mentors/:mentorId/slots", get(mentor::get_mentor_slots))
        .route("/api/mentoring/availability", post(mentor::add_availability))
        .route("/api/mentoring/me/availability", get(mentor::get_my_availability))
        .route("/api/mentoring/book", post(mentor::book_session))
        .route("/api/mentoring/bookings/:id/status", patch(mentor::update_booking_status))
        .route("/api/mentoring/me/bookings", get(mentor::get_my_bookings))
        .route("/api/mentoring/student/:studentId/bookings", get(mentor::get_student_bookings))
        .route("/api/mentoring/mentor/:mentorId/bookings", get(mentor::get_mentor_bookings))
        .with_state(pool);

    // `/api/notifications/*` — thông báo của người dùng (tạo, danh sách,
    // chi tiết theo id/người dùng, đánh dấu đã đọc). `PUBLIC_PATHS` cho phép
    // đọc không cần JWT; các handler write tự kiểm JWT.
    let notifications_routes = Router::new()
        .route("/api/notifications/send", post(notifications::send_notification))
        .route("/api/notifications/subscribe", get(notifications::subscribe_sse))
        .route("/api/notifications", get(notifications::get_my_notifications))
        .route("/api/notifications/:userId", get(notifications::get_notifications_for_user))
        .route("/api/notifications/:id/read", put(notifications::mark_as_read))
        .with_state(pool);

    // `/api/pins/*` — ghim bản đồ (danh sách, chi tiết, tạo, sửa, xóa). Các
    // endpoint đọc là public; write handler tự kiểm JWT.
    let pin_routes = Router::new()
        .route("/api/pins", get(pin::find_pins).post(pin::create_pin))
        .route("/api/pins/:id", get(pin::get_pin).patch(pin::update_pin).delete(pin::delete_pin))
        .with_state(pool);

    // `/api/scholarships/*` — học bổng (danh sách/phân trang, chi tiết, nộp
    // đơn, kiểm tra điều kiện AI, đơn của người dùng, admin tạo/cập nhật).
    // Các endpoint đọc là public; write handler tự kiểm JWT.
    let scholar_routes = Router::new()
        .route("/api/scholarships", get(scholar::get_scholarships).post(scholar::create_scholarship))
        .route("/api/scholarships/:id", get(scholar::get_scholarship_by_id).put(scholar::update_scholarship))
        .route("/api/scholarships/:id/check-eligibility", post(scholar::check_eligibility))
        .route("/api/scholarships/me/applications", get(scholar::get_my_applications))
        .route("/api/scholarships/:id/apply", post(scholar::apply_scholarship))
        .with_state(pool);

    // `/api/summer/*` — chiến dịch Mùa hè xanh (đăng ký, hoạt động, báo
    // cáo, phê duyệt TNV). Các endpoint đọc là public; write handler tự
    // kiểm JWT.
    let summer_routes = Router::new()
        .route("/api/summer/campaigns", get(summer::get_campaigns).post(summer::create_campaign))
        .route("/api/summer/campaigns/:id/activities", post(summer::add_activity))
        .route("/api/summer/campaigns/:id/daily-report", get(summer::get_daily_report))
        .route("/api/summer/campaigns/:id/register", post(summer::register_volunteer))
        .route("/api/summer/registrations/:id/status", patch(summer::update_registration_status))
        .with_state(pool);

    // `/api/surveys/*` — khảo sát (danh sách, chi tiết, tạo, nộp câu trả lời,
    // phân tích, xuất dữ liệu). Các endpoint đọc là public; write handler tự
    // kiểm JWT.
    let survey_routes = Router::new()
        .route("/api/surveys", get(survey::get_surveys).post(survey::create_survey))
        .route("/api/surveys/:id", get(survey::get_survey_by_id))
        .route("/api/surveys/:id/submit", post(survey::submit_response))
        .route("/api/surveys/:id/analytics", get(survey::get_survey_analytics))
        .route("/api/surveys/:id/export", get(survey::export_survey_data))
        .with_state(pool);

    // `/api/volunteers/*` — hoạt động tình nguyện (lịch sử personal + ghi
    // nhận giờ).
    let volunteer_routes = Router::new()
        .route("/api/volunteers", get(volunteer::get_volunteers))
        .route("/api/volunteers/activities", get(volunteer::get_activities).post(volunteer::log_activity))
        .with_state(pool);

    // `/api/wifi/*` — bản đồ phủ sóng Wifi miễn phí (danh sách, tìm lân
    // cận, báo cáo, speed-test).
    let wifi_routes = Router::new()
        .route("/api/wifi/locations", get(wifi::get_wifi_locations).post(wifi::report_wifi))
        .route("/api/wifi/locations/nearby", get(wifi::get_wifi_nearby))
        .route("/api/wifi/locations/:id/speed-test", post(wifi::submit_speed_test))
        .with_state(pool);

    // `/api/analytics/*` — ghi nhận sự kiện và thống kê (công khai).
    let analytics_routes = Router::new()
        .route("/api/analytics/track", post(analytics::track_event))
        .route("/api/analytics/stats", get(analytics::get_stats))
        .route("/api/analytics/education", get(analytics::get_education_stats))
        .with_state(pool);

    // `/api/crawler/*` — quy trình crawl bản đồ (admin/moderator).
    let crawler_routes = Router::new()
        .route("/api/crawler/trigger", post(crawler::trigger_crawl))
        .route("/api/crawler/status", get(crawler::get_crawl_status))
        .route("/api/crawler/history", get(crawler::get_crawl_history))
        .route("/api/crawler/stats", get(crawler::get_crawl_stats))
        .route("/api/crawler/types", get(crawler::get_crawl_types))
        .with_state(pool);

    // `/api/dashboard/*` — tổng quan, insight AI, lịch sử và thống kê.
    let dashboard_routes = Router::new()
        .route("/api/dashboard/overview", get(dashboard::get_overview))
        .route("/api/dashboard/insight", get(dashboard::get_daily_insight))
        .route("/api/dashboard/history", get(dashboard::get_history))
        .route("/api/dashboard/stats", get(dashboard::get_stats))
        .with_state(pool);

    // `/api/geo/*` — ghép mảnh bản đồ vệ tinh và AI vision phát hiện cơ sở
    // vật chất giáo dục (degraded fallback).
    let geo_routes = Router::new()
        .route("/api/geo/satellite-tiles", get(geo::get_satellite_tiles))
        .route("/api/geo/vision-detect", post(geo::vision_detect))
        .with_state(pool);

    // `/api/opportunities/*` — cơ hội học tập/thực tập, tìm đồng đội và
    // Opportunity Radar (ghép hồ sơ ↔ cơ hội).
    let opportunity_routes = Router::new()
        .route("/api/opportunities", get(opportunity::get_opportunities).post(opportunity::create_opportunity))
        .route("/api/opportunities/:id", get(opportunity::find_one))
        .route("/api/opportunities/:id/team-finding", post(opportunity::toggle_team_finding))
        .route("/api/opportunities/match", post(opportunity::match_opportunities))
        .with_state(pool);

    // `/api/resource-exchange/*` — ghép cung–cầu nguồn lực (sách, thiết bị,
    // giờ tình nguyện). Endpoint đọc + `match` là public; write tự kiểm JWT.
    let resource_exchange_routes = Router::new()
        .route("/api/resource-exchange/resources", get(resource_exchange::get_resources).post(resource_exchange::create_resource))
        .route("/api/resource-exchange/resources/:id", get(resource_exchange::get_resource_by_id))
        .route("/api/resource-exchange/requests", get(resource_exchange::get_resource_requests).post(resource_exchange::create_resource_request))
        .route("/api/resource-exchange/requests/:id", get(resource_exchange::get_resource_request_by_id))
        .route("/api/resource-exchange/matches", get(resource_exchange::get_resource_matches))
        .route("/api/resource-exchange/match", post(resource_exchange::match_resources))
        .route("/api/resource-exchange/cached-matches", get(resource_exchange::get_cached_matches))
        .route("/api/resource-exchange/auto-health", get(resource_exchange::get_auto_health))
        .with_state(pool);

    // `/api/roles/*` — quản lý vai trò RBAC (admin/moderator).
    let role_routes = Router::new()
        .route("/api/roles", get(role::find_all).post(role::create))
        .route("/api/roles/:id", get(role::find_one))
        .with_state(pool);

    // `/api/share/*` — chia sẻ sách/tài liệu/học cụ và yêu cầu mượn.
    let share_routes = Router::new()
        .route("/api/share/items", get(share::get_items).post(share::create_item))
        .route("/api/share/me/requests", get(share::get_my_requests))
        .route("/api/share/items/:id/request", post(share::request_item))
        .route("/api/share/items/:id/return", post(share::return_item))
        .with_state(pool);

    // `/api/stem/*` — phòng lab STEM, tìm lab gần nhất (PostGIS) và đặt lịch
    // mượn thiết bị.
    let stem_routes = Router::new()
        .route("/api/stem", get(stem::get_module_info))
        .route("/api/stem/labs", get(stem::get_labs).post(stem::register_lab))
        .route("/api/stem/labs/nearby", get(stem::get_nearby))
        .route("/api/stem/labs/:id/book", post(stem::book_lab))
        .with_state(pool);

    Router::new()
        .merge(health)
        .merge(auth_routes)
        .merge(ai_routes)
        .merge(map_routes)
        .merge(certificate_routes)
        .merge(donation_routes)
        .merge(events_routes)
        .merge(gamification_routes)
        .merge(green_routes)
        .merge(hackathon_routes)
        .merge(blockchain_routes)
        .merge(bookmarks_routes)
        .merge(hs_connection_routes)
        .merge(internship_routes)
        .merge(impact_match_routes)
        .merge(intl_routes)
        .merge(library_routes)
        .merge(learning_community_routes)
        .merge(impact_measurement_routes)
        .merge(career_routes)
        .merge(admin_routes)
        .merge(audit_log_routes)
        .merge(business_routes)
        .merge(community_routes)
        .merge(mentoring_routes)
        .merge(notifications_routes)
        .merge(pin_routes)
        .merge(scholar_routes)
        .merge(storage_routes)
        .merge(summer_routes)
        .merge(survey_routes)
        .merge(offline_tutor_routes)
        .merge(payment_routes)
        .merge(volunteer_routes)
        .merge(wifi_routes)
        .merge(analytics_routes)
        .merge(crawler_routes)
        .merge(dashboard_routes)
        .merge(geo_routes)
        .merge(opportunity_routes)
        .merge(resource_exchange_routes)
        .merge(role_routes)
        .merge(share_routes)
        .merge(stem_routes)
        .layer(AuthLayer)
}