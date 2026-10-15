# EduMap — OWASP Top 10 (2021) Security Checklist

> Phiên bản tích hợp audit full-stack (FE Next.js / NestJS backend / FastAPI ai-service / Python crawlers / Docker).  
> **Status legend:** `FIXED` (đã sửa trong lượt này) · `LEFT` (giữ nguyên theo yêu cầu user — thuộc auth) · `TODO` (chưa xử lý) · `INFO`.  
> Baseline đã chạy: `npx tsc --noEmit` (FE=0, backend=0), `docker compose config --quiet` (PASS).

## A01 — Broken Access Control
| # | Risk | Status | Anchor | Fix |
|---|------|--------|--------|-----|
| 1 | Client gửi `role` khi Google OAuth → tự gán `admin`/`moderator` | LEFT | `auth/controller.ts:26,52-57`; `auth.service.ts:113,135-138,154` | Bỏ `role` khỏi body Google login; hardcode STUDENT. |
| 2 | Client gửi `role` khi `/auth/register` → tự gán quyền | LEFT | `auth/controller.ts:117`; `dto/register.dto.ts:17-18`; `auth.service.ts:68,84` | Bỏ `role` khỏi RegisterDto; hardcode `role_id=11`. |
| 3 | `/crawler/*` (5 endpoint) không có guard — chỉ `import` JwtAuthGuard/RolesGuard mà **không áp dụng** `@UseGuards` | LEFT | `crawler/controller.ts:1-52` | Thêm `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(ADMIN, MODERATOR)` ở class. |

## A02 — Cryptographic Failures
| # | Risk | Status | Anchor | Fix |
|---|------|--------|--------|-----|
| 4 | JWT_SECRET fallback `'edumap-default-secret-key-change-in-production'` | LEFT | `jwt.strategy.ts:11`; `auth.module.ts:20` | Fail-fast nếu env không set; bỏ default. |
| 5 | JWT access/refresh token lưu trong `localStorage` (XSS-exploitable) | LEFT | `frontend/src/services/auth.service.ts:65-66,109,123,177,363` | Chuyển httpOnly, Secure, SameSite=Strict cookies. |
| 6 | `JWT_EXPIRES_IN=7d` (quá dài) | LEFT | `.env:11 ` (7d); `auth.module.ts:21` | Giảm access token về 15–30m, dùng refresh token xoay. |

## A03 — Injection
(chưa audit qua từng query; TypeORM parameterized mặc định — **kiểm tra thủ công** `getRepository().findOne({where})` patterns nếu thêm raw SQL.)

## A04 — Insecure Design
| # | Risk | Status | Anchor | Fix |
|---|------|--------|--------|-----|
| 7 | `role_id` hardcode trong getter/setter thay vì FK tới bảng roles; mapping trùng & thiếu | TODO | `user.entity.ts:40-85` | Dùng `@ManyToOne` tới `Role` entity. |
| 8 | `ThrottlerModule` 1 limit toàn cục (100/min) — docs gốc ghi lại limit giả | FIXED | `main.ts:71-74`; `app.module.ts:87` | Docs đã đúng thực tế; cài `@Throttle()` per-controller nếu cần. |

## A05 — Security Misconfiguration
| # | Risk | Status | Anchor | Fix |
|---|------|--------|--------|-----|
| 9 | `app.enableCors()` không tham số → `origin: '*'` | LEFT | `main.ts:31` | Giới hạn origin = `FRONTEND_URL`. |
| 10 | Swagger `/api/docs` mở ở mọi env, rò rỉ scheme auth | LEFT | `main.ts:112-113` | Bật dev-only hoặc thêm guard. |
| 11 | `BullModule` hardcode `port: 6379` bỏ qua `REDIS_PORT` | FIXED | `app.module.ts:84-88` | Dùng `Number(process.env.REDIS_PORT) || 6379`. |
| 12 | `DB_SYNC=true` (TypeORM synchronize) — rủ drop/cột ở prod | LEFT/TODO | `.env:10`; `app.module.ts:102` | `DB_SYNC=false` ở prod; dùng migration. |
| 13 | Default `DB_PASSWORD='password123'` nếu env thiếu | LEFT | `app.module.ts:95` | Fail-fast nếu `DB_PASSWORD` rỗng. |
| 14 | ai-service published ra `0.0.0.0:8002` (chưa auth) | FIXED* | `docker-compose.override.yml:102-118` | Đã bỏ `ports`; nội bộ vẫn qua `http://ai-service:8000`. *Chờ auth layer. |

