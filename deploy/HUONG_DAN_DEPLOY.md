# Hướng dẫn deploy EduMap — từng bước, không cần đoán

Mục tiêu: **Vercel** chạy web Next.js, **Render** chạy backend Rust + ai-service
FastAPI, **Supabase** giữ Postgres. Mỗi lần push code lên `main`, GitHub Actions
ra lệnh cho Render build lại.

Đọc hết 15 phút rồi làm theo. Tổng thời gian lần đầu ~45–60 phút (chủ yếu là chờ
Render build).

---

## 0. Hiểu 4 chỗ đứng trước khi làm

```
Bạn push code  ──►  GitHub (chứa code + render.yaml + .github/workflows)
                        │
                        ├─► GitHub Actions: chỉ KIỂM TRA (cargo check, pytest, tsc)
                        │
                        └─► GitHub Actions: render-deploy.yml  ──► RA LỆNH deploy
                                                                     │
Vercel (web + BFF /api)  ◄── gọi HTTP ──  Render: edumap-api (Rust, 3000)  ◄── nội bộ ──  Render: edumap-ai (FastAPI, 8000)
                                                │                                              │
                                                └──────────── Supabase Postgres ───────────────┘
```

- **Render build**, không phải máy bạn, không phải GitHub build docker.
- GitHub Actions chỉ gọi API của Render (`render deploys create`). Nếu chưa có
  secret `RENDER_API_KEY` thì nó không làm gì được.
- Biến môi trường **không nằm trong repo**. Chúng nằm ở 2 nơi: dashboard Render
  (cho BE + AI) và dashboard Vercel (cho FE). Các file `deploy/*.env.example`
  chỉ là tờ giấy nháp để bạn biết cần nhập key nào.

---

## 1. Chuẩn bị: gom đủ 6 giá trị (10 phút)

Ghi ra notepad, đây là những thứ sẽ dán vào Render:

| # | Tên | Lấy ở đâu |
|---|---|---|
| 1 | `DB_HOST` | Supabase → Project Settings → Database → **Connection pooling** → host dạng `aws-0-...pooler.supabase.com` |
| 2 | `DB_USERNAME` | cùng chỗ, dạng `postgres.<project-ref>` |
| 3 | `DB_PASSWORD` | mật khẩu bạn đặt khi tạo Supabase. **Không nhớ thì**: Supabase → Database → Reset database password |
| 4 | `JWT_SECRET` | giá trị **đang có trên Vercel** (Vercel → Settings → Environment Variables → `JWT_SECRET`). Nếu Vercel không cho xem lại (secret là write-only) thì tạo chuỗi mới `openssl rand -hex 32` và **cập nhật lại cả Vercel lẫn Render cho giống nhau** |
| 5 | `DEEPSEEK_API_KEY` | platform.deepseek.com → API keys (nếu có) |
| 6 | `GEMINI_API_KEY` | aistudio.google.com → API key (nếu có) |

> ⚠️ Quan trọng: `JWT_SECRET` ở Vercel và ở Render **phải giống hệt nhau**. Lệch
> một ký tự là mọi API cần đăng nhập trả 401.

> ⚠️ Đừng xoá biến trên Vercel trước khi đã chép giá trị sang Render. Secret
> trên Vercel thường **không xem lại được** sau khi tạo.

---

## 2. Tạo 2 service trên Render (chỉ làm 1 lần)

1. Mở <https://dashboard.render.com> → đăng nhập bằng GitHub.
2. Bấm nút **New** (góc trên phải) → chọn **Blueprint**.
3. Danh sách repo hiện ra → tìm repo `EduMap` → bấm **Connect**.
   (Nếu chưa thấy repo: bấm *Configure account* / cấp quyền cho Render đọc repo.)
4. Form hiện ra:
   - **Blueprint Name**: `edumap`
   - **Branch**: `main`
   - **Blueprint Path**: để trống (Render tự tìm `render.yaml` ở gốc repo)
5. Render đọc `render.yaml` và hiện danh sách **2 service** cần tạo:
   `edumap-api` và `edumap-ai` → bấm **Apply** / **Deploy Blueprint**.
6. Chờ ~30 giây, 2 service xuất hiện trong dashboard. **Lần build này sẽ FAIL**
   vì chưa có biến môi trường — bình thường, làm tiếp bước 3.

