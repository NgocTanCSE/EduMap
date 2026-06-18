# TODO – Dự án EduMap

## ✅ Phase 1 – Backend core (Crawler, Auth, AI) – Hoàn thành
- Đã xóa mọi TODO/FIXME trong các module `crawler`, `auth`, `ai`.
- Đảm bảo mọi service có guard và logging.

## 📦 Phase 2 – Backend (các module còn lại)
- **Đã thêm** unit‑test cho `BusinessService` (checkout validation).
- Các spec file đã tồn tại cho `survey`, `share`, `community`, `certificate`, … không cần thay đổi.
- Kiểm tra lại `share.service.spec.ts`, `survey.service.spec.ts` – đã có đầy đủ test.
- Các endpoint đều có `JwtAuthGuard`/`RolesGuard` phù hợp, không còn TODO.

## 🚀 Phase 3 – Front‑end (cần thực hiện)
- Hoàn thiện 13 page còn là stub (có layout nhưng chưa gọi API):
  - `career/quiz`, `career/roadmap`, `internships/[id]`, `library`, `map`, `mentor/[id]`, `opportunities/[id]`, `scholarships`, `stem`, `summer`, `survey/[id]`, `volunteer`, `wifi` …
- Thêm loading, error UI cho các trang dùng `fetch`.
- Viết unit‑test (Jest/React Testing Library) cho các component UI chính (`Button`, `Input`, `Modal`, `Pagination`).

## 📚 Phase 4 – API Documentation & Contracts
- Kiểm tra Swagger (`@ApiOperation`, `@ApiResponse`) cho mọi controller.
- Tạo Postman collection `EduMap API` và tích hợp vào CI.

## 🔐 Phase 5 – Bảo mật & Hiệu năng
- Thêm middleware `helmet`, `cors`, rate‑limiting.
- Chạy `npm audit` và sửa các vulnerability còn tồn tại.
- Kiểm thử stress cho các endpoint trọng điểm (donate, checkout, AI).

---
**Ghi chú:** Nếu muốn tiếp tục với bất kỳ phase nào, hãy chỉ định rõ (ví dụ: "tiếp Phase 3 – hoàn thiện các trang UI"), tôi sẽ thực hiện thay đổi tương ứng.
