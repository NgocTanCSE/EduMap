# EduMap Frontend — Bản Đồ Giáo Dục & Hướng Nghiệp Số Thông Minh

Thư mục này chứa toàn bộ mã nguồn Frontend độc lập của nền tảng **EduMap**. Đã được tối ưu sẵn sàng, chỉ cần cài đặt là chạy mượt mà ngay trên máy mới!

---

## ⚡ Hướng Dẫn Chạy Nhanh (Chỉ 2 Bước)

### Cách 1: Chạy bằng 1-Click (Dành cho Windows)
Chỉ cần nhấp đúp chuột vào file:
👉 **`start.bat`** (Hệ thống sẽ tự động cài `npm install` nếu chưa có và khởi động web ở `http://localhost:3000`).

---

### Cách 2: Chạy bằng dòng lệnh Terminal / PowerShell

```bash
# 1. Cài đặt thư viện dependencies
npm install

# 2. Khởi động môi trường phát triển
npm run dev
```

Mở trình duyệt truy cập: **`http://localhost:3000`**

---

## 🌐 Cấu Hình Kết Nối Backend

Trong file `.env.local` đã được cấu hình sẵn:
```env
BACKEND_URL=https://tancse2005-edumap.hf.space
```
* **Ưu điểm lớn:** Bạn **KHÔNG CẦN** phải cài đặt PostgreSQL, Redis, NestJS hay Python AI-service nặng nề trên máy. Mọi API (bản đồ 184 điểm trường, AI Chat, lộ trình nghề nghiệp...) sẽ tự động kết nối qua Backend Cloud của EduMap trên Hugging Face Spaces!
* Nếu bạn có chạy Backend NestJS trên máy local (cổng 3000): Hãy đổi thành `BACKEND_URL=http://127.0.0.1:3000` và đổi cổng frontend sang cổng khác ví dụ `npm run dev -- -p 3001`.

---

## 🛠️ Công Nghệ Sử Dụng

* **Framework:** Next.js 14 (App Router)
* **Ngôn ngữ:** TypeScript
* **Styling & UI:** Tailwind CSS, Lucide Icons, Magic UI (Dock, BentoGrid, BorderBeam, ShimmerButton, TextAnimate)
* **Bản đồ:** Leaflet & React-Leaflet tương tác mượt mà
* **PWA:** Hỗ trợ hoạt động Offline & Cài đặt như App máy tính/điện thoại
* **Cơ sở dữ liệu cục bộ:** SQLite PWA cache (`public/edumap.db`)

---

## 📁 Các Phân Hệ Chính

* `/` — Trang chủ Landing Page (Phong cách Orvel SaaS hiện đại, bento grid, dark/light theme)
* `/map` — Bản đồ số giáo dục 184 điểm trường Biên Hòa, Đồng Nai
* `/ai-chat` — Trợ lý tư vấn tuyển sinh & học bổng AI RAG 24/7
* `/career` — Cổng hướng nghiệp, lộ trình STEM & cơ hội việc làm
* `/language-bridge` — Cầu nối ngôn ngữ: Đơn giản hóa kiến thức, dịch thuật thuật ngữ & đọc AI
* `/dashboard/impact` — Bảng đo lường tác động xã hội & người học tiếp cận
* `/profile` — Trang cá nhân tối ưu đa thiết bị (Mobile & Desktop)

