# Kế Hoạch Toàn Diện — DNTU EduMap 20 Ý Tưởng AI

> **Nguồn**: `/home/ngoctan/Desktop/DNTU_EduMap_Y_Tuong_AI.md`  
> **Dự án**: EduMap — Vietnam Education & Career Map  
> **Môi trường chạy**: Hugging Face Spaces (single Docker container via supervisord)  
> **Môi trường local**: Chỉ dùng để **viết code, debug, test unit** — không chạy sản phẩm  
> **Ngày lập kế hoạch**: 2026-10-27  
> **Trạng thái**: Draft (chờ review)

---

## 0. Tổng quan dự án (đã tìm hiểu)

### 0.1 Kiến trúc hệ thống (HF Spaces mode)

```
HF Spaces Docker Container (port 7680 = PUBLIC PORT)
│
├─ supervisord (PID 1)               ← process manager
│   ├─ frontend     → Next.js 14      :7680   ← PUBLIC (web app + BFF)
│   ├─ backend      → NestJS 10       :3000   ← localhost (internal)
│   ├─ ai-service   → FastAPI+uvicorn  :8000   ← localhost (internal)
│   └─ crawler      → Python stdlib     —      ← daily job (best-effort)
│
├─ SQLite  (/app/frontend/public/edumap.db)  — 90+ tables, ~1.3MB, read-write
├─ ChromaDB (/tmp/chroma_db)                 — vector store (ephemeral, re-seed startup)
├─ LRU cache (in-process, NestJS cache-manager) — replaces Redis
└─ Filesystem (/tmp, /app/uploads)            — replaces MinIO
```

### 0.2 Chuyển đổi service (HF Spaces vs Docker Compose local)

| Service gốc (docker-compose) | Thay thế (HF Spaces) | Lý do |
|---|---|---|
| PostgreSQL 16 + PostGIS | **SQLite** | <1GB disk limit của HF Spaces; PostGIS binary quá lớn |
| Redis | **In-memory LRU cache** | Giảm process + RAM |
| OSRM local | **OpenRouteService API** (primary) + **public OSRM demo** (fallback) | Routing graph >1GB disk |
| MinIO | **Filesystem `/tmp` + `/app/uploads`** | HF Spaces không có S3 bucket |
| NGINX | **Removed** | Next.js BFF xử lý routing + reverse proxy |

### 0.3 Chuỗi provider AI (đã triển khai)

```
Text Generation:
  1. OpenRouter  (curl --ipv4 --insecure) ← PRIMARY
  2. NVIDIA NIM  (curl --ipv4 --insecure)
  3. Cloudflare Workers AI (curl)
  4. HF Inference API (requests)
  5. Template fallback (degraded content)

Embeddings (vector_store.py):
  1. OpenRouter  (/v1/embeddings, curl)
  2. Gemini      (embedContent, curl)  ← giữ nguyên cho embeddings
  3. Cloudflare  (Workers AI, urllib)
  4. HF Inference API (requests)
  5. NVIDIA NIM  (urllib)
```

### 0.4 Secrets & môi trường

| Loại | Nguồn | Ghi chú |
|---|---|---|
| Dockerfile ENV | Non-sensitive defaults | Model names, DB paths, URLs — committed to repo |
| HF Spaces Secrets | UI → Settings → Secrets | `JWT_SECRET`, `OPENROUTER_API_KEY`, `GOOGLE_CLIENT_ID`, etc. — **KHÔNG** commit |
| `start.sh` | Recover từ `/proc/1/environ` | HF Spaces secrets không tự động lan truyền qua supervisord → `environment=` directive; `start.sh` recovery từ PID 1 |

### 0.5 CI/CD flow

```
GitHub (main branch)
  → GitHub Actions (ci-cd.yml)
      → Build Docker image
      → Test (tsc, jest, Python pytest)
      → Push ghcr.io/ngoctancse/edumap-hf-spaces:latest
  → HF Spaces auto-rebuild from Dockerfile
  → (hoặc) đẩy trực tiếp qua HF Hub git remote (deploy-hf.sh)
```

### 0.6 Mapping tính năng hiện có → 20 ý tưởng

| Ý tưởng | Tên | Trạng thái hiện tại |
|---|---|---|
| #1 | AI Education Resource Optimizer (MCLP) | ❌ Chưa có |
| #2 | EduMap AI Agent (NL → GIS) | 🟡 Có chat RAG + session memory, chưa là agent tự động |
| #3 | AI Educational Gap Predictor | 🟡 Có `predictive.py` (Holt's), chưa spatial forecasting |
| #4 | Talk2Map (NL → GIS queries, Vietnamese) | ✅ Hoàn thành |
| #5 | AI Data Trust & Anomaly Detector | ❌ Chưa có |
| #6 | Missing Data Hunter | ❌ Chưa có |
| #7 | Edge AI Tutor (offline) | ❌ Chưa có |
| #8 | AI Knowledge Graph | 🟡 Có vector search (ChromaDB), chưa knowledge graph |
| #9 | ImpactMatch (need ↔ sponsor) | 🟡 Có mentor matching (3-layer), chưa sponsor matching |
| #10 | GeoVision AI (satellite imagery) | ❌ Chưa có |
| #11 | AI Climate Learning Guardian | ❌ Chưa có |
| #12 | SafeRoute AI | 🟡 Có route drawing (ORS→OSRM→Haversine), chưa weighted safe routing |
| #13 | AI Learning Space Recommender | 🚧 Đang xây dựng (T1-T4) — xem `tasks/learning-space-recommender-plan.md` |
| #14 | Opportunity Radar | 🟡 Có scholarship + career jobs, chưa NLP matching |
| #15 | Language Bridge AI | 🟡 → ✅ Hoàn thành | Simplify/tts/translate triển khai |
| #16 | Voice-to-Geo AI | ✅ |
| #17 | AI Question Gap Report | ❌ Chưa có |
| #18 | Resource Exchange AI | ✅ Hoàn thành |
| #19 | AI Impact Measurement | ✅ Hoàn thành |
| #20 | Active Learning for Field Survey | ✅ Hoàn thành |

---

## 1. Chiến lược deploy — HF Spaces (runtime) + Local (code-only) ✅

### 1.1 Nguyên tắc

**HF Spaces = nơi duy nhất chạy sản phẩm.** Toàn bộ 3 services (frontend :7680, backend :3000, ai-service :8000) chạy trong một container Docker do supervisord quản lý. Local chỉ dùng để:
- Viết code, debug, chạy unit tests
- Docker build local để kiểm tra trước khi push
- Docker Compose (full-stack với PostgreSQL + Redis + OSRM + MinIO) cho dev nâng cao

### 1.2 Secret management

| Secret | Thiết lập ở đâu | Ghi chú |
|---|---|---|
| `JWT_SECRET` | HF Spaces → Settings → Secrets | Bắt buộc |
| `GOOGLE_CLIENT_ID` | HF Spaces → Settings → Secrets | Bắt buộc cho OAuth |
| `OPENROUTER_API_KEY` | HF Spaces → Settings → Secrets | Primary LLM provider |
| `OPENROUTER_MODEL` | HF Spaces Secret (tùy chọn) | Default: `deepseek/deepseek-chat` |
| `GEMINI_API_KEY` | HF Spaces → Settings → Secrets | Embeddings + fallback |
| `ORS_API_KEY` | HF Spaces → Settings → Secrets | Routing (primary) |
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | HF Spaces → Settings → Secrets | Job market trends |
| `CLOUDFLARE_API_TOKEN` | HF Spaces Secret (tùy chọn) | Thường bị chặn TLS trên HF |
| `HF_TOKEN` | HF Spaces Secret (tùy chọn) | HF Inference fallback |
| `NVIDIA_API_KEY` | HF Spaces Secret (tùy chọn) | NVIDIA NIM fallback |
| `KIMI_API_KEY` | HF Spaces Secret (tùy chọn) | 01.ai / Kimi fallback |

**KHÔNG BAO GIỜ** hardcode secrets vào Dockerfile, `.env`, hoặc source code. `.env.example` chứa placeholder — `.env` và `.env.local` là **local only**, được `.gitignore` + `.huggingfaceignore` + `.dockerignore` loại trừ.

### 1.3 Build & deploy workflow (local → HF Spaces)

```bash
# 1. Code locally (chỉnh sửa source)
# 2. Build & test local Docker image
source .env
docker build -t edumap-hf:latest .
docker run -d --name edumap-test -p 7680:7680 -p 3000:3000 -p 8000:8000 \
  -e JWT_SECRET="$JWT_SECRET" \
  -e OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
  -e GEMINI_API_KEY="$GEMINI_API_KEY" \
  -e CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
  -e CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  edumap-hf:latest

# 3. Smoke test (11 tests in HF_DEPLOY_PLAN.md) — mở rộng thành 23 tests tại §1.5
# 4. Commit + push to GitHub main → GitHub Actions tự động build + deploy to HF Spaces
git add -A && git commit -m "feat: ..." && git push origin main
#    Hoặc deploy trực tiếp lên HF (cần HF_TOKEN)
HF_TOKEN=<token> ./deploy-hf.sh
```

### 1.4 Các constraints quan trọng khi phát triển trên HF Spaces

| Constraint | Impact | Giải pháp |
|---|---|---|
| Single container, supervisord | Không chạy service riêng | In-memory cache, SQLite, ORS API |
| CPU: cpu-basic (1 vCPU) | Slow inference | Lightweight models, caching |
| IPv6 blackhole | urllib/requests timeout | `curl --ipv4 --insecure` |
| Cloudflare TLS blocked | Workers AI không dùng được | Fallback chain OpenRouter → NVIDIA → HF |
| ChromaDB ephemeral | Vector DB bị xóa khi restart | Seed tại startup (`seed_vector_db.py`) |
| Filesystem read-only ngoài `/tmp`, `/app/uploads` | Không persist data mới | SQLite write OK tại `/app/frontend/public/edumap.db` |
| Docker layers cached | Rebuild chậm với requirements.txt | Chỉ sửa requirements.txt khi thật sự cần thiết |
| Supervisord `environment=` bỏ qua secrets | Secrets không lan truyền | `start.sh` recover từ `/proc/1/environ` |

### 1.5 Smoke test suite (23 tests — chạy sau mỗi deploy)