> Nếu bạn đã có 2 service này từ trước thì **bỏ qua bước 2**, sang bước 3.

---

## 3. Nhập biến cho `edumap-api` (Rust)

1. Dashboard Render → bấm vào service **edumap-api**.
2. Menu trái → **Environment**.
3. Với mỗi dòng dưới đây: bấm **Add Environment Variable** → gõ **Key** và
   **Value** → **Save Changes**.

| Key | Value | Bắt buộc? |
|---|---|---|
| `BACKEND_PORT` | `3000` | có (đã có sẵn từ render.yaml, kiểm tra lại) |
| `JWT_SECRET` | giá trị #4 ở bước 1 | **có** |
| `JWT_EXPIRES_IN` | `7d` | có sẵn |
| `ENABLE_DEV_LOGIN` | `true` | có sẵn |
| `DEV_USER_EMAIL` | `dev@edumap.vn` | có sẵn |
| `DB_TYPE` | `postgres` | có sẵn |
| `DB_SYNC` | `false` | có sẵn |
| `DB_HOST` | giá trị #1 | **có** |
| `DB_PORT` | `6543` | có sẵn |
| `DB_USERNAME` | giá trị #2 | **có** |
| `DB_PASSWORD` | giá trị #3 | **có** |
| `DB_DATABASE` | `postgres` | có sẵn |
| `AI_SERVICE_URL` | `http://edumap-ai:8000` | có sẵn — **giữ đúng dạng này** (tên service nội bộ, không phải URL https) |
| `ROUTING_SERVICE_URL` | `https://router.project-osrm.org` | có sẵn |
| `DEEPSEEK_API_KEY` | giá trị #5 | tuỳ chọn |
| `GEMINI_API_KEY` | giá trị #6 | tuỳ chọn |

Sau khi Save, Render tự deploy lại. Xem tab **Logs** — build Rust ~6–10 phút.
Thành công khi log có dòng kiểu `database pool connected` / `listening on 3000`.

Kiểm tra nhanh bằng trình duyệt:
<https://edumap-api.onrender.com/api/health> → phải trả về JSON.

---

## 4. Nhập biến cho `edumap-ai` (FastAPI)

1. Dashboard → service **edumap-ai** → **Environment**.
2. Nhập:

| Key | Value |
|---|---|
| `PORT` | `8000` (có sẵn) |
| `CHROMA_DB_PATH` | `/tmp/chroma_db` (có sẵn) |
| `AUTO_SCHEDULER_ENABLED` | `false` (có sẵn — free 512 MB, bật sẽ OOM) |
| `DB_TYPE` / `DB_SYNC` | `postgres` / `false` |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | **y hệt bước 3** |
| `DEEPSEEK_API_KEY` | #5 |
| `GEMINI_API_KEY` | #6 |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | nếu có (không có cũng chạy) |
| `TAVILY_API_KEY` | nếu có |
| `OWM_API_KEY` | nếu có |
| `GOOGLE_TTS_API_KEY` | nếu có |

Kiểm tra: <https://edumap-ai.onrender.com/health> → JSON `{"status":...}`.

---

## 5. Tắt Auto-Deploy (rất quan trọng, dễ bỏ qua)

Với **cả 2 service**:

1. Vào service → menu trái **Settings** → mục **Build & Deploy**.
2. Tìm **Auto-Deploy** → đặt **No / OFF**.
3. **Save Changes**.

Vì sao: nếu để ON, mỗi lần push GitHub sẽ có **2 deploy chạy cùng lúc** (Render
tự làm + GitHub Actions ra lệnh) → build đè nhau, service restart liên tục.

---

## 6. Lấy 3 giá trị cho GitHub (5 phút)

### a) `RENDER_API_KEY`
1. Dashboard Render → góc trên phải bấm avatar → **Account Settings**.
2. Menu trái **API Keys** → **Create API Key** → đặt tên `github-actions`.
3. Copy chuỗi `rkr_...` (chỉ hiện **1 lần**, lưu ngay).

### b) `RENDER_SERVICE_ID_API` và `RENDER_SERVICE_ID_AI`
1. Mở service `edumap-api` → nhìn **thanh địa chỉ trình duyệt**:
   `https://dashboard.render.com/web/srv-abc123xyz` → phần `srv-abc123xyz` chính
   là ID. Copy.
2. Làm y hệt với `edumap-ai`.

---

