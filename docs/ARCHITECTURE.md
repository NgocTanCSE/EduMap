# 🏛️ Kiến trúc Hệ thống EduMap

## 1. Tổng quan
Hệ thống được thiết kế theo kiến trúc Microservices đơn giản, tập trung vào tính khả thi và hiệu năng.

## 2. Các thành phần chính
- **Client (Frontend):** Next.js App Router, giao diện Glassmorphism.
- **Core API (Backend):** NestJS đảm nhận logic nghiệp vụ, quản lý User và Database.
- **AI Engine:** Python FastAPI xử lý các tác vụ nặng về dữ liệu và ngôn ngữ (LLM).
- **Data Layer:**
  - PostgreSQL + PostGIS: Lưu trữ dữ liệu quan hệ và không gian.
  - Redis: Caching và Message Queue.
  - MinIO: Lưu trữ tệp tin (Học liệu).
  - ChromaDB: Cơ sở dữ liệu Vector cho AI.