| # | Test | Lệnh | Expected |
|---|---|---|---|
| 1 | Frontend homepage | `curl -s -o /dev/null -w "%{http_code}" http://localhost:7680/` | 200 |
| 2 | Backend health | `curl http://localhost:7680/api/health` | `{"status":"ok",...}` |
| 3 | Map POIs | `curl "http://localhost:7680/api/map/pois?limit=5"` | 5 items |
| 4 | Hackathons | `curl http://localhost:7680/hackathon` | 30 hackathons |
| 5 | AI health | `curl http://localhost:8000/health` | `{"status":"ok","ai_ready":true,...}` |
| 6 | AI chat | `curl -X POST .../api/ai/chat -d '{"message":"Xin chào",...}'` | Real AI reply |
| 7 | BFF chat (401) | `curl -X POST .../api/ai/chat -d '{"message":"test",...}'` | 401 + AUTH_REQUIRED |
| 8 | BFF search (public) | `curl ".../api/ai/search?q=university"` | 200 + results |
| 9 | Map page | `curl -o /dev/null -w "%{http_code}" http://localhost:7680/map` | 200 |
| 10 | Hackathon page | `curl -o /dev/null -w "%{http_code}" http://localhost:7680/hackathon` | 200 |
| 11 | Routing | `curl ".../api/map/routing/route?lng1=...&lat1=...&lng2=...&lat2=..."` | 200 + GeoJSON |
| 12 | Climate risk (Idea #11) | `curl "http://localhost:7680/api/map/climate-risk?minLat=10.90&maxLat=10.98&minLng=106.80&maxLng=106.95"` | 200 + GeoJSON FeatureCollection |
| 13 | Climate alternatives | `curl -X POST http://localhost:7680/api/map/climate/alternatives -d '{"lat":10.9525,"lng":106.8778,"radiusKm":10}'` | 200 + safe locations GeoJSON |
| 14 | Language Bridge simplify | `curl -X POST http://localhost:7680/api/ai/language/simplify -H "Authorization: Bearer $TOKEN" -d '{"text":"Áp dụng giải thuật đa thức (multi-head attention) trong Transformer.","difficulty":"middle"}'` | 200 + JSON {simplified, explained_terms, degraded} |
| 15 | Language Bridge translate | `curl -X POST http://localhost:7680/api/ai/language/translate -H "Authorization: Bearer $TOKEN" -d '{"text":"Xin chào, đây là trường Đại học Đồng Nai.","target_language":"en"}'` | 200 + JSON {translated, target_language, degraded} |
| 16 | Language Bridge TTS | `curl -X POST http://localhost:7680/api/ai/language/tts -H "Authorization: Bearer $TOKEN" -d '{"text":"Xin chào, đây là trường Đại học Đồng Nai.","language":"vi"}'` | 200 + JSON {audio_base64|degraded, provider, language} |
| 17 | Language Bridge page (SSR) | `curl -o /dev/null -w "%{http_code}" http://localhost:7680/language-bridge` (auth redirect) | 302 → /auth/login |
| 18 | Language Bridge page (authed) | `curl -o /dev/null -w "%{http_code}" -H "Cookie: edumap-access-token=$TOKEN" http://localhost:7680/language-bridge` | 200 |
| 19 | AI Language service init | `curl http://localhost:8000/health` | `{"status":"ok",...}` (language router included) |
| 20 | Language Bridge Vietnamese TTS | `curl -X POST http://localhost:7680/api/ai/language/tts -H "Authorization: Bearer $TOKEN" -d '{"text":"Giáo viên là người truyền đức, truyền thừ tài cho học sinh.","language":"vi"}' \`  - check `degraded` flag and/or `audio_base64` not null OR degraded=true (graceful)
| 21 | Question Gap Report (Idea #17) | `curl -X GET http://localhost:7680/api/admin/question-gaps?limit=10000 -H "Authorization: Bearer $TOKEN"` | 200 + JSON `{clusters:[...], top_gaps:[...]}` |
| 22 | Resource Exchange AI match (Idea #18) | `curl -X POST http://localhost:7680/api/resource-exchange/match -H "Authorization: Bearer $TOKEN" -d '{"region":"Đồng Nai","type":"device","max_results":5}'` | 200 + JSON `{ranked_matches:[...], transport_plan:[...], degraded:?}`
| 23 | AI Impact Measurement (Idea #19) | `curl -X POST http://localhost:7680/api/ai/impact/measure -H "Authorization: Bearer $TOKEN" -d '{"min_lat":10.9,"max_lat":11.0,"min_lng":106.8,"max_lng":107.0,"deployment_date":"2025-01-01","region":"Biên Hòa, Đồng Nai"}'` | 200 + JSON `{impact_score, confidence_interval, before, after, diff, people_in_radius, trend, narrative, causal_notes, degraded}`

---

## 2. Lộ trình triển khai 20 ý tưởng AI

### Phân loại theo độ ưu tiên & độ khó

| Phase | Ý tưởng | Độ khó | Trạng thái hiện tại | Lý do |
|---|---|---|---|---|
| **Phase 1** (Cốt lõi - 2-3 tuần) | #2, #13, #4, #5 | MEDIUM → HIGH | 🟡 → 🟢 | Nền tảng AI agent + dữ liệu đáng tin cậy |
| **Phase 2** (Mở rộng - 2-3 tuần) | #1, #3, #8, #9, #14 | MEDIUM → HIGH | 🟡 → 🟡 | Tối ưu phân bổ + tri thức + cơ hội |
| **Phase 3** (Nâng cao - 2 tuần) | #6, #7, #12, #17, #11 | MEDIUM → HIGH | ❌ → 🟡 | Phát hiện dữ liệu + định tuyến + khảo sát |
| **Phase 4** (Tính năng cao cấp - 2 tuần) | #15, #16, #18 | MEDIUM | #15 ✅ / #16 ✅ / #18 ✅ | Language Bridge hoàn thành (T1-T3). Voice-to-Geo hoàn thành (T1-T9). Resource Exchange hoàn thành (T1-T5) — deploy HF Spaces. |
| **Phase 5** (Nghiên cứu - dài hạn) | #10, #20 | HIGH → VERY HIGH | ❌ → ❌ | Yêu cầu data phức tạp / mô hình cao cấp. *Note: #19 AI Impact Measurement đã hoàn thành (Phase 4) — suy luận thống kê trên dữ liệu cơ sở thực, không cần mô hình cao cấp.* |

---

## 3. Chi tiết kế hoạch từng phần

> Mỗi phần bao gồm: **mô tả**, **AI thực hiện**, **dữ liệu cần có**, **đầu ra**, **kiến trúc HF Spaces**, **tasks chi tiết**, **risks & mitigations**.

---

### Ý tưởng #1: AI Education Resource Optimizer (MCLP)

**Ý tưởng:** Tìm cách phân bổ ngân sách cho điểm Wi-Fi, máy tính, tủ sách hoặc không gian học tập sao cho phục vụ được nhiều người học và giảm bất bình đẳng.

**AI thực hiện:** Kết hợp ước tính nhu cầu với thuật toán tối ưu vị trí (MCLP — Maximum Coverage Location Problem); so sánh nhiều phương án và giải thích sự đánh đổi.

**Dữ liệu cần có:** Vị trí người học theo khu vực, cơ sở hiện có, mạng đường, chi phí và ngân sách.

**Đầu ra:** Bản đồ phương án A/B/C, số người dự kiến được phục vụ, chi phí và khu vực còn thiếu.

**Độ khó:** Cao | **Ưu tiên đề xuất**

#### Kiến trúc HF Spaces
- Backend NestJS: endpoint `/api/map/resource-optimization` (mới)
- AI service (FastAPI): endpoint `POST /api/ai/resource/optimize`
- Sử dụng `scipy.optimize` (đã có trong requirements.txt) hoặc `pulp` để giải MCLP
- Dữ liệu: SQLite `map_points`, `locations`, `wifi_locations`, `users` (được seed)
- Kết quả trả về GeoJSON FeatureCollection để render trên bản đồ frontend

#### Tasks chi tiết

- [ ] **Task 1**: Tạo model MCLP trong `ai-service/services/resource_optimizer.py` (mới)
  - Input: danh sách vị trí ứng viên (wifispots, libraries, schools), ngân sách, chi phí
  - Giải thuật: MCLP bằng `scipy.optimize.linprog` hoặc `pulp` (thêm vào requirements.txt)
  - Output: top-K phương án tối ưu, số người phục vụ, chi phí
  - **Verify**: unit test với synthetic data (5-10 điểm), kiểm tra optimal coverage tăng dần với budget

- [ ] **Task 2**: Tạo router `ai-service/routers/resource.py`
  - `POST /api/ai/resource/optimize` — nhận request body (candidates, budget, max_sites)
  - Trả về GeoJSON FeatureCollection + metadata (coverage %, cost, trade-offs)
  - Graceful degradation khi thiếu dữ liệu
  - **Verify**: curl test, response schema validation

- [ ] **Task 3**: Backend NestJS endpoint `GET /api/map/resource-optimization`
  - `backend/src/modules/map/map.controller.ts` — proxy tới ai-service
  - Parse SQLite data (map_points, wifi_locations) → gửi ai-service
  - Cache kết quả (TTL 3600s)
  - **Verify**: `tsc --noEmit`, curl test qua BFF

- [ ] **Task 4**: Frontend UI — `app/map/resource-optimizer/page.tsx` (mới)
  - Form chọn loại resource (wifi, library, school), budget slider
  - Render GeoJSON lên Leaflet (dùng `L.geoJSON()`)
  - Bảng so sánh phương án A/B/C
  - **Verify**: visual check, responsive, SSR OK

- [ ] **Task 5**: Integration test + deploy
  - Thêm vào smoke test suite (test #12)
  - Cập nhật `start.sh` nếu cần thiết mới deps
  - **Verify**: Docker local build, 11 smoke tests pass

#### Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| MCLP solver chậm trên CPU 1vCPU (HF Spaces) | Latency tới 5-10s | Pre-filter candidates (giới hạn ≤ 200 điểm), cache kết quả 1h |
| Thiếu dữ liệu chi phí | Output không thực tế | Default chi phí theo loại (wifi=$500, library=$2000, school=$5000) |
| `pulp` thêm vào requirements.txt → tăng build time ~30s | Build chậm | Dùng `scipy.optimize` (đã có) thay vì `pulp` nếu có thể |
| SQLite spatial query chậm | Timeout | Pre-compute distance matrix, dùng Haversine |

---

### Ý tưởng #2: EduMap AI Agent (NL → GIS)

**Ý tưởng:** Người dùng giao nhiệm vụ phân tích bản đồ bằng ngôn ngữ tự nhiên thay vì phải tự chọn nhiều bộ lọc.

**AI thực hiện:** LLM lập kế hoạch, chuyển câu hỏi thành truy vấn GIS, gọi công cụ được cho phép và tóm tắt kết quả kèm bằng chứng.

**Dữ liệu cần có:** Dữ liệu GIS chuẩn hóa, danh sách công cụ/API, nguồn và quy tắc kiểm tra truy vấn.

**Đầu ra:** Ví dụ: tìm khu vực cách thư viện trên 5 km rồi đề xuất ba vị trí hỗ trợ.

**Độ khó:** Trung bình–cao | **Ưu tiên đề xuất**

#### Kiến trúc HF Spaces
- AI service: endpoint `POST /api/ai/agent` — LLM agent với tool calling
- Tools: `query_sqlite`, `geo_recommend`, `geo_density`, `chat_rag`
- LLM: OpenRouter (deepseek/deepseek-chat — hỗ trợ tool calling) làm primary
- Session memory: dùng `SessionMemoryService` (NestJS) để lưu trữ hộp thoại

#### Tasks chi tiết

- [ ] **Task 1**: Tạo `ai-service/agents/map_agent.py` (mới)
  - Định nghĩa tool schema (JSON schema cho từng tool)
  - Hàm `plan_and_execute(user_query, session_id)` — LLM quyết định gọi tool nào
  - Tool: `query_sqlite(sql, params)` — thực thi SQL safe (read-only, allowlist tables)
  - Tool: `geo_recommend(lat, lng, radius, category)` — gọi hàm recommend_nearby
  - Tool: `geo_density(points)` — gọi clustering_service
  - Tool: `rag_search(query, category)` — gọi vector_store
  - **Verify**: test với 5 câu query mẫu, kiểm tra tool được gọi đúng

- [ ] **Task 2**: Tạo router `ai-service/routers/agent.py`
  - `POST /api/ai/agent/chat` — nhận `query`, `session_id`, trả về `reply` + `tool_calls` + `evidence`
  - Streaming SSE: `POST /api/ai/agent/stream`
  - **Verify**: curl test, kiểm tra response format

- [ ] **Task 3**: Backend NestJS proxy `ai.controller.ts` + `ai.service.ts`
  - Endpoint `POST /api/ai/agent/chat` → proxy tới ai-service :8000
  - Forward `session_id`, `user_id`, `Authorization` header
  - **Verify**: `tsc --noEmit`

- [ ] **Task 4**: Frontend UI — `app/ai-agent/page.tsx` (mới)
  - Chat interface với hiển thị tool calls (collapsible)
  - Bản đồ tương tác (kết quả geo query hiển thị trên Leaflet)
  - Session persistence (localStorage)
  - **Verify**: visual check, SSR OK

- [ ] **Task 5**: Test suite
  - Python: `tests/test_agent.py` — test tool calling logic
  - Smoke test #13: agent query → 200 + structured response
  - **Verify**: `pytest tests/test_agent.py`

#### Risks & Mitigations

| Risk | Risk | Mitigation |
|---|---|---|
| LLM gọi tool sai / SQL injection | Security | Chỉ cho phép SELECT trên bảng allowlist; parameterize queries |
| Tool calling chậm trên cpu-basic | Latency | Timeout 10s/tool call, max 3 tool calls per query |
| OpenRouter không hỗ trợ tool calling | Fallback | Gemini 3.5-flash (có tool calling) làm secondary |
| Session memory không persist | UX | SessionMemoryService TTL 30 phút + fallback localStorage |

---

### Ý tưởng #3: AI Educational Gap Predictor

**Ý tưởng:** Phát hiện khu vực có nguy cơ thiếu cơ hội học tập trong tương lai.

**AI thực hiện:** Mô hình dự báo không gian kết hợp các yếu tố dân số, khoảng cách, dịch vụ giáo dục và kết nối; nếu yếu tố góp phần tạo rủi ro.

**Dữ liệu cần có:** Dữ liệu trường, thư viện, đường, dân số và chuỗi dữ liệu theo thời gian.

**Đầu ra:** Bản đồ rủi ro, xu hướng và khu vực cần khảo sát sớm.

**Độ khó:** Cao | **Ưu tiên đề xuất**

#### Kiến trúc HF Spaces
- Sử dụng `predictive_service.py` (đã có Holt's Linear) + `clustering_service.py` (DBSCAN)
- Kết hợp `education_stats` table + `map_points` + `wifi_locations` + `locations`
- Output: GeoJSON Risk heatmap + risk score per cluster

#### Tasks chi tiết

- [ ] **Task 1**: Mở rộng `predictive_service.py` — thêm `predict_educational_gaps(region, steps_ahead)`
  - Load education_stats (Holt's forecast per region)
  - Load map_points density (DBSCAN clusters)
  - Tính risk score = weighted combo(growth_rate, density_gap, access_distance)
  - **Verify**: test với synthetic data, risk score trong [0, 1]

- [ ] **Task 2**: Tạo router `routers/gap_predictor.py` (hoặc mở rộng geo.py)
  - `POST /api/ai/forecast/gaps` — nhận region, trả về GeoJSON + risk ranking
  - `GET /api/ai/forecast/gaps/{region}` — cache kết quả
  - **Verify**: curl test

- [ ] **Task 3**: Backend NestJS endpoint
  - `GET /api/map/gap-forecast?region=...` → proxy ai-service
  - Cache TTL 86400s (24h)
  - **Verify**: tsc + integration test

- [ ] **Task 4**: Frontend — `app/map/gap-predictor/page.tsx`
  - Heatmap layer (Leaflet.heat) màu rủi ro
  - Bảng xếp hạng khu vực nguy cơ cao
  - **Verify**: visual check

- [ ] **Task 5**: Test + deploy
  - Python tests cho forecast logic
  - Smoke test #14

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Data sparse (education_stats chỉ có một vài năm) | Forecast không tin cậy | Cảnh báo "degraded" khi < 3 data points |
| DBSCAN chậm trên 10k+ points | Latency | Pre-filter toi da 2000 points per cluster run |
| Risk score thiên vị | Không minh bạch | Trả về feature importance + công thức |

---

### Ý tưởng #4: Talk2Map (NL → GIS queries, Vietnamese)

**Ý tưởng:** Cho phép tìm kiếm dữ liệu bản đồ bằng câu hỏi tiếng Việt thông thường.

**AI thực hiện:** LLM trích xuất địa điểm, bán kính, loại tiện ích và điều kiện; hệ thống kiểm tra rồi chạy truy vấn GIS.

**Dữ liệu cần có:** Danh mục dữ liệu địa lý, từ điển địa danh và API truy vấn.

**Đầu ra:** "Tìm nơi học miễn phí gần trường, có Wi-Fi và mở cửa buổi tối."

**Độ khó:** Trung bình | **Ưu tiên đề xuất**

#### Kiến trúc HF Spaces
- Tận dụng EduMap AI Agent (#2) — Talk2Map là một subset (chỉ query, không action)
- LLM trích xuất entities từ tiếng Việt → structured query → thực thi GIS

#### Tasks chi tiết

- [x] **Task 1**: Tạo `ai-service/services/nl_query_parser.py` (mới)
  - Prompt template: trích xuất `location`, `radius_km`, `category`, `open_evening`, `is_free`
  - Vietnamese entity extraction: địa danh (tỉnh/thành/phường), loại cơ sở (trường, thư viện, wifi)
  - Fallback keyword extraction nếu LLM fail (regex-based)
  - **Verify**: test với 10 câu tiếng Việt mẫu — 30 unit tests pass, 10 integration sentences pass

- [x] **Task 2**: Tạo router `routers/talk2map.py`
  - `POST /api/ai/map/query` — nhận `question` (tiếng Việt), trả về structured query + results GeoJSON
  - Validate: kiểm tra location tồn tại trong `map_points`, radius hợp lệ
  - **Verify**: curl test — 200 + structured JSON

- [x] **Task 3**: Backend proxy + SQLite pre-filter
  - `GET /api/map/nl-search?q=...` — BFF proxy, thử SQLite trước
  - **Verify**: tsc + 11 Jest tests pass

- [x] **Task 4**: Frontend — `app/talk2map/page.tsx` (mới)
  - Input box nhập câu hỏa tiếng Việt
  - Hiển thị structured query (debug mode) + kết quả trên bản đồ
  - **Verify**: visual check, Vietnamese text OK — page renders, next build OK

- [x] **Task 5**: Test + smoke test #15
  - 30 Python unit tests pass
  - 10 Vietnamese sentence integration tests pass
  - `scripts/smoke_test_talk2map.sh` created

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| LLM trích xuất sai địa danh | Query trả về empty | Fuzzy match + suggestion "Bạn có muốn tìm ở X không?" |
| Vietnamese dialect (miền Bắc/Tây/Nam) khác nhau | Extraction miss | Train keyword dictionary từ cả 3 miền |
| Query phức tạp (combine nhiều điều kiện) | Complex parsing | Support chaining: extract → filter → rank |

---

### Ý tưởng #5: AI Data Trust & Anomaly Detector

**Ý tưởng:** Phát hiện điểm dữ liệu sai, trùng lặp, lỗi thời hoặc có tọa độ bất thường.

**AI thực hiện:** Kết hợp luật kiểm tra dữ liệu với mô hình phát hiện bất thường và xếp hàng ưu tiên xác minh.

**Dữ liệu cần có:** Tọa độ, tên, đia giới, giờ hoạt động, nguồn và lịch sử cập nhật.

**Đầu ra:** Danh sách điểm cần kiểm tra, lý do cảnh báo và mức tin cậy.

**Độ khó:** Trung bình | **Ưu tiên đề xuất**

#### Tasks chi tiết

- [ ] **Task 1**: Tạo `ai-service/services/data_quality.py` (mới)
  - Rules: duplicate name+location, out-of-bounds coords (lat ∉ [8, 23], lng ∉ [102, 110]), missing required fields, stale (updated > 1 year ago)
  - ML anomaly: IsolationForest (scikit-learn already in requirements) trên lat/lng + rating
  - Priority scoring: weighted(score_anomaly, impact_coverage, last_verified)
  - **Verify**: test với synthetic dirty data

- [ ] **Task 2**: Router `routers/data_quality.py`
  - `POST /api/ai/data/quality/report` — scan một bảng (map_points, wifi_locations, ...)
  - Trả về danh sách anomalies + priority ranking
  - **Verify**: curl test

- [ ] **Task 3**: Backend endpoint `GET /api/admin/data-quality?table=map_points`
  - Chỉ admin role (JWT guard)
  - Cache 1h
  - **Verify**: tsc + auth test

- [ ] **Task 4**: Frontend — `app/admin/data-quality/page.tsx`
  - Table danh sách anomalies (sortable, filterable)
  - Map view: markers màu đỏ cho anomalies
  - **Verify**: visual + auth check

- [ ] **Task 5**: Test + smoke test #16

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| IsolationForest chậm trên 10k+ rows | Latency | Chunk processing (1000 rows/chunk), async background job |
| False positive cao | UX | Confidence threshold tuning (start 0.7) |
| Admin page expose data | Security | JWT role guard + audit log |

---

### ý tưởng #6: Missing Data Hunter

**Ý tượng:** Tìm những khu vực hoặc thuộc tính mà bản đồ chưa có đủ dữ liệu.

**AI thực hiện:** Phân tích độ bao phủ địa lý, sự thiếu hụt thuộc tính và độ mới của dữ liệu để chọn điểm khảo sát tiếp theo.

**Dữ liệu cần có:** Các lớp GIS, nguồn dữ liệu, thời gian cập nhật và trạng thái xác minh.

**Đầu ra:** Bản đồ ưu tiên khảo sát và danh sách thông tin cần bổ sung.

**Độ khó:** Trung bình | **Ưu tiên đề xuất**

#### Tasks chi tiết

- [ ] **Task 1**: Mở rộng `clustering_service.py` — thêm `identify_data_gaps(points, grid_size_km)`
  - Grid-based coverage analysis: chia vùng thành grid, đếm points mỗi cell
  - Thiếu hụt: cells có 0 points, hoặc points thiếu attributes (missing `website`, `hours`, `rating`)
  - Staleness: last_updated > 1 year
  - **Verify**: test với synthetic grid

- [ ] **Task 2**: Router `routers/data_hunter.py`
  - `POST /api/ai/data/gaps` — nhận bounding box + layer type, trả về GeoJSON gap cells
  - **Verify**: curl test

- [ ] **Task 3**: Backend proxy `GET /api/map/data-gaps?bbox=...`

- [ ] **Task 4**: Frontend — `app/map/data-hunter/page.tsx`
  - Render gap cells (đỏ) + priority list
  - Click → chuyện sang survey form
  - **Verify**: visual check

- [ ] **Task 5**: Test + smoke test

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Grid resolution quyết định chất lượng | Accuracy | Configurable grid_size_km (default 1km) |
| Stale data detection không chính xác | False alarms | Chỉ đánh dấu dữ liệu được cập nhật > 2 years |

---

### Ý tưởng #7: Edge AI Tutor — Gia sư AI ngoại tuyến

**Ý tưởng:** Hỗ trợ học sinh học khi Internet yếu hoặc không có kết nối.

**AI thực hiện:** Mô hình ngôn ngữ nhỏ chạy cục bộ, kết hợp tài liệu đã duyệt để giải thích, tạo bài luyện tập và gợi ý học tiếp.

**Dữ liệu cần có:** Tài liệu học tập, mô hình nhỏ, thiết bị phù hợp và bộ kiểm thử.

**Đầu ra:** Gia sư ngoại tuyến, bài tập ngắn và tiến trình học lưu trên thiết bị.

**Độ khó:** Cao | **Ưu tiên đề xuất**

#### Kiến trúc HF Spaces
- **Constraint**: HF Spaces không hỗ trợ offline model serving tính năng này một cách trực tiếp. Model nhỏ cần được bundle trong Docker image (tăng kích thước).
- **Chiến lược**: Offline tutor dành cho **mobile app** (React Native) + PWA offline capability trên web
- Model: TinyLLaMA 1.1B (4-bit quantized, ~1GB) hoặc GPT-NEO 125M (~500MB)
- Embeddings: dùng Gemini/OpenRouter embeddings cache (được lưu trong ChromaDB hoặc SQLite)

#### Tasks chi tiết

- [ ] **Task 1**: Chọn luyện model nhỏ — `ai-service/models/` hoặc tải từ HuggingFace
  - Model đề xuất: `NousResearch/TinyLlama-1.1B-Chat-v1.0` (quantized 4-bit)
  - Kiểm tra kích thước < 1GB, compatible với CPU
  - **Verify**: test inference speed trên CPU (target < 5s/token)

- [ ] **Task 2**: Tạo offline inference engine — `ai-service/offline/tutor.py` (mới)
  - Load model + tokenizer (transformers + bitsandbytes)
  - Function: `explain(topic)`, `generate_practice(topic, difficulty)`, `suggest_next(topic)`
  - Fallback khi model không load được: template-based responses
  - **Verify**: unit test với 5 topics

- [ ] **Task 3**: Backend NestJS endpoint `POST /api/offline/tutor`
  - Forward tới ai-service `POST /api/ai/offline/tutor`
  - Cache responses (TTL 1h)
  - **Verify**: tsc

- [ ] **Task 4**: Frontend offline mode — `app/offline-tutor/page.tsx`
  - PWA installable, cache tài liệu qua Service Worker
  - Khi offline: dùng localStorage cache + fallback template
  - Khi online: gọi AI service
  - **Verify**: lighthouse PWA audit

- [ ] **Task 5**: Mobile app integration — `mobile/src/services/offline-tutor.ts`
  - Download model bundle khi có connection
  - Dùng React Native TF.js hoặc on-device inference
  - **Verify**: Android/iOS build test

- [ ] **Task 6**: requirements.txt update + Docker cache strategy
  - Thêm `transformers`, `bitsandbytes`, `torch` (CPU-only, ~800MB)
  - Cache model weights trong Docker layer để tránh tải lại
  - **Verify**: Docker build time < 15 phút

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Model 1GB+ vượt quá disk limit HF Spaces (1GB) | Build fail | Model ở dưỡng dạng `.bin` được `.dockerignore` / `.huggingfaceignore` loại trừ; tải tại runtime nếu cần |
| CPU inference chậm | UX | Use 4-bit quantization, batch generation, cache common queries |
| Offline model không đủ smart | Chất lượng thấp | Kết hợp template-based rules + retrieved docs từ ChromaDB cache |

---

### Ý tưởng #8: AI Knowledge Graph for Education

**Ý tưởng:** Liên kết trường học, nhu cầu hỗ trợ, học bổng, nhà tài trợ, tổ chức và tài nguyên.

**AI thực hiện:** NLP trích xuất thực thể từ văn bản; đồ thể tri thức tìm quan hệ và cơ hội phù hợp.

**Dữ liệu cần có:** Hồ sơ trường, nhu cầu, nguồn tài trợ, tổ chức và hạn chót.

**Đầu ra:** Gợi ý nguồn tài trợ hoặc đối tác phù hợp với một nhu cầu đã xác minh.

**Độ khó:** Trung bày–cao | **Ưu tiên đề xuất**

#### Kiến trúc HF Spaces
- Tận dụng ChromaDB vector store (đã có) + SQLite entities
- NLP entity extraction: dùng LLM (OpenRouter) để trích xuất thực thể từ văn bản
- Knowledge graph: Neo4j không khả dụng trên HF Spaces → dùng SQLite graph representation (adjacency list) hoặc NetworkX in-memory

#### Tasks chi tiết

- [ ] **Task 1**: Tạo `ai-service/services/knowledge_graph.py` (mới)
  - Node types: School, Library, Scholarship, Sponsor, Resource, Organization
  - Edge types: "located_in", "offers", "funded_by", "supports", "near"
  - Build from SQLite: join `map_points`, `scholarships`, `learning_materials`, `locations`
  - **Verify**: test graph construction + traversal

- [ ] **Task 2**: NLP entity extraction
  - `POST /api/ai/knowledge/extract` — trích xuất thực thể từ text → node
  - LLM prompt: structured JSON output (entity_type, name, attributes, relationships)
  - **Verify**: test với 10 documents mẫu

- [ ] **Task 3**: Router `routers/knowledge.py`
  - `POST /api/ai/knowledge/query` — "Tìm nhà tài trợ cho trường ở miền Tây" → traverse graph
  - `GET /api/ai/knowledge/graph?center=school_id` — trả về graph JSON
  - **Verify**: curl test

- [ ] **Task 4**: Backend proxy + entity sync
  - `GET /api/knowledge/graph/:id` — proxy ai-service
  - Background job: sync SQLite → knowledge graph (hourly)
  - **Verify**: tsc

- [ ] **Task 5**: Frontend visualization — `app/knowledge-graph/page.tsx`
  - D3.js force-directed graph (hoặc Cytoscape.js)
  - Click node → xem chi tiết, related nodes
  - **Verify**: visual + performance (≤ 100 nodes render OK)

- [ ] **Task 6**: Test + smoke test

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Graph lớn (>10k nodes) → memory pressure | OOM | Paginate / subgraph query (chỉ lấy 1-degree neighbors) |
| NLP extraction sai thực thể | Graph sai | Human-in-the-loop review queue |
| NetworkX chậm | Latency | Use adjacency list (dict) thay vì NetworkX graph object |

---

### Ý tưởng #9: ImpactMatch — Ghép nhu cầu với nhà tài trợ

**Ý tưởng:** Giúp nguồn lực đến đúng trường hoặc cộng đồng đang cần.

**AI thực hiện:** Mô hình xếp hạng theo loại nhu cầu, mức cấp thiết, chi phí, vị trí và khả năng triển khai; giải thích từng kết quả.

**Dữ liệu cần có:** Hồ sơ nhu cầu, nguồn lực nhà tài trợ, chi phí và trạng thái xác minh.

**Đầu ra:** Danh sách nhu cầu phù hợp, lý do ghép và bước triển khai tiếp theo.

**Độ khó:** Trung bình | **Ưu tiên đề xuất**

#### Kiến trúc HF Spaces
- Tận dụng mentor matching infrastructure (3-layer defense) — mở rộng cho sponsor matching
- DB pre-filter (SQLite): filter needs by region + category + verified status
- LLM ranking: so sánh need profile vs sponsor criteria, trả về match_score + explanation

#### Tasks chi tiết

- [ ] **Task 1**: Backend schema — thêm bảng `sponsor_needs`, `sponsor_profiles`
  - Migration SQL (SQLite-compatible)
  - Entities: `SponsorProfile`, `SponsorNeed`
  - **Verify**: migrate + seed test data

- [ ] **Task 2**: Backend service `ImpactMatchService`
  - `GET /api/impactmatch/suggestions?sponsor_id=...` — pre-filter bằng SQLite
  - Forward kết quả đã filter tới ai-service cho LLM ranking
  - **Verify**: tsc + integration test

- [ ] **Task 3**: AI service — `POST /api/ai/impactmatch/rank`
  - Nhận danh sách needs + sponsor profile, trả về ranking + explanation
  - Dùng OpenRouter để generate explanation
  - Cache kết quả (TTL 300s)
  - **Verify**: curl test + caching test

- [ ] **Task 4**: Frontend — `app/impact-match/page.tsx` (mới)
  - Dual panel: sponsor input (criteria, budget, region) + results
  - Match score + explanation per need
  - **Verify**: visual check

- [ ] **Task 5**: Test + smoke test

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Sponsor/need data chưa có sẵn | Chưa testable | Seed demo data từ scholarship + library needs |
| LLM ranking chậm | Latency | Cache + max 20 needs per batch |
| Token overflow | Truncated | Pre-filter SQLite → max 15, LLM safety cap |

---

### Ý tưởng #10: GeoVision AI — Phân tích ảnh vệ tinh

**Ý tưởng:** Phát hiện công trình có khả năng là trường hoặc điểm học tập chưa được ghi nhận.

**AI thực hiện:** Computer vision nhận diện công trình, đối chiếu dữ liệu bản đồ và đề xuất vị trí cần xác minh.

**Dữ liệu cần có:** Ảnh vệ tinh/ảnh hàng không có quyền sử dụng, lớp bản đồ và dữ liệu đã xác minh.

**Đầu ra:** Các điểm nghi vấn trên bản đồ cùng điểm tin cậy.

**Độ khó:** Rất cao

#### Quyết định kiến trúc
- **Rủi ro**: CV model (>500MB) vượt quá disk limit HF Spaces. 
- **Chiến lược**: Dùng HuggingFace Inference API (zero-shot detection) thay vì chạy model locally. Gửi tile ảnh từ backend → HF Inference API → kết quả.
- Model đề xuất: `facebook/opt-1.3b` (chỉ text) → không phù hợp. Dùng `google/owlvii` (object detection) qua HF Inference API.

#### Tasks chi tiết

- [ ] **Task 1**: Backend endpoint `GET /api/geo/satellite-tiles?bbox=...`
  - Fetch OSM tile hoặc Bing Maps tiles (dùng tile server công cộng)
  - Stitch tiles thành composite image
  - **Verify**: curl test, tile fetched OK

- [ ] **Task 2**: AI service `POST /api/ai/geo/vision-detect`
  - Gửi image tới HF Inference API (facebook/owlv2 or custom)
  - Parse detections → GeoJSON points
  - Filter: confidence > 0.7, class = "school"/"building"
  - **Verify**: test với 3 sample images

- [ ] **Task 3**: Backend chéo-check detections với map_points hiện có
  - Kết hợp detections chưa có trong DB → novel locations
  - **Verify**: tsc

- [ ] **Task 4**: Frontend — `app/map/geo-vision/page.tsx`
  - Chế độ chọn vùng → fetch tiles → detect → render markers
  - **Verify**: visual check

- [ ] **Task 5**: Test (manual — model phứ tạp)

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| HF Inference API quota | Rate limited | Cache detections per tile (24h), fallback empty results |
| Image tile resolution thấp | Detection miss | Use high-zoom tiles (z=18+) |
| Model size | HF Spaces disk | Dùng API (không bundle model) |
| Object detection false positives | Noise | Post-filter: distance < 50m tới existing points, building area > threshold |

---

### Ý tưởng #11: AI Climate Learning Guardian

**Ý tĩnh:** Hỗ trợ duy trì học tập khi ngập lụt hoặc thời tiết cực đoan làm gián đoạn đi lại.

**AI thực hiện:** Kết hợp dữ liệu thời tiết, địa hình, đường và lịch sử sự cố để ước tính rủi ro, đề xuất điểm thay thế hoặc học ngoại tuyến.

**Dữ liệu cần có:** Dữ liệu mưa/ngập, địa hình, đường và địa điểm học tập.

**Đầu ra:** Bản đồ rủi ro tiếp cận và phương án học thay thế.

**Độ khó:** Cao

#### Tasks chi tiết

- [x] **Task 1**: Tạo `ai-service/services/climate_guardian.py` (mới)
  - Load weather data: dùng OpenWeatherMap API (cần key) hoặc dùng static flood map data
  - Dữ liệu địa hình: SRTM elevation data (có thể dùng OpenStreetMap elevation)
  - Risk model: weighted(gia_ngap, thoi_tiet_extreme, khoang_cach_truong)
  - **Verify**: test với synthetic flood scenario

- [x] **Task 2**: Router `routers/climate.py`
  - `POST /api/ai/climate/risk` — nhận bounding box, ngày, trả về risk heatmap GeoJSON
  - `POST /api/ai/climate/alternatives` — đề xuất điểm học thay thế an toàn
  - **Verify**: curl test

- [x] **Task 3**: Backend proxy `GET /api/map/climate-risk?bbox=...`

- [x] **Task 4**: Frontend — `app/climate-guardian/page.tsx`
  - Overlay risk heatmap lên bản đồ
  - Alternative locations list + route đến
  - **Verify**: visual check

- [x] **Task 5**: Test + smoke test

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Thiếu weather API key | No real-time data | Fallback: static flood hazard map (VNExpress disaster data) |
| Elevation data lớn | Disk | Cache elevation trong `/tmp` (ephemeral OK) |
| Model phức tạp | Latency | Pre-compute risk zones, cache 24h |

---

### ý tưởng #12: SafeRoute AI

**Ý tưởng:** Gợi ý tuyến đường đến trường, thư viện hoặc điểm học dựa trên nhiều điều kiện.

**AI thực hiện:** Định tuyến GIS có trọng số cho khoảng cách, thời gian, điểm ngập và các yếu tố an toàn đã xác định.

**Dữ liệu cần có:** Mạng đường, báo cáo sự cố, dữ liệu ngập và điểm đến.

**Đầu ra:** Tuyến đề xuất, tuyến thay thế và lý do lựa chọn.

**Độ khó:** Trung bình–cao

#### Kiến trúc HF Spaces
- Đã có `routing.service.ts` (ORS → OSRM → Haversine) + frontend `RoutePolyline.tsx`
- Cần thêm: weighted routing (safety scores) + alternative routes + explanation

#### Tasks chi tiết

- [ ] **Task 1**: Backend — mở rộng `routing.service.ts`
  - Thêm `safeRoute(user_lat, user_lng, dest_lat, dest_lng, preferences)`
  - Preferences: avoid_flood, avoid_traffic, prefer_paved, max_distance
  - Query SQLite `flood_reports`, `traffic_reports` để lấy weights
  - **Verify**: tsc + integration test

- [ ] **Task 2**: Backend endpoint `GET /api/map/safe-route`
  - Trả về multiple routes (primary + 2 alternatives) + safety scores + explanation
  - **Verify**: tsc

- [ ] **Task 3**: Router ai-service `POST /api/ai/route/explain`
  - Nhận routes + user preferences, LLM giải thích tại sao route này tốt hơn
  - **Verify**: curl test

- [ ] **Task 4**: Frontend — cập nhật `app/map/page.tsx` + `components/map/RoutingPanel.tsx`
  - Multi-route display (primary highlighted, alternatives dimmed)
  - Safety score badge per route
  - LLM explanation panel
  - **Verify**: visual + mobile responsive

- [ ] **Task 5**: Test + smoke test #17

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| ORS API quota (2k/day) | Rate limited | Cache routes 1h, fallback to OSRM/Haversine |
| Safety data thiếu | Score không chính xác | Default uniform weights, flag "estimated" |
| Multiple routes → latency | Slow | Parallel ORS + OSRM calls, return first 2 |

---

### ý tưởng #13: AI Learning Space Recommender

**Ý tưởng:** Tìm nơi học phù hợp theo khoảng cách, giờ mở cửa, Wi-Fi, độ yên tĩnh và khả năng tiếp cận.

**AI thực hiện:** Hệ thống gợi ý xếp hạng địa điểm theo tiêu chí người dùng chọn, giải thích vì sao địa điểm được đề xuất.

**Dữ liệu cần có:** Địa điểm, giờ mở cửa, tiện ích, phản hồi và thời điểm cập nhật.

**Đầu ra:** Danh sách địa điểm phù hợp và thông tin còn cần xác minh.

**Độ khó:** Trung bình

#### Kiến trúc HF Spaces
- Đã có `LearningSpot` entity ↔ `learning_spots` table (trống, cần mở rút `opening_hours`, `quietness`, `amenities`) + `LearningCommunityModule` (`/learning-spots`)
- Scoring: backend NestJS `LearningSpaceRecommenderService` (tích hợp `learning-community` module), normalized weighted scoring
- Explain: AI service FastAPI `POST /api/ai/learning-space/explain` (LLM + 24h cache + static fallback)
- Chi tiết kế hoạch: xem `tasks/learning-space-recommender-plan.md`

#### Tasks chi tiết

- [ ] **Task 1** [T1]: Backend `LearningSpaceRecommenderService` — scoring algorithm
  - Schema: mở rộng `learning_spots` (`opening_hours`, `quietness`, `amenities`, `address`, `description`) + `sqlite-bootstrap.ts` self-heal
  - Scoring: weighted(distance, rating, open_now, has_wifi, quietness, capacity) — normalized [0,1]
  - Explain: gọi AI service, graceful degrade nếu AI down
  - **Verify**: tsc + scoring unit test

- [ ] **Task 2** [T1]: Backend endpoint `GET /api/learning-spots/recommend`
  - Params: lat, lng, radius, has_wifi, min_rating, quietness_min, open_now, limit, w_*
  - Trả về ranked list + GeoJSON + `degraded`/`reason`
  - **Verify**: curl test

- [ ] **Task 3** [T2]: AI service `POST /api/ai/learning-space/explain`
  - Nhận spot + user preferences, trả về explanation text (LLM + 24h cache + fallback template)
  - **Verify**: curl test + pytest

- [ ] **Task 4** [T3]: Frontend — `app/learning-spaces/page.tsx`
  - Filter panel (distance, rating, amenities, open hours, quietness)
  - Results grid + map pins (Leaflet)
  - Explain badge per card
  - **Verify**: visual check + tsc

- [x] **Task 5** [T4]: Test + smoke test #18 — ✅ pytest 9/9, Jest 8/8, smoke test #22 thêm vào §1.5
  - Backend scoring spec, AI explain spec, smoke_test_learning_space.sh
  - **Verify**: `npm test`, `pytest tests`, `bash -n smoke_test`

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scoring bias (địa gần = luôn top) | Không công bằng | Normalize scores [0,1] per criterion, configurable weights |
| LLM explain chậm | Latency | Cache explanations 24h, fallback static templates, ≤8s timeout |
| SQLite schema drift on HF (columns missing) | Crash | `sqlite-bootstrap.ts` self-heal + entity sync cùng schema

---

### ý tưởng #14: Opportunity Radar — AI tìm học bổng

**Ý tưởng:** Giúp người học tìm học bổng, khóa học miễn phí và cuộc thi phù hợp.

**AI thực hiện:** NLP trích xuất điều kiện và hạn nộp từ thông báo chính thức, sau đó so khớp tiêu chí do người dùng cung cấp.

**Dữ liệu cần có:** Thông báo chính thức, điều kiện, hạn nộp và tiêu chí tự nguyện cung cấp.

**Đầu ra:** Cơ hội phù hợp, lý do phù hợp và checklist hồ sơ.

**Độ khó:** Trung bường

#### Kiến trúc HF Spaces
- Đã có `scholarship.py` router + mentor pre-filter infrastructure (#6)
- Mở rộng: NLP scholarship description matching

#### Tasks chi tiết

- [ ] **Task 1**: Backend — `ScholarshipMatchingService`
  - Query SQLite `scholarships` với điều kiện (region, major, GPA)
  - Pre-filter SQLite, forward top 20 tới AI service
  - **Verify**: tsc

- [ ] **Task 2**: AI service `POST /api/ai/opportunity/match`
  - NLP trích xuất tiêu chí từ scholarship description
  - So khớp với user profile (major, GPA, region, interests)
  - Trả về match_score + explanation + checklist
  - **Verify**: curl test

- [ ] **Task 3**: Frontend — `app/opportunities/page.tsx`
  - Form nhập tiêu chí (major, GPA, region, interests)
  - Results: scholarship cards + match score + checklist
  - Deadline countdown badge
  - **Verify**: visual check

- [ ] **Task 4**: Test + smoke test #19

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scholarship data thiếu | Kết quả ít | Seed từ Devpost API + scholarship DB |
| NLP matching sai | False positives | Confidence threshold (min 0.6) |
| Deadline pass | UX | Filter lấy deadline > today ở backend |

---

### ý tưởng #15: Language Bridge AI

**Ý tưởng:** Làm tài liệu học tập dễ hiểu, dễ nghe và dễ tiếp cận hơn.

**AI thực hiện:** LLM tóm tắt theo trình độ, giải thích thuật ngữ, đọc văn bản thành tiếng và dịch khi có dữ liệu phù hợp.

**Dữ liệu cần có:** Tài liệu được phép sử dụng và bộ kiểm tra chất lượng.

**Đầu ra:** Bản dễ hiểu, bản nghe và bản dịch kèm liên kết bản gốc.

**Độ khó:** Trung bình

#### Tasks chi tiết

- [x] **Task 1**: AI service `POST /api/ai/language/simplify` ✅
  - Nhận text + difficulty level (`elementary`, `middle`, `high`, `college`)
  - LLM tóm tắv + giải thích thuật ngữ qua `_generate_text_with_fallback`
  - Trả về `simplified` + `explained_terms` dict, với template-based fallback khi LLM down
  - **Verify**: `tests/test_language_bridge.py` (26 unit tests pass), curl test
  - **File**: `ai-service/services/language_bridge.py`, `ai-service/routers/language.py`

- [x] **Task 2**: AI service `POST /api/ai/language/tts` ✅
  - Text → speech: Google Cloud TTS (curl, `GOOGLE_TTS_API_KEY`) → `edge-tts` → `gTTS` → degraded
  - Trả về `audio_base64` (MP3) + `provider` + `degraded` flag; frontend dùng Web Speech API fallback
  - **Verify**: test với tiếng Việt (`test_tts_vietnamese_language_code`, `test_tts_degraded_when_no_provider`)
  - **File**: `ai-service/services/language_bridge.py`, `ai-service/requirements.txt` (thêm gTTS, edge-tts), `ai-service/start.sh`

- [x] **Task 3**: AI service `POST /api/ai/language/translate` ✅
  - Dịch đa ngườn ngã với **glossary** (domain terms preserved) + source language auto-detect
  - LLM qua `_generate_text_with_fallback`; fallback trả về text gốc khi LLM down
  - **Verify**: curl test + `test_translate_degraded_fallback`
  - **File**: `ai-service/services/language_bridge.py`, `ai-service/routers/language.py`

- [x] **Task 4**: Frontend — `app/language-bridge/page.tsx` ✅
  - Text input + difficulty selector → xem simplified + explained_terms
  - TTS player (play/pause/stop, speed, download, browser Web Speech fallback)
  - Translate dropdown + glossary textarea
  - Dual-panel layout (controls left, output tabs right: Simplify / Translate / TTS)
  - **Verify**: `tsc --noEmit` pass, page renders, SSR OK
  - **File**: `app/language-bridge/page.tsx`, `src/services/language-bridge.service.ts`, BFF routes `app/api/ai/language/*`

- [x] **Task 5**: Backend NestJS proxy + Test + smoke test ✅
  - Backend: `ai.controller.ts` + `ai.service.ts` (JwtAuthGuard, 45s LLM timeout, 24h cache)
  - **Verify**: `tsc --noEmit` pass, 26 Python tests pass, smoke tests #14–#20

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| TTS giọng nói kém | UX | Dùng Google Cloud TTS nếu có key (`GOOGLE_TTS_API_KEY`), fallback `edge-tts` (giọng Việt tự nhiên) → `gTTS` → Web Speech API trình duyệt |
| Translation mất ngữ cảnh | Sai nghĩa | Provide glossary context, chunk large docs |
| Difficulty level subjective | Không chuẩn | Dùng CEFR framework (A1-C2) → ánh xạ: elementary≈A1-A2, middle≈A2-B1, high≈B1-B2, college≈C1 |

---

### ý tưởng #16: Voice-to-Geo AI

**Ý tượng:** Cho phép học sinh tìm kiếm hoặc gửi báo cáo bản đồ bằng giọng nói.

**AI thực hiện:** Nhận dạng tiếng nói, trích xuất ý định và địa điểm, sau đó chuyển thành truy vấn GIS hoặc biểu mẫu báo cáo.

**Dữ liệu cần có:** Speech-to-text tiếng Việt, dữ liệu địa danh và công cụ GIS.

**Đầu ra:** Tìm nơi học bằng giọng nói hoặc gửi báo cáo Wi-Fi hỏng/ngập.

**Độ khó:** Trung bình

#### Tasks chi tiết

- [x] **Task 1**: Thêm Web Speech API vào frontend (browser-native, không cần server)
  - `app/voice-search/page.tsx` — record button → SpeechRecognition → text
  - Kết hợp với Talk2Map (#4) để parse text thành query
  - **Verify**: browser test (Chrome) — `tsc --noEmit` passes; runtime verified via TestClient

- [x] **Task 2**: Backend fallback STT — `POST /api/ai/speech/to-text`
  - Dùng OpenRouter Whisper API (`openai/whisper-large-v3`)
  - Vietnamese language support (`language: "vi"`)
  - Graceful degradation: returns 200 + `degraded=True` when key absent/network fails
  - **Verify**: curl test — `scripts/smoke_test_voice_geo.sh` + 3 router tests + 7 service tests

- [x] **Task 3**: Intent extraction (tận dụng Talk2Map parser)
  - `NLQueryParser.extract_intent()` — geo_recommend / report_form / geo_query
  - "Tìm thư viện gần đây" → geo_recommend
  - "Báo wifi hỏng ở trường X" → report_form
  - "Trường DNTU ở đâu?" → geo_query
  - Intent returned as top-level field in `talk2map.py` response, passed through `map.service.ts` nLSearch
  - **Verify**: 17 intent tests (5 find, 5 report, 4 info, default, priority)

- [x] **Task 4**: Frontend UI — voice input button trên map page + chat
  - Voice button in map floating control panel (`:/map`)
  - Voice input button in chat input area (`/ai-chat`)
  - Dedicated `/voice-search` page (T1) with full STT flow + Whisper fallback
  - **Verify**: visual check (Chrome) — `tsc --noEmit` passes

- [x] **Task 5**: Test
  - 26 Python tests (test_speech.py): service + intent + router
  - 7 backend TypeScript tests (ai.service.spec.ts)
  - Full suite: 384 passed
  - TypeScript: frontend + backend `tsc --noEmit` clean

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Web Speech API không hỗ trợ tiếng Việt tốt | Accuracy thấp | Fallback tới server-side STT |
| Background noise | False transcript | Implement noise gate threshold |
| Privacy (gửi giọng nói lên server) | Data exposure | Chọn Web Speech API (client-side) ưu tiên |

---

### ý tưởng #17: AI Question Gap Report

**Ý tưởng:** Tìm ra những chủ đề người dùng hỏi nhiều nhưng trợ lý chưa thể trả lời tốt.

**AI thực hiện:** Phân cụm câu hỏi đã ẩn danh, phân tích lý do RAG thất bại và đề xuất tài liệu cần bổ sung.

**Dữ liệu cần có:** Nhật ký truy vấn đã ẩn danh, trạng thái truy xuất và phản hồi.

**Đầu ra:** Báo cáo khoảng trống tri thức theo chủ đề, kèm ưu tiên cập nhật.

**Độ khó:** Trung bơn

#### Tasks chi tiết

- [x] **Task 1**: Analytics — thu thập query + retrieval metadata ✅
  - Log: query text (anonymized), retrieved docs count, LLM response length, user feedback (thumb up/down)
  - Lưu vào SQLite `query_logs` (mới)
  - **Verify**: tsc ✅

- [x] **Task 2**: AI service `GET /api/ai/analytics/question-gaps` ✅
  - Cluster queries (TF-IDF + K-means trên anonymized text)
  - Identify low-retrieval queries (0 docs retrieved) + negative feedback
  - Trả về gap topics + suggested content
  - **Verify**: curl test ✅

- [x] **Task 3**: Frontend — `app/admin/question-gaps/page.tsx` (admin only) ✅
  - Gap topics table (sortable by frequency, feedback score)
  - Suggested documents to add
  - **Verify**: visual + auth check ✅

- [x] **Task 4**: Test + smoke test ✅
  - Python: `tests/test_question_gaps.py` (17 tests) ✅
  - Backend: `ai.service.spec.ts` (13 tests) ✅
  - Smoke test #21: `GET /api/ai/analytics/question-gaps?limit=10000` → 200 + gaps JSON

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Privacy (log query text) | Data exposure | Anonymize: hash user_id (SHA-256), strip personal info, TTL 30 days ✅ |
| Clustering chậm | Latency | Limit max 10k queries (`MAX_QUERY_LIMIT`), 24h in-process cache ✅ |
| False gaps (query rare but valid) | Noise | Minimum frequency threshold (≥5) — `gap_count >= 1` per cluster |

---

### ý tưởng #18: Resource Exchange AI

**Ý tượng:** Kết nối sách, máy tính, thiết bị hoặc thời gian tình nguyện dư thừa với nơi cần hỗ trợ.

**AI thực hiện:** AI ghép nhu cầu–nguồn cung, kiểm tra mức phù hợp và thuật toán tối ưu hóa lịch giao nhận.

**Dữ liệu cần có:** Kho tài nguyên, tình trạng thiết bị, địa điểm, chi phí và lịch.

**Đầu ra:** Các cặp cung–cầu đề xuất và kế hoạch vận chuyển.

**Độ khó:** Trung bình

#### Tasks chi tiết

- [x] **Task 1**: Backend schema — bảng `resources`, `resource_requests`, `resource_matches`
  - Resource: type (book, device, volunteer_hours), condition, location, available_from
  - Request: need_type, urgency, location, deadline
  - **Verify (done):** migration `1870000000000-CreateResourceExchangeTables.ts` + seed 4 resources/4 requests (DNTU, THCS Nguyễn Trãi, HCMUT) trong `sqlite-bootstrap.ts`. `tsc --noEmit` OK. `schema.sql` thêm bảng resources(32)/resource_requests(33)/resource_matches(34) + indexes.

- [x] **Task 2**: Backend service `ResourceMatchService`
  - `POST /api/resource-exchange/match` — nhận request, AI ghép với available resources (BFF `/api/resource-exchange/match` → backend → ai-service)
  - Scoring: proximity 40% + need_level 25% + resource_condition 25% + availability 10%
  - Pre-filter SQLite: type match + condition ≥ preferred_min + region match + cap 15 pairs trước khi gọi AI
  - Graceful degradation: AI fail → SQLite-scored pairs trả về với `degraded=true`, UI không bao giờ 502
  - **Verify (done):** `npx tsc --noEmit` OK; Jest 8/8 pass (`resource-exchange.service.spec.ts`).

- [x] **Task 3**: AI service `POST /api/ai/resource-exchange/match-rank`
  - LLM explain tại sao resource này match với request này (temperature=0.3)
  - Greedy transport scheduling: slot 2h, tránh xung đột resource/request, 24h TTL cache
  - **Verify (done):** `python3 -m py_compile` OK; `pytest tests/test_resource_exchange.py` 9/9 pass; no regression `test_impact_match.py`.

- [x] **Task 4**: Frontend — `app/resource-exchange/page.tsx`
  - Tab: Cung cấp / Cần nhận / Đã ghép + AI ghép nhanh
  - Match cards + explanation + contact button + transport plan table
  - Nav entry "Resource Exchange AI" → nhóm "Chợ & Đóng góp" trong `Sidebar.tsx`
  - **Verify (done):** `npx tsc --noEmit` OK; prettier --write applied.

- [x] **Task 5**: Test + smoke test
  - **Verify (done):** Backend Jest 8/8 (`resource-exchange.service.spec.ts`); AI pytest 9/9 (`test_resource_exchange.py`); smoke test #22 in §1.5.

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Trust (người lạ gặp nhau) | Safety | Verify user identity (JWT) + report/block system |
| Scheduling conflict | Inefficient | Use constraint-based scheduler (OR-Tools light) |
| Resource condition không tin cậy | Mismatch | Rating + photo verification, 5-star system |

---

### ý tưởng #19: AI Impact Measurement

**Ý tượng:** Đo lường việc hỗ trợ có thực sự cải thiện khả năng tiếp cận giáo dục hay không.

**AI thực hiện:** Tạo chỉ số trước–sau, phân tích xu hướng và khi đủ dữ liệu dùng thiết kế đánh giạ tác động phù hợp.

**Dữ liệu cần có:** Dữ liệu triển khai, lượt sử dụng, khảo sát, tình trạng thiết bị và khu vực phục vụ.

**Đầu ra:** Báo cáo người được tiếp cận, mức sử dụng và nhu cầu còn lại.

**Độ khó:** Trung bình–cao

#### Tasks chi tiết

- [ ] **Task 1**: Backend — `ImpactMeasurementService`
  - Trước/sau metrics: access_rate, usage_count, coverage_improvement
  - Dữ liệu nguồn: `map_points` (trước/sau thêm wifi, thư viện mới)
  - **Verify**: tsc

- [ ] **Task 2**: AI service `POST /api/ai/impact/measure`
  - So sánh trước/sau: diff trong số người trong bán kính 5km
  - Trend analysis: tăng trưởng theo thời gian
  - Trả về impact score + confidence interval
  - **Verify**: curl test

- [ ] **Task 3**: Frontend — `app/dashboard/impact/page.tsx`
  - Before/after charts (Chart.js)
  - Impact score dashboard
  - **Verify**: visual check

- [ ] **Task 4**: Test + smoke test

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Before/after data không có sẵn | Không đo lường được | Use synthetic before (baseline population × 0.7 access rate) |
| Confounding factors | Causal inference sai | Ghi chú limitations, đề xuất RCT |

---

### ý tưởng #20: Active Learning for Field Survey

**ý tưởng:** Giúp đội khảo sát chọn điểm cần xác minh tiếp theo để thu được thông tin hữu ích nhất.

**AI thực hiện:** Mô hình ước lượng độ không chắc chắn và giá trị thông tin của từng điểm, rồi xếp ưu tiên khảo sát.

**Dữ liệu cần có:** Bản đồ hiện có, độ tin cậy, chi phí khảo sát và phản hồi xác minh.

**Đầu ra:** Danh sách khảo sát ưu tiên giúp tiết kiệm thời gian và chi phí.

**Độ khó:** Cao

#### Tasks chi tiết

- [x] **Task 1**: `ai-service/services/survey_optimizer.py` (mới)
  - Uncertainty model: entropy-based trên dự báo gap density
  - Information value: expected reduction in gap uncertainty
  - Cost model: distance from current location + survey time
  - Priority score = info_value / cost
  - **Verify**: test với synthetic grid — **17/17 pytest pass; py_compile OK**.

- [x] **Task 2**: Router `routers/survey.py`
  - `POST /api/ai/survey/priorities` — nhận map_points + current_location, trả về ordered list
  - `POST /api/ai/survey/next` — trả về single best next point
  - 24h in-process cache + graceful static-fallback (real VN cells)
  - **Verify**: curl TestClient smoke — 200 + ranked FeatureCollection, cache hit, empty→degraded ✅

- [x] **Task 3**: Backend proxy
  - `backend GET /api/map/survey/priorities` + `GET /api/map/survey/next` (`map.controller.ts`, `@SkipThrottle`)
  - `map.service.ts`: `getSurveyPriorities`/`getSurveyNext` (POI fetch via `findAllPois` + proxy to ai-service, 3600s cache, degraded GeoJSON fallback)
  - **Verify**: backend tsc clean (0 errors); end-to-end curl backend→ai-service with real POIs returns 200 + ordered list (degraded=False); static-fallback degraded=True for empty DB ✅

- [x] **Task 4**: Frontend — `app/map/survey-planner/page.tsx`
  - Priority list (sortable) + map markers
  - Next point highlight + route
  - Twin-panel BFF → backend → ai-service chain; auth-gated (`useRequireAuth`)
  - **Verify**: frontend tsc clean (0 errors); sidebar "Kế hoạch khảo sát" entry + map toolbar button ✅

- [ ] **Task 5**: Test + smoke test

#### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Uncertainty model phức tạp | Latency | Use simpler entropy model, precompute |
| Cost function thiếu dữ liệu | Suboptimal | Default cost = distance + fixed overhead |
| Surveyor tại thực | Field constraints | Add user preference override |

---

## 4. Roadmap tổng thể

### Phase 1 — Nền tảng AI Agent (2-3 tuần)

| Tuần | Tasks | Mục tiêu |
|---|---|---|
| Tuần 1 | #2 Task 1-3 (map_agent, router, backend proxy) | Agent core: NL → tool calling |
| Tuần 2 | #2 Task 4-5 (frontend, test) + #4 Task 1-2 (Talk2Map parser, router) | Agent UI + Talk2Map |
| Tuần 3 | #4 Task 3-5 + #5 Task 1-2 (Data Quality) | Talk2Map complete + Data Quality start |

### Phase 2 — Phân tích & tối ưu (2-3 tuần)

| Tuần | Tasks | Mục tiêu |
|---|---|---|
| Tuần 4 | #5 Task 3-5 + #6 (Missing Data Hunter) | Data Quality + Data Hunter |
| Tuần 5 | #1 (Resource Optimizer) Task 1-3 | MCLP optimization core |
| Tuần 6 | #1 Task 4-5 + #3 (Gap Predictor) Task 1-2 | Resource Optimizer UI + Gap Predictor start |

### Phase 3 — Matching & cơ hội (2 tuần)

| Tuần | Tasks | Mục tiêu |
|---|---|---|
| Tuần 7 | #3 Task 3-5 + #8 (Knowledge Graph) Task 1-2 | Gap Predictor complete + KG start |
| Tuần 8 | #8 Task 3-5 + #9 (ImpactMatch) Task 1-2 | KG complete + ImpactMatch start |

### Phase 4 — Truy cập đa dạng (2 tuần)

| Tuần | Tasks | Mục tiêu |
|---|---|---|
| Tuần 9 | #9 Task 3-5 + #13 (Learning Space) Task 1-2 | ImpactMatch complete + Learning Space start |
| Tuần 10 | #13 Task 3-5 + #14 (Opportunity Radar) Task 1-2 | Learning Space complete + Opportunity start |

### Phase 5 — Nâng cao & nghiên cứu (3-4 tuần)

| Tuần | Tasks | Mục tiêu |
|---|---|---|
| Tuần 11 | #14 Task 3-5 + #11 (Climate Guardian) Task 1-2 | Opportunity complete + Climate start |
| Tuần 12 | #11 Task 3-5 + #12 (SafeRoute) Task 1-2 | Climate complete + SafeRoute start |
| Tuần 13 | #12 Task 3-5 + #7 (Edge AI Tutor) Task 1-3 | SafeRoute complete + Edge Tutor start |
| Tuần 14 | #7 Task 4-6 + #15 (Language Bridge) Task 1-2 | Edge Tutor complete + Language start |

### Phase 6 — Tính năng cao cấp (3 tuần)

| Tuần | Tasks | Mục tiêu |
|---|---|---|
| Tuần 15 | #15 Task 3-5 + #16 (Voice-to-Geo) Task 1-3 | Language complete + Voice start |
| Tuần 16 | #16 Task 4-5 + #17 (Question Gap) Task 1-2 | Voice complete + Question Gap start |
| Tuần 17 | #17 Task 3-5 + #18 (Resource Exchange) Task 1-2 | Question Gap complete + Resource start |
| Tuần 18 | #18 Task 3-5 + #19 (Impact Measurement) Task 1-2 | Resource complete + Impact start |
| Tuần 19 | #19 Task 3-5 + #20 (Active Learning) Task 1-2 | Impact complete + Active Learning start |
| Tuần 20 | #20 Task 3-5 | Active Learning complete |

---

## 5. Testing strategy

### 5.1 Python (AI service)

```bash
# Chạy từ local Docker container
cd /app/ai-service
python -m pytest tests/ -v

# Test specific module
python -m pytest tests/test_agent.py -v
python -m pytest tests/test_predictive_service.py -v
```

- **Unit tests**: tại `ai-service/tests/` (Jest-style pytest)
- **Integration tests**: mock SQLite + mock LLM provider
- **Coverage target**: ≥ 80% cho new code

### 5.2 Backend (NestJS)

```bash
cd /app/backend
npx nest build  # compilation check
npx jest --testPathPattern="ai.service.spec"  # unit tests
```

- **Unit tests**: `.spec.ts` files (Jest)
- **E2E tests**: `test/app.e2e-spec.ts`
- **Type check**: `npx tsc --noEmit`
- **Coverage**: `npm run test:cov`

### 5.3 Frontend (Next.js)

```bash
cd /app/frontend
npx tsc --noEmit  # type check
npx next lint     # lint
```

- **Type check**: `npx tsc --noEmit` (exit 0 required)
- **Build**: `npm run build`
- **Accessibility**: Lighthouse audit

### 5.4 Smoke tests (sau mỗi deploy HF Spaces)

Mở rộng từ 11 tests hiện tại → thêm tests cho từng feature mới:

| Feature | Test endpoint | Expected |
|---|---|---|
| #1 Resource Optimizer | `GET /api/map/resource-optimization?...` | 200 + GeoJSON |
| #2 AI Agent | `POST /api/ai/agent/chat` | 200 + reply + tool_calls |
| #4 Talk2Map | `POST /api/ai/map/query` | 200 + structured |
| #5 Data Quality | `GET /api/admin/data-quality?table=...` | 200 + anomalies |
| #6 Data Hunter | `POST /api/ai/data/gaps` | 200 + GeoJSON |
| #7 Edge Tutor | `POST /api/offline/tutor` | 200 + response |
| #8 Knowledge Graph | `GET /api/knowledge/graph/:id` | 200 + graph JSON |
| #9 ImpactMatch | `GET /api/impactmatch/suggestions?...` | 200 + matches |
| #12 SafeRoute | `GET /api/map/safe-route?...` | 200 + routes |
| #13 Learning Space | `GET /api/learning-spots/recommend?...` | 200 + ranked + explain |
| #14 Opportunity | `POST /api/ai/opportunity/match` | 200 + matches |
| #15 Language Bridge | `POST /api/ai/language/simplify` | 200 + simplified |
| #16 Voice-to-Geo | `POST /api/ai/speech/to-text` | 200 + text |
| #17 Question Gap | `GET /api/ai/analytics/question-gaps` | 200 + gaps |
| #18 Resource Exchange | `POST /api/resources/match` | 200 + matches |
| #19 Impact Measurement | `POST /api/ai/impact/measure` | 200 + metrics |
| #20 Active Learning | `POST /api/ai/survey/priorities` | 200 + ordered list |

---

## 6. Rủi ro hệ thống & mitigations tổng thể

| Risk | Impact | Mitigation |
|---|---|---|
| HF Spaces CPU quá chậm với nhiều AI features | Latency, timeout | Caching aggressive (NestJS in-memory), max 1 concurrent AI request |
| Memory pressure (ChromaDB + LLM + SQLite) | OOM kill | Monitor memory in `start.sh`, restart policy trong supervisord |
| IPv6 blackhole kéo dài | All outbound HTTP fail | `curl --ipv4 --insecure` everywhere, `AI_FORCE_IPV4=true` |
| Cloudflare TLS blocked | Workers AI unusable | Circuit breaker 5phút, provider chain fallback |
| Docker build time tăng (thêm deps) | Deploy chậm | Chỉ sửa requirements.txt khi cần, cache layers |
| Disk full (ChromaDB + uploads) | Crash | Ephemeral `/tmp` for ChromaDB, periodic cleanup script |
| HF Spaces không auto-deploy | Stale | CI/CD `.github/workflows/deploy-hf.yml` tự động sync |
| Data inconsistency (SQLite vs PostgreSQL schemas) | Bugs | `verify_db.py` ensures schema, ILIKE→LIKE chuẩn SQL |

---

## 7. File deliverables

Kế hoạch này sẽ tạo ra các file sau:

```
tasks/
├── ai-ideas-plan.md          ← Kế hoạch này (master plan)
├── todo.md                   ← Task list theo Phase (tự động tạo)
└── (mỗi phase sẽ có plan riêng nếu cần)

ai-service/
├── agents/
│   └── map_agent.py          ← #2 EduMap AI Agent
├── services/
│   ├── resource_optimizer.py ← #1 MCLP
│   ├── data_quality.py       ← #5 Anomaly Detector
│   ├── knowledge_graph.py    ← #8 Knowledge Graph
│   └── survey_optimizer.py   ← #20 Active Learning
├── routers/
│   ├── agent.py              ← #2, #4 Talk2Map
│   ├── resource.py           ← #1
│   ├── data_quality.py       ← #5
│   ├── gap_predictor.py      ← #3 (hoặc mở rộng geo.py)
│   ├── data_hunter.py        ← #6
│   ├── offline_tutor.py      ← #7
│   ├── knowledge.py          ← #8
│   ├── impactmatch.py        ← #9
│   ├── climate.py            ← #11
│   ├── learning_space.py       ← #13
│   ├── opportunity.py        ← #14
│   ├── language.py           ← #15
│   ├── speech.py             ← #16
│   ├── question_gaps.py      ← #17
│   ├── resource_exchange.py  ← #18
│   ├── impact_measure.py     ← #19
│   └── survey.py             ← #20
└── tests/
    ├── test_agent.py         ← #2
    ├── test_resource_optimizer.py ← #1
    ├── test_data_quality.py  ← #5
    └── ... (tương ứng mỗi feature)

backend/src/
├── modules/
│   ├── map/map.controller.ts (extensions)
│   ├── ai/agents.service.ts  ← #2, #4
│   └── ... (services cho từng feature)
└── (entity/schema updates cho #8, #9, #18)

frontend/
├── app/
│   ├── ai-agent/page.tsx         ← #2
│   ├── talk2map/page.tsx         ← #4
│   ├── map/resource-optimizer/   ← #1
│   ├── admin/data-quality/       ← #5
│   ├── knowledge-graph/          ← #8
│   ├── impact-match/             ← #9
│   ├── climate-guardian/         ← #11
│   ├── map/safe-route/           ← #12 (extension)
│   ├── learning-spaces/          ← #13 (filter panel + map)
│   ├── opportunities/radar/      ← #14 (extension)
│   ├── language-bridge/          ← #15
│   ├── voice-search/             ← #16
│   ├── dashboard/question-gaps/  ← #17
│   ├── resource-exchange/        ← #18
│   ├── dashboard/impact/         ← #19
│   └── map/survey-planner/       ← #20
```

---

## 8. Kết luận

Kế hoạch này được thiết kế để:
1. **Tận dụng tối đa infrastructure hiện có** (supervisord, SQLite, ChromaDB, LLM provider chain)
2. **Tương thích hoàn toàn với HF Spaces constraints** (single container, CPU-basic, IPv6, ephemeral storage)
3. **Phát triển incrementally** — mỗi feature là một vertical slice (AI service + backend proxy + frontend UI + test)
4. **Graceful degradation** — mọi feature đều có fallback khi thiếu dữ liệu, thiếu API key, hoặc model fail
5. **Local = code only** — developer viết code + test local Docker, CI/CD tự động sync lên HF Spaces

**Chu trình làm việc đề xuất:**
1. Mỗi Phase: implement 1 feature end-to-end (từ ai-service → backend → frontend → test)
2. Local build + test: `docker build -t edumap-hf:latest . && docker run ...`
3. Smoke test 11 tests + feature-specific test
4. Commit + push GitHub main → CI/CD auto-deploy to HF Spaces
5. Verify trên https://huggingface.co/spaces/tancse2005/Edumap
```
