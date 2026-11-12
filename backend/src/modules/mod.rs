//! Module registry: every `modules/*.rs` handler module is re-exported here so
//! `crate::modules::health`, `crate::modules::ai`, `crate::modules::auth`,
//! `crate::modules::map` and any future module resolve.
//!
//! (Rust wants either `modules.rs` or `modules/mod.rs`; this one declares the
//! modules alongside the plain-file modules such as `modules/mod.rs`.)

/// Authentication, profile, 2FA + account management.
pub mod auth;

/// Database and health probes (the `AuthLayer` and host proxy rely on them).
pub mod health;

/// AI proxy: `/api/ai/*` forwarded to the FastAPI ai-service (`chat`,
/// `agentChat`, SSE streaming).
pub mod ai;

/// Shared proxy into the ai-service + the routing service (OSRM/ORS).
pub mod proxy;

/// Map: POIs, locations, categories, stats, routing, climate, data gaps,
/// survey planning, NL search.
pub mod map;

/// Career: jobs, career paths, skills, user careers + applications, AI advice.
pub mod career;

/// Admin: dashboard stats, user management, pending content, AI reports
/// (question-gaps, data-quality, auto-scheduler health).
pub mod admin;

/// Business: business profiles, products, services, reviews, cart, checkout
/// và orders (kết nối doanh nghiệp / marketplace).
pub mod business;

/// Community: study-group posts, comments, likes and groups.
pub mod community;

/// Chứng nhận số: cấp, xác thực, hồ sơ năng lực và PDF.
pub mod certificate;

/// Quyên góp & hỗ trợ: chiến dịch quyên góp, VNPay và ghi nhận khoản đóng góp.
pub mod donate;

/// Events / workshop: danh sách, đăng ký đội, nộp bài và chấm điểm.
pub mod events;

/// Gamification: bảng xếp hạng, huy hiệu, tiến độ và hoạt động xanh.
pub mod gamification;

/// Green / Sống Xanh: thử thách, hoạt động và impact môi trường.
pub mod green;

/// Hackathon: danh sách cuộc thi, đăng ký đội, nộp bài và chấm điểm.
pub mod hackathon;

/// Blockchain: ký/xác thực chứng chỉ (hash demo, không ghi DB).
pub mod blockchain;

/// Bookmarks: đánh dấu/uỷ bookmark tài nguyên (học bổng, thực tập, ...).
pub mod bookmarks;

/// Offline Tutor: Edge AI Tutor, proxy ai-service + đáp ứng mẫu fallback.
pub mod offline_tutor;

/// Payment: xử lý thanh toán (giao dịch kinh doanh + lịch hẹn mentor).
pub mod payment;

/// File lưu trữ: tải lên, phục vụ file tĩnh và xóa file.
pub mod storage;

/// HS Connection: hồ sơ tư vấn tuyển sinh, Campus Tour ảo, câu hỏi tư vấn
/// và kết nối cựu HS-sinh viên.
pub mod hs_connection;

/// AI audit-log: nhật ký hoạt động hệ thống (admin/moderator).
pub mod audit_log;

/// Đo lường tác động AI (trước/sau): `impact-measurement`.
pub mod impact_measurement;

/// ImpactMatch: ghép nối nhu cầu ↔ nhà tài trợ (danh sách/chi tiết, xếp hạng
/// AI, kết quả auto-scheduler).
pub mod impact_match;

/// Thực tập (internships): danh sách, chi tiết, ứng tuyển, tìm lân cận.
pub mod internship;

/// Quốc tế: chương trình trao đổi + mạng lưới lưu học sinh (`intl`).
pub mod intl;

/// Thư viện tài liệu học tập (resources, search, summary, create).
pub mod library;

/// Learning community (learning-spots): địa điểm học tập, xếp hạng, giải
/// thích AI (gợi ý + tính trạng chỗ ngồi).
pub mod learning_community;

/// Mentoring: mentor registration, search, AI recommendations, availability,
/// bookings và booking status.
pub mod mentor;

/// Thông báo: gửi, danh sách, chi tiết, đánh dấu đã đọc (`notifications`).
pub mod notifications;

/// Ghim bản đồ (chính sách): danh sách, chi tiết, tạo, sửa, xóa.
pub mod pin;

/// Học bổng: danh sách/phân trang, chi tiết, nộp đơn, kiểm tra điều kiện (AI
/// proxy), đơn của người dùng, quản lý admin (tạo/cập nhật).
pub mod scholar;

/// Mùa hè xanh: chiến dịch, hoạt động, báo cáo hằng ngày, đăng ký and
/// phê duyệt TNV.
pub mod summer;

/// Khảo sát: danh sách, chi tiết, tạo, nộp câu trả lời, phân tích, xuất dữ liệu.
pub mod survey;

/// Tình nguyện: hoạt động, ghi nhận giờ.
pub mod volunteer;

/// Wifi: danh sách điểm phủ sóng, tìm gần nhất (PostGIS), báo cáo, speed-test.
pub mod wifi;

/// Analytics: ghi nhận sự kiện người dùng, thống kê toàn hệ thống và thống kê
/// giáo dục (`education_stats`).
pub mod analytics;

/// Crawler: quy trình crawl dữ liệu (WiFi, trường học, không gian xanh) và
/// OpenLibrary (sách) vào DB.
pub mod crawler;

/// Dashboard: tổng quan cá nhân, lời khuyên AI mỗi ngày, lịch sử đăng ký/ứng
/// tuyển và thống kê heatmap dành cho admin.
pub mod dashboard;

/// Geo / GeoVision: ghép mảnh bản đồ vệ tinh và phát hiện cơ sở vật chất giáo
/// dục qua AI vision (degraded fallback, không 500).
pub mod geo;

/// Opportunity: cơ hội (thực tập, học bổng, cuộc thi) trên bản đồ, tìm đồng
/// đội và Opportunity Radar (ghép hồ sơ ↔ cơ hội qua AI).
pub mod opportunity;

/// Resource Exchange: ghép nguồn lực dư thừa (sách, thiết bị, giờ tình nguyện)
/// ↔ yêu cầu cần nguồn lực (cung ↔ cầu).
pub mod resource_exchange;

/// Role: quản lý vai trò RBAC (danh sách, chi tiết, tạo vai trò — admin/mod).
pub mod role;

/// Share: chia sẻ sách/tài liệu/học cụ và yêu cầu mượn (borrow requests).
pub mod share;

/// STEM: phòng lab STEM, tìm lab gần nhất (PostGIS), đăng ký lab và đặt lịch
/// mượn thiết bị (chống trùng).
pub mod stem;
