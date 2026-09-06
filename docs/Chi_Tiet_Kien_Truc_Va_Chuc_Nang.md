# Bóc Tách Chi Tiết Kiến Trúc 4 Tầng (BE, FE, API, Data) & Danh Mục Chức Năng Hệ Thống EduMap

> **Dự án**: Hệ sinh thái Bản đồ Giáo dục & Hướng nghiệp Thông minh (EduMap)  
> **Phiên bản**: 2.0.0 Production Architecture  
> **Cập nhật ngày**: 06/09/2026

---

## MỤC LỤC
1. [Tổng Quan Kiến Trúc Kỹ Thuật Hệ Thống](#1-tổng-quan-kiến-trúc-kỹ-thuật-hệ-thống)
2. [Bóc Tách Tầng Backend (BE Layer)](#2-bóc-tách-tầng-backend-be-layer)
3. [Bóc Tách Tầng Frontend & Mobile (FE Layer)](#3-bóc-tách-tầng-frontend--mobile-fe-layer)
4. [Bóc Tách Tầng Giao Tiếp API (API Layer)](#4-bóc-tách-tầng-giao-tiếp-api-api-layer)
5. [Bóc Tách Tầng Dữ Liệu & Lưu Trữ (Data Layer)](#5-bóc-tách-tầng-dữ-liệu--lưu-trữ-data-layer)
6. [Đặc Tả Chi Tiết Từng Chức Năng Nghiệp Vụ](#6-đặc-tả-chi-tiết-từng-chức-năng-nghiệp-vụ)

---

## 1. Tổng Quan Kiến Trúc Kỹ Thuật Hệ Thống

EduMap được xây dựng theo mô hình **Hybrid Clean Monorepo / Multi-tier Distributed Architecture**, bao gồm 4 tầng kỹ thuật chính kết nối với cụm hạ tầng vi dịch vụ đám mây:

```
[Người dùng Web / Mobile / Admin]
       │                 │
       ▼                 ▼
[Next.js 14 Portal] [React Native Expo]
       │                 │  (HTTPS / WSS)
       └────────┬────────┘
                ▼
        [Nginx Edge Proxy] (SSL, WAF, Rate Limit)
                │
       ┌────────┴──────────────────────────┐
       ▼                                   ▼
[NestJS Core API - :3000]       [FastAPI AI Engine - :8000]
(38 Domain Modules)              (RAG, Gemini 1.5, ChromaDB)
       │                                   │
       ├─────────────────┬─────────────────┤
       ▼                 ▼                 ▼
[PostgreSQL 16 + PostGIS] [Redis 7 Cluster] [MinIO S3 Storage]
(85 Entities, GiST Index) (Cache, BullMQ)   (Tài liệu, Minh chứng)
```

- **Mục tiêu kiến trúc**: Tối ưu hóa khả năng truy vấn không gian GIS lớn (PostGIS), hỗ trợ tìm kiếm ngữ nghĩa RAG (ChromaDB + Gemini AI), xử lý giao dịch ký quỹ bảo lãnh và bảo mật phân quyền RBAC 5 cấp.

---

## 2. Bóc Tách Tầng Backend (BE Layer)

### 2.1. Ngăn Xếp Công Nghệ (Backend Stack)
- **Framework chính**: NestJS 10.x (Node.js 20 LTS, TypeScript 5.3)
- **AI Microservice**: Python 3.11, FastAPI, LangChain, Google Generative AI (Gemini 1.5 Flash), ChromaDB
- **ORM / Dữ liệu**: TypeORM 0.3.x kết hợp PostGIS driver, ioredis 5.x
- **Bảo mật & Middleware**: Passport-JWT, Bcrypt, Helmet, Express-Rate-Limit, ThrottlerModule, Class-Validator, Class-Transformer
- **Xử lý tác vụ ngầm**: BullMQ (Redis-backed Queue) xử lý gửi email, phân tích tài liệu và dọn dẹp cache GIS.

### 2.2. Danh Mục 38 Module Backend NestJS
Hệ thống được tổ chức dạng Hub-and-Spoke 3 cột nghiệp vụ:

| Nhóm Module | Tên Module | Trách Nhiệm & Vai Trò Nghiệp Vụ |
|---|---|---|
| **Cột Hạ Tầng & Bảo Mật (Core Infra)** | `auth` | Đăng nhập, đăng ký, xác thực JWT, refresh token, Google OAuth |
| | `role` | Phân quyền RBAC (`STUDENT`, `MENTOR`, `BUSINESS`, `MODERATOR`, `ADMIN`) |
| | `audit-log` | Ghi vết hành vi, thay đổi trạng thái giao dịch và quyền hạn |
| | `notifications` | Quản lý thông báo in-app, WebPush và gửi qua Socket.io |
| | `storage` | Tải lên, nén và phân phối tệp tin qua MinIO / S3 Presigned URL |
| | `payment` | Tích hợp cổng VNPay, MoMo, quản lý giao dịch nạp rút ký quỹ |
| | `crawler` | Thu thập dữ liệu GIS điểm trường, thư viện, Wi-Fi công cộng |
| | `feature` | Cờ tính năng (Feature Flags) cho phép bật tắt tính năng linh hoạt |
| | `mobile-config`| Cung cấp phiên bản ứng dụng, cấu hình bảo trì cho mobile app |
| **Cột Nghiệp Vụ Không Gian & Đào Tạo** | `map` | Bản đồ GIS, định vị điểm giáo dục, tìm kiếm bán kính `ST_DWithin` |
| | `wifi` | Bản đồ mạng Wi-Fi miễn phí, kiểm tra trạng thái hoạt động |
| | `mobile-unit` | Lộ trình các chuyến xe thư viện lưu động phục vụ vùng sâu xa |
| | `stem` | Không gian sáng chế STEM Lab, đặt lịch mượn thiết bị thực hành |
| | `library` | Kho học liệu số, sách điện tử và danh mục thư viện công cộng |
| | `career` | Cây định hướng nghề nghiệp, khảo sát tính cách Holland Code |
| | `internship` | Kết nối cơ hội thực tập doanh nghiệp, nộp đơn ứng tuyển |
| | `opportunity` | Tin tuyển dụng bán thời gian, việc làm sinh viên |
| | `hs-connection`| Chương trình kết nối học sinh THPT với các trường đại học |
| | `summer` | Chương trình tình nguyện hè, chiến dịch Mùa Hè Xanh |
| **Cột Cố Vấn, Học Bổng & Xã Hội** | `mentor` | Hồ sơ cố vấn, quản lý lịch rảnh, đặt lịch hẹn tư vấn 1-1 |
| | `scholar` | Danh mục học bổng nhà nước, doanh nghiệp, nộp hồ sơ xét duyệt |
| | `donate` | Chiến dịch quyên góp quỹ học bổng, theo dõi dòng tiền minh bạch |
| | `community` | Diễn đàn học tập, nhóm trao đổi bài vở, tương tác hỏi đáp |
| | `learning-community`| Lớp học cộng đồng ngoại khóa, câu lạc bộ học thuật |
| | `volunteer` | Đăng ký tình nguyện viên, ghi nhận số giờ công tác xã hội |
| | `certificate` | Cấp chứng nhận số tham gia hoạt động, tích hợp Blockchain hash |
| | `gamification` | Điểm thưởng, nhiệm vụ xanh, huy hiệu thành tích sinh viên |
| | `green` | Thử thách sống xanh, thu gom rác thải điện tử tích điểm |
| | `survey` | Khảo sát nhu cầu học tập, đánh giá chất lượng cơ sở đào tạo |
| | `business` | Gian hàng tài liệu học tập, sách giáo trình, xử lý đơn hàng |
| | `hackathon` | Cuộc thi sáng tạo công nghệ, đăng ký đội thi, nộp bài dự thi |
| | `intl` | Chương trình trao đổi sinh viên quốc tế, du học |
| | `share` | Chia sẻ bài viết, chia sẻ vị trí học tập trên mạng xã hội |
| | `analytics` | Thống kê phân tích truy cập, heatmap nhu cầu giáo dục |
| | `dashboard` | Số liệu tổng quan điều hành cho ban quản trị và sở GD&ĐT |
| | `ai` | Proxy kết nối tới FastAPI AI Microservice |

### 2.3. Cấu Trúc Vi Dịch Vụ AI FastAPI (`ai-service`)
- **12 Routers chuyên biệt**:
  1. `/chat`: Tiếp nhận câu hỏi, Semantic Cache Redis, trích xuất Vector ChromaDB, gọi Gemini 1.5 Flash.
  2. `/mentor`: Đề xuất cố vấn phù hợp dựa trên mục tiêu nghề nghiệp và kỹ năng học sinh.
  3. `/scholarship`: Đánh giá tiêu chí hồ sơ học bổng, tính tỷ lệ hợp lệ (% match).
  4. `/career`: Phân tích câu trả lời trắc nghiệm, sinh lộ trình nghề nghiệp cá nhân hóa.
  5. `/moderation`: Lọc từ khóa thô tục bằng Regex (<5ms) và phân tích độc hại ngữ nghĩa qua LLM.
  6. `/search`: Tìm kiếm ngữ nghĩa tài liệu học tập và địa điểm trường học.
  7. `/predictive`: Dự báo xu hướng việc làm và nhu cầu đào tạo các ngành trọng điểm.
  8. `/recommend`: Gợi ý khóa học, sự kiện, học bổng theo sở thích cá nhân.
  9. `/summarize`: Tóm tắt tài liệu PDF giáo trình dài thành các ý chính.
  10. `/quiz`: Tự động sinh câu hỏi ôn tập từ nội dung bài học.
  11. `/feedback`: Thu thập phản hồi câu trả lời của trợ lý ảo để tinh chỉnh RAG.
  12. `/health`: Kiểm tra tình trạng kết nối ChromaDB, Redis và Gemini API.

---

## 3. Bóc Tách Tầng Frontend & Mobile (FE Layer)

### 3.1. Web Portal (Next.js 14 App Router)
- **Công nghệ**: Next.js 14.2, React 18, TypeScript, Tailwind CSS, Shadcn UI, Leaflet / MapLibre GL, Lucide React, TanStack React Query v5.
- **Cấu trúc Thư mục Định tuyến (`frontend/app`)**:
  - `/` (Trang chủ): Bản đồ tương tác vệ tinh, thanh tìm kiếm thông minh, banner sự kiện nổi bật.
  - `/map`: Không gian bản đồ GIS toàn màn hình, bộ lọc đa tầng (Trường học, Wi-Fi, Thư viện, Xe lưu động), tính toán bán kính gần nhất.
  - `/ai-chat`: Trợ lý ảo EduBot RAG, hỗ trợ markdown, công thức toán LaTeX, gợi ý câu hỏi thông minh.
  - `/career`: Khảo sát trắc nghiệm Holland Code, biểu đồ mạng nhện kỹ năng, cây lộ trình ngành nghề.
  - `/mentor`: Danh bạ chuyên gia, xem đánh giá sao, chọn khung giờ rảnh và thanh toán lịch hẹn.
  - `/scholarships`: Cổng thông tin học bổng, công cụ kiểm tra điều kiện tự động bằng AI, nộp hồ sơ trực tuyến.
  - `/marketplace`: Sàn trao đổi sách giáo trình cũ, tài liệu ôn thi, giỏ hàng, cổng thanh toán VNPay.
  - `/community`: Bảng tin sinh viên, diễn đàn thảo luận theo chủ đề, đăng bài, bình luận, tương tác.
  - `/green`: Bảng theo dõi thử thách bảo vệ môi trường, quy đổi rác điện tử lấy điểm thưởng.
  - `/admin/*`: Bộ công cụ quản trị (Duyệt người dùng, kiểm duyệt bài viết, thống kê doanh thu, cấu hình hệ thống).
  - `/moderator/*`: Màn hình kiểm duyệt nội dung cộng đồng, xử lý báo cáo vi phạm.

### 3.2. Mobile App (React Native Expo SDK 50)
- **Cấu trúc thư mục (`mobile/`)**:
  - `screens/HomeScreen.tsx`: Bảng điều khiển sinh viên, lịch hẹn tư vấn sắp tới, nhiệm vụ xanh trong ngày.
  - `screens/MapScreen.tsx`: Tích hợp GPS thiết bị thời gian thực, hiển thị chỉ đường đi bộ tới điểm Wi-Fi công cộng và thư viện.
  - `screens/ChatScreen.tsx`: Giao diện trò chuyện trợ lý ảo tối ưu hóa bàn phím di động.
  - `services/LocationService.ts`: Lắng nghe cảm biến GPS nền, phát hiện sinh viên đang ở gần cơ sở giáo dục để gợi ý tiện ích.
  - `services/OfflineStorage.ts`: Lưu trữ bản đồ và danh bạ cơ sở giáo dục ngoại tuyến bằng SQLite khi mất mạng.

---

## 4. Bóc Tách Tầng Giao Tiếp API (API Layer)

Hệ thống cung cấp hơn 120 RESTful Endpoints được chuẩn hóa chuẩn OpenAPI 3.0 / Swagger UI tại đường dẫn `/api/docs`.

### Ma Trận Endpoints Đại Diện Theo Module

| Nhóm Nghiệp Vụ | Method | Endpoint Path | Quyền Hạn (Guards) | Mục Đích Xử Lý & Dữ Liệu |
|---|---|---|---|---|
| **Xác thực (Auth)** | `POST` | `/api/v1/auth/register` | Public | Đăng ký tài khoản (Email, Mật khẩu, Vai trò ban đầu) |
| | `POST` | `/api/v1/auth/login` | Public (Throttler 5/min) | Xác thực, trả về cặp AccessToken (15m) và RefreshToken (7d) |
| | `POST` | `/api/v1/auth/refresh` | Public (Refresh Token) | Cấp lại AccessToken mới mà không cần đăng nhập lại |
| | `GET` | `/api/v1/auth/profile` | `JwtAuthGuard` | Lấy thông tin cá nhân và quyền hạn người dùng hiện tại |
| **Bản đồ GIS** | `GET` | `/api/v1/map/locations` | Public | Lấy danh sách địa điểm theo hộp bao tọa độ (`bbox`) hoặc bán kính |
| | `POST` | `/api/v1/map/locations` | `Roles(ADMIN, MOD)` | Thêm mới cơ sở giáo dục, điểm Wi-Fi công cộng kèm tọa độ PostGIS |
| | `GET` | `/api/v1/map/nearby` | Public | Tìm địa điểm gần nhất trong bán kính `radius` mét (`ST_DWithin`) |
| **Trợ lý AI** | `POST` | `/api/v1/ai/chat` | `JwtAuthGuard` | Gửi câu hỏi, gọi RAG ChromaDB và trả về câu trả lời từ Gemini |
| | `POST` | `/api/v1/ai/match-scholarship` | `JwtAuthGuard` | Đẩy thông tin học lực/hoàn cảnh để AI chấm điểm hợp lệ học bổng |
| **Cố vấn (Mentor)**| `GET` | `/api/v1/mentor/list` | Public | Lấy danh sách cố vấn kèm bộ lọc chuyên ngành và mức phí |
| | `POST` | `/api/v1/mentor/bookings` | `Roles(STUDENT)` | Đặt lịch tư vấn theo khung giờ rảnh (`slotId`), trừ tiền ký quỹ |
| | `PUT` | `/api/v1/mentor/bookings/:id`| `Roles(MENTOR)` | Cố vấn chấp thuận hoặc từ chối lịch hẹn tư vấn |
| **Học bổng & Quỹ** | `GET` | `/api/v1/scholar/list` | Public | Tra cứu các chương trình học bổng còn hạn nộp hồ sơ |
| | `POST` | `/api/v1/scholar/apply` | `Roles(STUDENT)` | Nộp hồ sơ học bổng đính kèm tệp minh chứng trên MinIO |
| | `POST` | `/api/v1/donate/create` | `JwtAuthGuard` | Khởi tạo giao dịch đóng góp quỹ học bổng qua cổng VNPay |
| **Thương mại** | `POST` | `/api/v1/business/orders` | `JwtAuthGuard` | Tạo đơn mua sách, tài liệu học tập, xác thực số lượng tồn kho |
| | `GET` | `/api/v1/business/checkout/vnpay`| `JwtAuthGuard` | Sinh URL thanh toán chuyển hướng sang cổng VNPay Gateway |

---

## 5. Bóc Tách Tầng Dữ Liệu & Lưu Trữ (Data Layer)

### 5.1. Cơ Sở Dữ Liệu Quan Hệ PostgreSQL 16 + PostGIS
Hệ thống sử dụng TypeORM quản lý 85 thực thể phân thành 7 Bounded Contexts chính:

1. **Context 1: Định danh & Phân quyền (IAM)**
   - `User`: ID, email, passwordHash, fullName, phone, role, isVerified, avatarUrl, createdAt.
   - `Role` & `Permission`: Bảng phân quyền chi tiết theo từng hành động.
   - `AuditLog`: userId, action, resource, ipAddress, userAgent, changes (JSONB).
2. **Context 2: Không gian Địa lý & Tiện ích (Geospatial)**
   - `Location`: name, address, district, coordinates (`geography(Point, 4326)`), categoryId, metadata (JSONB). Đánh chỉ mục GiST (`CREATE INDEX idx_locations_geom ON locations USING GIST(coordinates);`).
   - `WifiLocation`: ssid, bssid, password, speedMbps, isFree, locationId.
   - `MobileUnit`: vehicleNumber, scheduleTime, driverName, currentRoute (LineString).
   - `StemLab`: equipmentList, capacity, openHours, locationId.
3. **Context 3: Học vụ & Nghề nghiệp (Academic & Career)**
   - `CareerPath`: title, description, requiredSkills, salaryRange, demandOutlook.
   - `Job` & `Internship`: title, companyId, requirements, stipend, deadline, slots.
   - `LearningMaterial`: title, author, fileUrl, fileSize, isPublic, category.
4. **Context 4: Học bổng & Tài trợ (Scholarships & Grants)**
   - `Scholarship`: name, sponsorName, amountPerSlot, totalSlots, criteria (JSONB).
   - `ScholarshipApplication`: studentId, scholarshipId, status (`PENDING`, `APPROVED`, `REJECTED`), aiMatchScore.
   - `DonationCampaign` & `Donation`: Quản lý dòng tiền tài trợ minh bạch.
5. **Context 5: Cố vấn & Đồng hành (Mentorship)**
   - `Mentor`: userId, bio, company, position, hourlyRate, ratingAvg.
   - `MentorAvailability`: mentorId, dayOfWeek, startTime, endTime, isBooked.
   - `Booking`: studentId, mentorId, slotId, meetingLink (Jitsi/Meet), status (`CONFIRMED`, `COMPLETED`, `CANCELLED`).
6. **Context 6: Xã hội & Cộng đồng (Social & Engagement)**
   - `Group`, `Post`, `Comment`, `Event`, `EventRegistration`, `VolunteerHours`.
7. **Context 7: Thương mại & Gamification (Commerce & Rewards)**
   - `Product`, `Order`, `OrderItem`, `Transaction`, `Badge`, `GreenChallenge`.

### 5.2. Hệ Thống Bộ Đệm & Lưu Trữ Bổ Trợ
- **Redis 7**:
  - `CACHE_GIS_TILES:*`: Lưu đệm kết quả truy vấn bản đồ theo cụm địa lý (TTL = 1 giờ).
  - `RATELIMIT:*`: Lưu bộ đếm request theo IP/UserId phòng chống brute-force.
  - `BULLMQ:*`: Hàng đợi xử lý ngầm (gửi email, nén tệp, sinh vector).
- **ChromaDB**: Lưu trữ vector embedding văn bản 768 chiều phục vụ tìm kiếm cosine similarity cho AI Chatbot.
- **MinIO S3 Storage**: Lưu trữ an toàn các tệp PDF học bổng, ảnh đại diện, hóa đơn thanh toán.

---

## 6. Đặc Tả Chi Tiết Từng Chức Năng Nghiệp Vụ

### Chức Năng 1: Khai Thác Bản Đồ Giáo Dục & Tiện Ích GIS
- **Tác nhân**: Học sinh, Phụ huynh, Sinh viên.
- **Luồng hoạt động qua 4 tầng**:
  1. *FE*: Người dùng mở trang `/map`, trình duyệt kích hoạt Geolocation lấy tọa độ hiện tại, gửi yêu cầu với bán kính 5km.
  2. *API*: Gọi `GET /api/v1/map/nearby?lat=10.95&lng=106.82&radius=5000`.
  3. *BE*: `MapController` điều hướng sang `MapService`, dựng câu truy vấn không gian `ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(lng, lat), 4326), 5000)`.
  4. *Data*: PostgreSQL sử dụng chỉ mục không gian GiST trích xuất kết quả dưới 15ms. `MapService` lưu đệm vào Redis.
  5. *FE hiển thị*: Bản đồ Leaflet vẽ các marker phân màu: Đỏ (Trường ĐH/CĐ), Xanh dương (Điểm Wi-Fi miễn phí), Xanh lá (Không gian STEM). Nhấp vào hiển thị Popup thông tin chi tiết và nút "Chỉ đường".

### Chức Năng 2: Trợ Lý Ảo RAG Tư Vấn Học Tập & Định Hướng (EduBot)
- **Tác nhân**: Học sinh THPT, Sinh viên năm nhất.
- **Luồng hoạt động qua 4 tầng**:
  1. *FE*: Học sinh nhập câu hỏi: *"Em muốn theo ngành Trí tuệ nhân tạo ở Đồng Nai thì học trường nào và học phí bao nhiêu?"*.
  2. *API*: Gửi `POST /api/v1/ai/chat` kèm theo `conversationId`.
  3. *BE (NestJS)*: Ghi nhận câu hỏi, chuyển tiếp sang `FastAPI AI Microservice` (:8000).
  4. *AI Service*:
     - Băm câu hỏi kiểm tra Redis Semantic Cache.
     - Nếu chưa có: Gọi mô hình embedding biến đổi câu hỏi thành vector 768 chiều.
     - Truy vấn ChromaDB lấy top 3 đoạn thông tin chuẩn xác nhất về các trường ĐH tại Đồng Nai đào tạo CNTT/AI.
     - Ghép ngữ cảnh vào Prompt, gọi Gemini 1.5 Flash sinh câu trả lời tiếng Việt mạch lạc kèm trích dẫn nguồn dữ liệu.
  5. *Data*: Lưu lịch sử hội thoại vào bảng `chat_histories` trong PostgreSQL.
  6. *FE hiển thị*: Dòng chữ phản hồi dạng máy đánh chữ (Streaming Text), hiển thị kèm danh thiếp các trường học liên quan.

### Chức Năng 3: Đặt Lịch Tư Vấn 1-1 Với Cố Vấn Chuyên Môn (Mentor Booking)
- **Tác nhân**: Sinh viên (Người học) và Cố vấn (Mentor).
- **Luồng hoạt động qua 4 tầng**:
  1. *FE*: Sinh viên xem hồ sơ Mentor, chọn khung giờ rảnh ngày Thứ 7 từ 09:00 - 10:00.
  2. *API*: Gửi `POST /api/v1/mentor/bookings` với `{ mentorId, slotId, note }`.
  3. *BE*: `MentorService` mở một PostgreSQL Transaction:
     - Kiểm tra slot còn trống hay không (`SELECT ... FOR UPDATE`).
     - Kiểm tra số dư ví học tập của sinh viên có đủ chi trả mức phí tư vấn hay không.
     - Khóa slot, tạo bản ghi `Booking` trạng thái `PENDING_CONFIRMATION`, trừ tiền ví chuyển vào trạng thái ký quỹ (Escrow).
     - Tự động sinh phòng họp trực tuyến Jitsi Meet an toàn.
  4. *Data*: Cập nhật trạng thái slot thành `isBooked = true`.
  5. *Notification*: Bắn thông báo Socket.io và gửi email cho Mentor yêu cầu xác nhận lịch hẹn trong vòng 24 giờ.

### Chức Năng 4: Thẩm Định Hồ Sơ Học Bổng Bằng Trí Tuệ Nhân Tạo
- **Tác nhân**: Sinh viên và Nhà tài trợ / Cán bộ xét duyệt.
- **Luồng hoạt động qua 4 tầng**:
  1. *FE*: Sinh viên điền điểm GPA, thành tích giải thưởng và tải lên minh chứng gia cảnh khó khăn dạng tệp PDF.
  2. *API*: Gửi `POST /api/v1/scholar/apply`. Tệp PDF được tải thẳng lên MinIO Storage qua Presigned URL.
  3. *BE*: Tạo bản ghi `ScholarshipApplication` với trạng thái `AI_PROCESSING`. Đẩy tác vụ vào hàng đợi BullMQ.
  4. *AI Worker*:
     - Tải tệp PDF từ MinIO, sử dụng PyMuPDF trích xuất văn bản.
     - Đối chiếu các điều kiện trong trường `criteria` của học bổng với hồ sơ sinh viên.
     - Tính điểm tương thích `aiMatchScore` (từ 0 - 100%) và xuất nhận xét tóm tắt khách quan.
  5. *Data*: Cập nhật điểm `aiMatchScore` vào bảng `scholarship_applications`.
  6. *FE*: Cán bộ duyệt mở Dashboard thấy danh sách ứng viên sắp xếp theo điểm AI từ cao xuống thấp, giúp rút ngắn 80% thời gian thẩm định thủ công.

---
*Tài liệu được biên soạn và bảo chứng bởi Ban Kiến Trúc Kỹ Thuật Dự Án EduMap.*
