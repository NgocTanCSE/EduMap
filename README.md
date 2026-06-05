---
title: EduMap
emoji: 🗺️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
---

# EduMap (Educational Map)

Đây là hệ thống EduMap, bao gồm Frontend (Next.js), Backend (Node.js), và AI Service (Python). 
Dự án này đã được cấu hình sẵn để triển khai lên môi trường **Hugging Face Spaces** sử dụng Docker.

## Cấu trúc dự án
- `frontend/`: Ứng dụng giao diện người dùng xây dựng bằng Next.js.
- `backend/`: Máy chủ API xây dựng bằng Node.js / NestJS.
- `ai-service/`: Dịch vụ AI xây dựng bằng Python (FastAPI).
- `mobile/`: Ứng dụng di động (React Native / Expo).
- `infrastructure/`: Cấu hình hạ tầng (Nginx, Supervisor).

## Hướng dẫn triển khai lên Hugging Face Spaces

Dự án này sử dụng GitHub Actions để tự động đồng bộ (sync) lên Hugging Face Spaces mỗi khi có thay đổi trên nhánh `main`.

1. **Chuẩn bị Token:**
   - Tạo một Access Token trên Hugging Face với quyền `Write`.
   - Vào mục Settings -> Secrets and variables -> Actions trên kho lưu trữ GitHub.
   - Thêm một biến Secret mới với tên `HF_TOKEN` và dán mã token vào.

2. **Cấu hình không gian (Space):**
   - Đảm bảo bạn đã tạo một Space trống trên Hugging Face với môi trường là **Docker**.
   - Cập nhật đúng đường dẫn `https://tancse2005:${HF_TOKEN}@huggingface.co/spaces/tancse2005/Edumap` trong file `.github/workflows/deploy-hf.yml`.

3. **Deploy:**
   - Mỗi khi bạn commit và push code lên GitHub nhánh `main`, action sẽ tự động kích hoạt.
   - Quá trình này sẽ đổi tên file `Dockerfile.hf` thành `Dockerfile` (theo yêu cầu của Hugging Face) và đẩy toàn bộ mã nguồn sang Space của bạn.

## Chạy dự án ở môi trường Local (Máy tính cá nhân)
Nếu bạn muốn chạy dự án này trên máy tính bằng Docker:
```bash
docker-compose up --build
```
Hoặc bạn có thể chạy file `run.bat` (đối với Windows).
