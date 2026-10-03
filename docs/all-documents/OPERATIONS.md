# Hướng dẫn Vận hành Hệ thống EduMap (Production Ready)

Tài liệu này cung cấp các hướng dẫn cơ bản để quản lý và vận hành hệ thống EduMap trong môi trường thực tế.

## 1. Khởi động và Dừng Hệ thống

Hệ thống được quản lý hoàn toàn bằng Docker Compose.

- **Khởi động toàn bộ các dịch vụ (chế độ nền):**
  ```bash
  docker-compose up -d
  ```
- **Dừng toàn bộ hệ thống:**
  ```bash
  docker-compose down
  ```
- **Xem trạng thái các container:**
  ```bash
  docker-compose ps
  ```

## 2. Quản lý Cấu hình (Biến môi trường)

Tất cả các cấu hình nhạy cảm (mật khẩu, cổng, endpoint) được quản lý trong file `.env`.
- Tuyệt đối **không** push file `.env` lên kho lưu trữ code (GitHub/GitLab).
- Sử dụng `.env.example` làm mẫu khi triển khai trên môi trường mới.

## 3. Giám sát Hệ thống (Monitoring)

Hệ thống tích hợp sẵn bộ công cụ giám sát:

- **Prometheus:** Truy cập tại `http://localhost:9090`. Dùng để kiểm tra các metrics thô từ Backend và AI Service.
- **Grafana:** Truy cập tại `http://localhost:3003`.
    - **User mặc định:** `admin`
    - **Password mặc định:** `admin` (Cần đổi ngay sau khi đăng nhập lần đầu).
    - Hướng dẫn nhanh: Thêm Data Source là Prometheus (`http://prometheus:9090`) để bắt đầu vẽ biểu đồ.

## 4. Quản lý Dữ liệu

- **CSDL PostgreSQL:** Mở cổng `5433` ra máy host để quản trị (dùng pgAdmin hoặc DBeaver).
- **Seed Dữ liệu:** Để nạp lại dữ liệu từ Excel, chạy script:
  ```bash
  .venv/Scripts/python.exe scripts/seed_database.py
  ```
- **MinIO (Object Storage):** Lưu trữ file và tài liệu. Quản lý qua giao diện console (thông tin đăng nhập trong `.env`).

## 5. CI/CD Pipeline

Mọi thay đổi trong thư mục `backend/` khi đẩy lên nhánh `main` sẽ tự động kích hoạt workflow build trên GitHub Actions. Kiểm tra trạng thái tại tab "Actions" trên kho lưu trữ GitHub của bạn.

---
*Ghi chú: Hiện tại dịch vụ Frontend đang bị vô hiệu hóa trong docker-compose.yml để tập trung vào ổn định Backend. Kích hoạt lại bằng cách bỏ comment khối frontend trong file cấu hình.*
