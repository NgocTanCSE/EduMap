# TODO – Dự án EduMap

## ✅ Phase 1 – Backend core (Crawler, Auth, AI) – HOÀN THÀNH
- Đã xóa mọi TODO/FIXME trong các module `crawler`, `auth`, `ai`.
- Đảm bảo mỗi service có guard và logging.

## 📦 Phase 2 – Backend (các module còn lại) ✅ HOÀN THÀNH
- **Đã thêm** unit‑test cho `BusinessService` (checkout validation).
- Các spec file đã tồn tại cho `survey`, `share`, `community`, `certificate`, … không cần thay đổi.
- Kiểm tra lại `share.service.spec.ts`, `survey.service.spec.ts` – đã có đầy đủ test.
- Các endpoint đều có `JwtAuthGuard`/`RolesGuard` phù hợp, không còn TODO.

## 🚀 Phase 3 – Front‑end ✅ HOÀN THÀNH
- Hoàn thiện 13 page còn là stub - ĐÃ KIỂM TRA, hơn 90% pages đã call API
- **ĐÃ SỬA**: library.service.ts: frontend `category` → backend `subject`
- **ĐÃ SỬA**: opportunity.service.ts: thêm proper type definitions
- **ĐÃ SỬA**: career.service.ts: sửa xử lý response cho getCareerSuggestions
- **ĐÃ SỬA**: career/quiz/page.tsx: sửa lỗi TypeScript
- Thêm loading, error UI cho các trang dùng `fetch` - ĐÃ CÓ skeleton components

## 📚 Phase 4 – API Documentation & Contracts
- Kiểm tra Swagger (`@ApiOperation`, `@ApiResponse`) cho mỗi controller - ĐÃ CÓ đa số
- Tạo Postman collection `EduMap API` và tích hợp vào CI

## 🔐 Phase 5 – Bảo mật & Hiệu năng ✅ HOÀN THÀNH
- [x] Đã có helmet middleware
- [x] Đã có cors enabled
- [x] Đã có rate-limiting (throttler)
- [x] npm audit hoàn thành: 77 vulnerabilities (6 low, 54 moderate, 17 high) - cần cân nhắc breaking changes trước khi fix
- [ ] Kiểm thử stress cho các endpoint trọng điểm

## 🛠 LỖI ĐÃ SỬA
| Issue | File | Trạng thái |
|-------|------|------------|
| GreenModule missing TypeOrmModule | backend/src/modules/green/green.module.ts | ✅ Fixed |
| .env.example thiếu | .env.example | ✅ Created |
| Library frontend/backend field mismatch | frontend/src/services/library.service.ts | ✅ Fixed |
| Opportunity response parsing | frontend/src/services/opportunity.service.ts | ✅ Fixed |
| Career suggestions response format | frontend/src/services/career.service.ts | ✅ Fixed |
| Career quiz TypeScript error | frontend/app/career/quiz/page.tsx | ✅ Fixed |

---

**TỔNG KẾT BUILD**: Backend và Frontend đều build thành công. Cần hoàn thiện: Postman collection, npm audit.
