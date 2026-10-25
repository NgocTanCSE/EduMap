# HF Spaces — Kế hoạch triển khai 8 cải tiến

> **Status**: Phương án triển khai trên HF Spaces (single Docker container via supervisord)
> **Ngày**: 2026-10-25
> **Dựa trên**: `/home/ngoctan/Desktop/cải thiện edumap.md` + `IMPROVEMENT_PLAN.md`

---

## Kiến trúc HF Spaces hiện tại

| Service | Port | Tech | Storage |
|---------|------|------|---------|
| Frontend | 7680 (public) | Next.js 14 (SSR) | Static `/app/frontend/public/edumap.db` |
| Backend | 3000 (internal) | NestJS 10 | SQLite (baked into Docker, read-write at runtime) |
| AI Service | 8000 (internal) | FastAPI + uvicorn | ChromaDB in-memory (`/tmp/chroma_db`), NumPy |
| Job Crawler | — | Python stdlib | SQLite |

**HF Spaces secrets** (set via UI → Settings → Secrets, NOT in repo):
```
JWT_SECRET, GOOGLE_CLIENT_ID, OPENROUTER_API_KEY, OPENROUTER_MODEL,
GEMINI_API_KEY, NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN, HF_TOKEN,
ORS_API_KEY, ADZUNA_APP_ID, ADZUNA_APP_KEY
```

---

## HF Spaces constraints (đã xác định)

| Constraint | Impact | Workaround |
|-----------|--------|------------|
| Single container, supervisord | Cannot run separate services (Redis, OSRM, Postgres) | In-memory cache, ORS API, SQLite |
| CPU: cpu-basic (1 vCPU, limited) | Slow inference | Prefer lightweight models, caching |
| IPv6 blackhole | urllib/requests timeout | `curl --ipv4 --insecure` (đã fix) |
| Cloudflare TLS blocked | Cannot use Cloudflare Workers AI | Skip, fallback to OpenRouter/Gemini/HF |
| ChromaDB ephemeral | Vector DB wiped on restart | Seed at startup (`seed_vector_db.py`) |
| No Redis | Cache + Socket.IO adapter | In-memory LRU (NestJS `cache-manager`), in-memory socket adapter (đã implement) |
| No OSRM | Local routing server unavailable | Use ORS API (`ORS_API_KEY`) |
| Filesystem read-only except `/tmp`, `/app/uploads` | Cannot persist new data | Use `/app/uploads` for uploads, SQLite write OK at `/app/frontend/public/edumap.db` |

---

## Phương án triển khai từng tính năng

### 1. Dự đoán nghề nghiệp — Semantic Matching (🔴 Cao)

**Hiện trạng**: Career `/career/roadmap` dựa vào keyword matching + template lộ trình cứng nhắc.

**Phương án**:
- **Backend**: Sửa `career.service.ts` — thay `if-else` keyword matching bằng **ChromaDB vector search**.
- **AI Service**: Tạo endpoint mới `POST /api/ai/career/semantic-match` trong `router/career.py`:
  - Nhận `interest_text` (hoobestly, môn học, sở thích)
  - Embed bằng Gemini/Cloudflare (vector_store.get_embedding)
  - Query ChromaDB collection `careers` (được seed từ `career.json`/`jobs.db`)
  - Trả về top-5 career matches + confidence score
- **Seed data**: Cập nhật `seed_vector_db.py` để seed collection `careers` với dữ liệu ngành nghề (từ Adzuna/ITviec).
- **Frontend**: Thay `app/career/quiz/page.tsx` (đã xóa) bằng `app/career/semantic/page.tsx` — giao diện nhập sở thích, gọi API semantic-match → hiển thị career cards → click → tạo learning-path.

**HF Spaces considerations**:
- ChromaDB khởi tạo trong bộ nhớ, seed tại startup (~5-10s).
- Query mỗi request: ~2-3s (OpenRouter không cần thiết — chỉ dùng embedding + vector search).
- Cache kết quả semantic match trong NestJS in-memory cache (TTL 300s) để giảm tải.

