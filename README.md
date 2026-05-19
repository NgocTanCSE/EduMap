# 🌍 EduMap Ecosystem 2.0 - Hệ Sinh Thái Bản Đồ Giáo Dục Thông Minh

EduMap là một nền tảng tiên phong tích hợp **Bản đồ tương tác (GIS)**, **Trí tuệ nhân tạo (AI)**, và các module **Trò chơi hóa (Gamification)**, **Học bổng (Scholarship)**, **Tình nguyện (Volunteer)** và **Bảo vệ môi trường (Green Campus)** nhằm xây dựng hệ sinh thái kết nối học thuật, hướng nghiệp và phát triển bền vững cho sinh viên.

---

## 💎 Điểm Sáng Kiến Trúc & Công Nghệ

Hệ thống được thiết kế theo mô hình Microservices & Containerized bền vững:

### 1. Backend Core (NestJS 10)
- **Kiến trúc:** Modular Architecture sạch sẽ, phân tách rõ ràng trách nhiệm giữa Controllers, Services, Gateways, và Entities.
- **Bảo mật:** Tích hợp `Helmet` bảo vệ HTTP Headers, `ThrottlerGuard` chống tấn công DDoS/Brute-force (Rate Limiting), cấu hình CORS chặt chẽ.
- **Tối ưu hiệu năng:** 
  - **Redis Caching:** Global Cache qua `@nestjs/cache-manager` giảm tải tối đa cho cơ sở dữ liệu đối với các truy vấn điểm bản đồ.
  - **BullMQ:** Hệ thống hàng đợi (Message Queue) xử lý các tác vụ nền bất đồng bộ.

### 2. Frontend Web (Next.js 14 & TailwindCSS)
- **Giao diện:** Ngôn ngữ thiết kế Glassmorphism hiện đại, tối giản, sang trọng với các hiệu ứng vi mô sinh động, mượt mà.
- **Bản đồ:** Tích hợp `React-Leaflet` tương tác thời gian thực, hiển thị ranh giới địa lý (Choropleth Map) và tracking vị trí xe lưu động.

### 3. AI Service (Python FastAPI & LangChain)
- Trợ lý học tập ảo thông minh hỗ trợ giải đáp 24/7.
- Thuật toán định hướng lộ trình học tập cá nhân hóa & trắc nghiệm nghề nghiệp (AI Career Quiz).
- AI Computer Vision tự động kiểm tra và duyệt ảnh minh chứng hoạt động Xanh/Tình nguyện.

### 4. Cơ Sở Dữ Liệu & Lưu Trữ
- **PostgreSQL & PostGIS:** Lưu trữ và truy vấn dữ liệu không gian địa lý ưu việt (tọa độ điểm học tập, ranh giới khu vực).
- **MinIO (S3-compatible):** Lưu trữ tài liệu học liệu số, sách nói, ảnh minh chứng hoạt động một cách phi cấu trúc và bảo mật tuyệt đối.

---

## 🛠️ Bản Đồ Phân Bổ Các Module Chức Năng

Hệ thống đã phục hồi hoàn chỉnh và vận hành ổn định 9 module cốt lõi:

| STT | Module | Trạng Thái | Mô Tả Chức Năng |
| :--- | :--- | :---: | :--- |
| 1 | **Auth & Profile** | ✅ Active | Đăng ký, đăng nhập JWT, phân quyền Admin/User, mã hóa mật khẩu mật độ cao. |
| 2 | **Interactive Map** | ✅ Active | Bản đồ số GIS tích hợp định vị GPS, khoanh vùng cảnh báo học tập, theo dõi xe lưu động thời gian thực. |
| 3 | **AI Engine** | ✅ Active | Tư vấn học tập, phân tích lộ trình học tập, AI Career Quiz định hướng nghề nghiệp. |
| 4 | **Digital Library** | ✅ Active | Upload/Download tài liệu học tập, lưu trữ MinIO S3, tìm kiếm tài liệu tối ưu hóa mã hóa tiếng Việt. |
| 5 | **Gamification** | ✅ Active | Hệ thống tích lũy điểm thưởng XP, thực hiện thử thách học thuật, đổi quà. |
| 6 | **Green Campus** | ✅ Active | Thử thách tiết kiệm CO2, sống xanh, thống kê chỉ số bảo vệ môi trường toàn diện. |
| 7 | **Scholarship** | ✅ Active | Công cụ AI-matching hồ sơ học tập và hệ thống tự động kiểm tra điều kiện ứng tuyển học bổng phù hợp. |
| 8 | **Volunteer** | ✅ Active | Báo cáo giờ tình nguyện xã hội, tự động cộng dồn và AI duyệt cấp chứng nhận công dân tích cực. |
| 9 | **Real-time Call** | ✅ Active | WebSocket Gateway xử lý thông báo đa kênh, WebRTC Signaling hỗ trợ Mentor call trực tiếp. |

---

## 📦 Hướng Dẫn Khởi Chạy Nhanh Bằng Docker

Hệ thống đã được tối ưu hóa bằng **Multi-stage Build Dockerfile** giúp tối ưu hóa dung lượng Image, tăng tốc độ triển khai và bảo mật cấp Production (chạy dưới User không phải root).

### Bước 1: Chuẩn bị môi trường
Đảm bảo bạn đã cài đặt **Docker** và **Docker Compose**.

### Bước 2: Khởi chạy toàn bộ hệ sinh thái
Tại thư mục gốc chứa file `docker-compose.yml`, chạy lệnh:
```bash
docker-compose up --build -d
```

Docker Compose sẽ tự động xây dựng và khởi chạy 6 Containers độc lập:
1. `edumap_postgres` (PostgreSQL + PostGIS) tại port `5432`
2. `edumap_redis` (Redis Server) tại port `6379`
3. `edumap_minio` (S3 Object Storage) tại port `9000` & `9001`
4. `edumap_ai` (FastAPI AI Engine) tại port `8000`
5. `edumap_backend` (NestJS Production API) tại port `3000`
6. `edumap_frontend` (Next.js Web App) tại port `3001`

### Bước 3: Kiểm tra trạng thái hoạt động
- **Ứng dụng Web (Frontend):** Truy cập `http://localhost:3001` để trải nghiệm.
- **Tài liệu API (Swagger):** Truy cập `http://localhost:3000/api/docs` để tra cứu và thử nghiệm API trực tiếp.
- **MinIO Console:** Truy cập `http://localhost:9001` (Tài khoản: `admin` / Mật khẩu: `password123`) để quản trị tài nguyên học liệu.

---

## 🛡️ Hướng Dẫn Bảo Trì Hệ Thống

Để đảm bảo an toàn cơ sở dữ liệu trên môi trường Production:
1. **TypeORM Synchronize:** Hiện tại thuộc tính `synchronize` trong `AppModule` đã được chuyển đổi thông minh sang `process.env.NODE_ENV !== 'production'`. Điều này đảm bảo cơ sở dữ liệu không bao giờ bị ghi đè đột ngột khi chạy trên Production.
2. **Migrations:** Khi có thay đổi về cấu trúc Entity, hãy sử dụng TypeORM Migrations:
   ```bash
   npm run migration:generate
   npm run migration:run
   ```

---
© 2026 EduMap Ecosystem. Thiết kế và phát triển bởi Lê Ngọc Tân. Nền tảng hướng tới chuyển đổi số giáo dục bền vững.