## A06 — Vulnerable Components
| # | Risk | Status | Anchor | Fix |
|---|------|--------|--------|-----|
| 15 | `ai-service/requirements.txt` không pin version | TODO | `ai-service/requirements.txt:1-12` | Pin tất cả (fastapi==…, uvicorn==…, chromadb==…, …). |

## A07 — Identification & Authentication Failures
| # | Risk | Status | Anchor | Fix |
|---|------|--------|--------|-----|
| 16 | `/auth/dev-login` không có guard `NODE_ENV` | LEFT | `auth.controller.ts:66-95` | `if (NODE_ENV !== 'development') throw`. |
| 17 | `/auth/refresh` không xác thực `refreshToken` (chỉ kiểm tra user tồn tại) | LEFT | `auth.controller.ts:163-170`; `auth.service.ts:253-261` | So sánh hash với `refreshTokenHash`. |
| 18 | Không kiểm tra độ mạnh mật khẩu | LEFT | `dto/register.dto.ts:13-15` | `@MinLength(12)` + complexity. |
| 19 | `/auth/register` leak email tồn tại | TODO | `auth.service.ts:71-72` | Trả message chung. |

## A08 — Software & Data Integrity Failures
| # | Risk | Status | Anchor | Fix |
|---|------|--------|--------|-----|
| 20 | ai-service load router động with try/except silent-fail → endpoint mất mà app vẫn lên | TODO | `ai-service/main.py:46-63` | Fail fast nếu router thiết yếu lỗi. |

## A09 — Security Logging & Monitoring Failures
| # | Risk | Status | Anchor | Fix |
|------|--------|--------|--------|-----|
| 21 | Backend có Sentry (tốt) nhưng không có structured log correlation ID | TODO | `common/interceptors/logging.interceptor.ts` | Thêm `x-request-id` vào mỗi log. |
| 22 | Các endpoint crawler không log security event khi triggered | TODO | `crawler.controller.ts` | Log người trigger + params. |

## A10 — Server-Side Request Forgery (SSRF)
| # | Risk | Status | Anchor | Fix |
|---|------|--------|--------|-----|
| 23 | Image optimizer `hostname: '**'` — scan IP nội bộ | LEFT | `next.config.js:61` | Giới hạn hostname về allowlist. |
| 24 | Crawler gọi Overpass API (external) — kiểm tra redirect tới private IP | TODO | `crawlers/overpass_crawler.py` | Block redirect tới RFC1918. |

## ✅ Verification commands
```bash
# FE type-check
(cd frontend && npx --no-install tsc --noEmit)            # =0

# Backend type-check
(cd backend && npx --no-install tsc --noEmit)            # =0

# Compose valid
docker compose config --quiet                              # =0

# UI banned-token scan (phải trống)
grep -rEn 'images\.unsplash|blur-\[(80|100)px\]|opacity-5([^0-9]|$)|font-black|font-extrabold|text-5xl|rounded-3xl|shadow-xl|shadow-2xl|backdrop-blur(xl|md)|py-20' frontend/app/

# DB env truth (không match claim sai)
grep -E '^DB_PORT=|^REDIS_PORT=|^DB_SYNC=' .env             # = 5432 / 6379 / true
```

## ❌ Claims REJECTED (verified false during audit)
- **"`DB_PORT=5433, backend nối tới cổng ngoài 5433"`** — sai. `.env` = `DB_PORT=5432`; `app.module.ts:93` + `data-source.ts:11` dùng `5432` (đúng cổng nội bộ container). Docker mapping `5433:5432` chỉ là host-side.
- **"`/api/dashboard/overview` → 404`** — sai. `DashboardController` (`dashboard.controller.ts:9`) có `@Get('overview')`/`@Get('insight')`/`@Get('stats')`, đều `@UseGuards(JwtAuthGuard)`; FE `dashboard.service.ts` gửi Bearer token → đã matching.