✅ **Triển khai**: 2 files backend (`career.service.ts`, `career.py`), 1 file frontend (`semantic/page.tsx`), cập nhật `seed_vector_db.py`.

---

### 2. Xu hưễng thị trường lao động — Adzuna (🟡 Trung)

**Hiện trạng**: Backend có Adzuna service nhưng `ADZUNA_APP_ID/KEY` chưa được cấu hình trên HF Spaces → fallback SQLite.

**Phương án**:
- **Set secrets trên HF Spaces UI**: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY=vn`.
- Backend `adzuna.service.ts` gọi Adzuna API với retry + cache (TTL 3600s).
- Frontend: Thêm tab "Xu hưởng việc làm" trong trang career — hiển thị salary trends, demand trends, growth rate.

**HF Spaces considerations**:
- Adzuna API call từ backend (port 3000, internal) — kết nối egress bình thường.
- Cache kết quả để tránh gọi lại liên tục (Adzuna giới hạn 5000 requests/tháng cho free tier).
- Nếu không có key → hiển thị thông báo "dữ liệu mẫu" từ SQLite (đã có fallback).

✅ **Triển khai**: Set secrets trên HF UI, cập nhật frontend component.

---

### 3. Dự báo tăng trưởng giáo dục — Time-series (🟢 Thấp)

**Hiện trạng**: Chưa có. Cần Prophet hoặc ARIMA.

**Phương án**:
- **Thêm `statsmodels` vào `ai-service/requirements.txt`** (nhẹ hơn Prophet, không cần `cmdstanpy` dependencies).
- Tạo router mới `router/forecast.py` với endpoint `POST /api/ai/forecast/education-growth`:
  - Input: `career_keywords`, `years_ahead`
  - Fetch Adzuna time-series data (monthly job count từ Adzuna)
  - Fit ARIMA(p,d,q) bằng statsmodels
  - Trả về forecast JSON: `[{year: 2026, jobs: 15000, growth: 0.05}, ...]`
- **Frontend**: Chart trong career page — biểu đồ forecast growth.

**HF Spaces considerations**:
- ARIMA fit nhanh (~1-2s) trên CPU — chấp nhận được.
- statsmodels ~30MB pip install — tăng build time ~1-2 phút.
- Cache forecast kết quả (TTL 86400s = 24h).

✅ **Triển khai**: Thêm `statsmodels` to requirements.txt, tạo `router/forecast.py`, frontend component.

---

### 4. Chatbot RAG — SSE + memory (🟡 Trung)

**Hiện trạng**: `ai-chat/page.tsx` gọi `/api/ai/chat` đồng bộ (non-streaming). Memory lưu trong conversation state (client-side).

**Phương án**:
- **Backend (FastAPI)**: Sửa `chat.py` thêm endpoint mới `POST /api/ai/chat/stream`:
  - Dùng `curl --ipv4 --insecure` gọi OpenRouter streaming endpoint
  - Trả về `text/event-stream` (SSE)
  - Lưu conversation vào SQLite (`chat_sessions` table) — session_id từ JWT user_id
- **BFF (Next.js route)**: `app/api/ai/chat/stream/route.ts` — proxy SSE từ AI service sang frontend.
- **Frontend**: Thay `fetch` bằng `EventSource` hoặc `fetch` + `ReadableStream` để render từng chunk.

**HF Spaces considerations**:
- SSE qua proxy Next.js BFF — cần cấu hình `route.ts` với `experimental.strictInterop` và headers `Content-Type: text/event-stream`.
- Cursor timeout của Vercel/Next.js dev server có thể chặn kết nối SSE lâu — cần set `maxDuration` (nếu dùng Edge Runtime) hoặc giữ ở Node.js runtime.
- Memory: SQLite `chat_sessions` table đã có trong schema → chỉ cần query.
- OpenRouter streaming: cần verify token streaming works via curl on HF Spaces.

✅ **Triển khai**: `router/chat.py` streaming endpoint, `app/api/ai/chat/stream/route.ts`, `app/ai-chat/page.tsx`.

---

### 5. Auto-embed khi thêm sách (🟡 Trung)

**Hiện trạng**: Books crawl từ OpenLibrary → lưu SQLite. ChromaDB chỉ seed 1 lần tại startup.

**Phương án**:
- **Backend**: Sửa `library.service.ts` — mỗi khi thêm sách mới vào SQLite, gọi `POST /api/ai/embed` (FastAPI endpoint) để embed + upsert vào ChromaDB.
- **AI Service**: Endpoint `POST /api/ai/embed` trong `router/library.py`:
  - Nhận list of book records: `[{id, title, authors, description, categories}]`
  - Embed bằng Gemini/Cloudflare
  - Upsert vào ChromaDB collection `books`
- **Trigger**: Khi crawler chạy (daily 02:00), sau khi insert sách mới → gọi batch embed.

**HF Spaces considerations**:
- Backend → AI service gọi nội bộ (`http://127.0.0.1:8000/api/ai/embed`) — không qua internet, an toàn.
- ChromaDB in-memory → mỗi restart cần re-embed. Nhưng crawl chỉ chạy 1 lần/ngày, seed_vector_db chạy tại startup → OK.
- Batch embed 100 sách: ~30-60s trên CPU → chạy trong background (async, không block crawler).