## 7. Nhập secrets vào GitHub

1. Mở repo trên GitHub → **Settings** (thanh trên cùng của repo).
2. Menu trái: **Secrets and variables** → **Actions**.
3. Tab **Secrets** → **New repository secret**, tạo lần lượt 3 cái:

| Name | Value |
|---|---|
| `RENDER_API_KEY` | `rkr_...` |
| `RENDER_SERVICE_ID_API` | `srv-...` (của edumap-api) |
| `RENDER_SERVICE_ID_AI` | `srv-...` (của edumap-ai) |

4. (Tuỳ chọn) Tab **Variables** → thêm 2 biến nếu tên miền Render của bạn khác
   mặc định (workflow dùng để smoke test):
   `RENDER_API_PUBLIC_URL=https://edumap-api.onrender.com`
   `RENDER_AI_PUBLIC_URL=https://edumap-ai.onrender.com`

---

## 8. Push code

Máy bạn (chỉ commit + push, **không** build gì):

```bash
cd /home/ngoctan/Downloads/EduMap
git status                        # xem file thay đổi
git add -A
git commit -m "ci: add Render deploy workflow + env sync"
git push origin main
```

---

## 9. Theo dõi kết quả trên GitHub

1. Mở repo → tab **Actions**.
2. Sẽ thấy 3 workflow chạy song song:
   - `Rust backend build + compile check` — chỉ kiểm tra code Rust.
   - `EduMap CI/CD` — pytest ai-service + `tsc` + build frontend.
   - `Deploy to Render` — **cái này mới thực sự deploy**.
3. Bấm vào `Deploy to Render` → bấm job **Deploy to Render (Rust + AI)** để xem
   từng bước:

| Step | Ý nghĩa | Thời gian |
|---|---|---|
| `Install the Render CLI` | tải CLI về runner | ~10 s |
| `Deploy api service (Rust)` | Render build lại backend | 6–12 phút |
| `Deploy ai service (FastAPI)` | Render build lại ai-service | 8–15 phút |
| `Smoke test (post-deploy)` | curl `/api/health` + `/health` tới khi 200 | 0–2 phút |
| `Dump recent logs on failure` | chỉ chạy khi fail, in 100 log cuối | — |

4. Dấu ✅ xanh = deploy xong. Nếu ❌ đỏ: mở step `Dump recent logs on failure`
   đọc log (nó in log của cả 2 service), sửa rồi push lại.

---

## 10. Cấu hình Vercel (chỉ 5 phút)

1. <https://vercel.com> → chọn project EduMap.
2. **Settings** → **Environment Variables**.
3. Thêm/sửa:

| Key | Value |
|---|---|
| `BACKEND_URL` | `https://edumap-api.onrender.com` |
| `AI_SERVICE_URL` | `https://edumap-ai.onrender.com` |
| `JWT_SECRET` | **giống hệt** `JWT_SECRET` của Render |
| `ENABLE_DEV_LOGIN` | `true` |
| `GOOGLE_CLIENT_ID` | client id Google (nếu dùng đăng nhập Google) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | cùng giá trị |
| `NEXT_PUBLIC_CARTO_API_KEY` | **CARTO API key**, lấy tại https://carto.com/basemaps/apikey/ (mỗi tháng được miễn phí 5 triệu request) |
| `NEXT_PUBLIC_USE_MOCK_API` | `false` |
| `NEXT_PUBLIC_TOASTS_ENABLED` | `true` (nếu muốn thấy toast) |
| `NEXT_PUBLIC_AI_API_URL` | `/api/ai` |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | tuỳ chọn |