✅ **Triển khai**: Endpoint FastAPI mới, hook trong `library.service.ts`, cập nhật `seed_vector_db.py`.

---

### 6. Mentor/scholarship pre-filter (🟡 Trung)

**Hiện trạng**: AI gợi ý mentor bằng cách gửi toàn bộ mentor list vào prompt (dài, tốn token).

**Phương án**:
- **Backend**: `career.service.ts` — thêm SQL WHERE filter trước khi gửi prompt:
  - Filter: `specialty LIKE '%career_keyword%'`, `rating_avg > 3.0`, `is_verified = true`
  - Limit 10 mentors → gửi vào prompt (thay vì 100+).
- **Frontend**: Thêm filter UI (specialty dropdown, rating slider).

**HF Spaces considerations**:
- SQLite query nhanh (<10ms) — không ảnh hưởng.
- Giảm token input → giảm latency OpenRouter + chi phí.
- Cache mentor list theo specialty (TTL 600s).

✅ **Triển khai**: Sửa `career.service.ts`, frontend filter component.

---

### 7. GeoAI → GeoJSON (🟡 Trung)

**Hiện trạng**: `analyze_geo_density` trả về dạng dict/JSON tùy chỉnh, frontend dùng Leaflet map.

**Phương án**:
- **AI Service**: Sửa `models/geo_models.py` + `llm_service.analyze_geo_density()` — trả về GeoJSON FeatureCollection:
  ```json
  {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": { "density": 0.85, "career": "Software Engineer" },
        "geometry": { "type": "Point", "coordinates": [106.6602, 10.7626] }
      }
    ]
  }
  ```
- **Frontend**: `app/career/geo/page.tsx` — parse GeoJSON → Leaflet markers/heatmap.

**HF Spaces considerations**:
- GeoJSON format chuẩn — frontend Leaflet hỗ trợ sẵn `L.geoJSON()`.
- Output nhỏ gọn → không ảnh hưởng latency.

✅ **Triển khai**: Sửa `llm_service.py` return format, `geo.py` endpoint, frontend.

---

### 8. Vẽ tuyến đường trên bản đồ — OSRM → ORS (🔴 Cao)

**Hiện trạng**: `routing.service.ts` dùng OSRM (`OSRM_URL` hoặc ORS fallback). `OSRM_URL` trên HF Spaces bị sai (`http://127.0.0.1:8000`).

**Phương án**:
- **Sửa `start.sh`**: Thêm `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_MODEL`, `NVIDIA_CHAT_MODEL` vào `SECRET_VARS` list. *(backup recovery — env vars thực tế được kế thừa qua supervisord không có `environment=`)*
- **Backend**: `routing.service.ts` — ưu tiên ORS (OpenRouteService) vì OSRM không chạy trên HF Spaces:
  - Set `ORS_URL=https://api.openrouteservice.org` (default) + `ORS_API_KEY` (secret).
  - Endpoint: `POST /api/map/route` → gọi ORS API → trả về GeoJSON LineString.
  - Fallback: nếu không có key → trả về straight line (geometry nhọn).
- **Frontend**: `app/map/page.tsx` — dùng Mapbox GL JS để render ORS route polyline.

**HF Spaces considerations**:
- ORS API: 2,000 requests/ngày (free tier) — đủ cho demo.
- ORS_API_KEY: set qua HF Spaces → Settings → Secrets.
- OSRM_URL hiện tại (`http://127.0.0.1:8000`) sai → sửa thành không dùng (ưu tiên ORS trực tiếp).

✅ **Triển khai**: Set `ORS_API_KEY` trên HF UI, sửa `routing.service.ts` + `start.sh`, frontend map.

---

## Roadmap triển khai (phases)

### Phase 1 — Critical (1-2 ngày)
| # | Tính năng | Effort | Files |
|---|----------|--------|-------|
| 8 | Fix routing (ORS) | 30p | `routing.service.ts`, `start.sh`, `Dockerfile` |
| 1 | Semantic career matching | 3h | `career.py`, `career.service.ts`, `seed_vector_db.py`, frontend `semantic/page.tsx` |
| 4 | Chat SSE streaming | 4h | `chat.py:stream`, `chat/stream/route.ts`, `page.tsx` |

### Phase 2 — Medium (3-5 ngày)
| # | Tính năng | Effort | Files |
|---|----------|--------|-------|
| 2 | Adzuna job trends | 2h | Set secrets, frontend component |
| 5 | Auto-embed | 3h | `library.py:embed`, `library.service.ts`, seed update |
| 6 | Mentor pre-filter | 2h | `career.service.ts`, frontend filter |
| 7 | GeoAI → GeoJSON | 2h | `geo_models.py`, `geo.py`, `llm_service.py`, frontend |

### Phase 3 — Low (4-7 ngày)
| # | Tính năng | Effort | Files |
|---|----------|--------|-------|
| 3 | Time-series forecast | 4h | `requirements.txt`, `router/forecast.py`, frontend chart |

---

## Deployment checklist (HF Spaces)

1. ✅ Code changes committed (3 commits)
2. 🔄 **Build & test locally**: `docker compose up --build` → verify all 8 endpoints
3. 🔄 **Update `ai-service/requirements.txt`**: thêm `statsmodels` (Phase 3)
4. 🔄 **Update `start.sh`**: thêm `OPENROUTER_API_KEY`, `NVIDIA_API_KEY` vào `SECRET_VARS`
5. 🔄 **Push to GitHub**: `git push origin main` → GitHub Actions `deploy-hf.yml` tự động sync
6. ✅ **Set HF Spaces secrets** (qua UI):
   - `OPENROUTER_API_KEY` (primary LLM ✅)
   - `ORS_API_KEY` (routing)
   - `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (job trends)
   - `GEMINI_API_KEY` (embeddings fallback)
7. 🔄 **Verify on HF Spaces**:
   - `POST /api/ai/career/semantic-match` → 200, career matches
   - `GET /api/ai/chat/stream` → SSE streaming
   - `GET /career/quiz` → 404
   - `POST /api/map/route` → GeoJSON route
   - `GET /api/ai/geo/density` → GeoJSON FeatureCollection

### Lệnh deploy

```bash
# 1. Commit all changes
git add -A && git commit -m "feat: 8 improvements for HF Spaces deployment"

# 2. Push — GitHub Actions sẽ auto-deploy lên HF Spaces
git push origin main

# 3. Hoặc deploy trực tiếp lên HF (nếu có HF_TOKEN)
git push hf main
```

> ⚠️ **Không thể tự động deploy** trong session này — không có `HF_TOKEN` hay GitHub credentials.
> User cần tự thực hiện `git push origin main` để CI/CD deploy.