4. **Xoá** các biến không dùng (nếu còn): `DB_TYPE`, `DB_HOST`, `DB_PORT`,
   `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SYNC`, `DEEPSEEK_API_KEY`,
   `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`, `TAVILY_API_KEY`,
   `CLOUDFLARE_*`, `OWM_API_KEY`, `GOOGLE_TTS_API_KEY`, `HF_TOKEN`,
   `ORS_API_KEY`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID`,
   `GOOGLE_AUTH_URI`, `GOOGLE_TOKEN_URI`, `GOOGLE_AUTH_PROVIDER_CERT_URL`.

   Lý do: các key AI/DB chỉ có tác dụng ở Render; để trên Vercel chỉ gây nhầm
   lẫn và tăng nguy cơ lộ.

### Bật bản đồ không label (CARTO dark_nolabels)

1. Lấy API key tại <https://carto.com/basemaps/apikey/> → **Basemaps API**.
2. Dán key vào `NEXT_PUBLIC_CARTO_API_KEY` trên Vercel (chọn cả Production +
   Preview).
3. **Redeploy** (`Deployments` → ⋯ → `Redeploy`) — Next.js nhúng env lúc build.

Nếu không set key → ứng dụng quay lại OpenStreetMap (tile miễn phí, có label).

5. Bấm **Deployments** → deployment mới nhất → **⋯** → **Redeploy**
   (bắt buộc — Next.js nhúng env lúc build).

---

## 11. Kiểm tra lần cuối

Trong terminal máy bạn:

```bash
# 1. Backend sống?
curl -s https://edumap-api.onrender.com/api/health

# 2. Có dữ liệu thật từ Supabase?
curl -s "https://edumap-api.onrender.com/api/map/pois?limit=3" | head -c 500

# 3. ai-service sống?
curl -s https://edumap-ai.onrender.com/health

# 4. BFF trên Vercel đi xuyên sang Render được? (thay <app> bằng tên thật)
curl -s -o /dev/null -w '%{http_code}\n' https://<app>.vercel.app/api/map/pois?limit=1
#   200 = OK; 404 = next.config rewrite/env chưa đúng; 502 = Render đang ngủ (chờ 60 s thử lại)
```

Trên web: mở `/map` (ghim trường phải hiện) → `/career` (có dữ liệu) →
`/ai-chat` (gửi 1 câu, AI trả lời).

---

## 12. Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| Workflow fail ngay ở `Deploy api service` với `SRV` trống | chưa thêm secret `RENDER_SERVICE_ID_API` | thêm đúng secret ở bước 7 |
| `401` / `403` ở step deploy | `RENDER_API_KEY` sai hoặc đã thu hồi | tạo key mới, cập nhật secret |
| `database pool connected` không xuất hiện | `DB_*` sai | dùng host **pooler** `...pooler.supabase.com`, port `6543` |
| Vào web, mọi API trả 401 | `JWT_SECRET` Vercel ≠ Render | đặt lại cùng một chuỗi ở cả 2 nơi, rồi Redeploy Vercel |
| Request đầu tiên chậm 30–60 s | Render free ngủ sau 15 phút | bình thường, chờ rồi tải lại |
| `502` lần đầu sau deploy | container đang boot | thử lại sau 30–60 s |
| ai-service OOM / restart liên tục | `AUTO_SCHEDULER_ENABLED=true` trên 512 MB | đặt `false` |
| Deploy chạy 2 lần mỗi push | Auto-Deploy trong Render vẫn ON | tắt ở bước 5 |
| Hết quota tháng | free tier = 750 h/tháng cho **tất cả** service; 2 service × 24/7 ≈ 1460 h | chỉ bật khi cần test, hoặc nâng plan |

---

## 13. Rollback (quay lại bản cũ)

Không cần revert code:

1. GitHub → tab **Actions** → chọn workflow **Deploy to Render**.
2. Bấm **Run workflow** (phải) → chọn branch/tag/commit cũ → **Run**.
3. Workflow sẽ deploy đúng commit bạn chọn.

Hoặc đơn giản hơn: mở Render dashboard → service → **Events** → chọn deployment
cũ → **Redeploy**.

---

## 14. Workflow file làm gì (để bạn đọc được khi cần)

`.github/workflows/render-deploy.yml`:

1. `Install the Render CLI` — tải `render` CLI vào máy ảo GitHub.
2. `Deploy api service (Rust)` — `render deploys create <srv-id> --wait --confirm
   --commit <sha>`: Render build đúng commit vừa push, chờ tới khi xong.
3. `Deploy ai service (FastAPI)` — y hệt cho service thứ 2.
4. `Smoke test (post-deploy)` — curl 2 endpoint `/health` tối đa 2 phút.
5. `Dump recent logs on failure` — nếu có bước fail, in 100 dòng log cuối của cả
   2 service ngay trong Actions (không phải mở Render).
6. `Summarize` — in bảng tóm tắt commit + URL vào phần Summary của run.

Muốn đổi tên service/URL thì sửa `render.yaml` (tên) và biến `RENDER_*_PUBLIC_URL`
(GitHub → Settings → Variables), không phải sửa code.
