# HF Spaces — Kế hoạch triển khai 8 cải tiến

> **Status**: Phương án triển khai trên HF Spaces (single Docker container via supervisord)
> **Ngày**: 2026-10-25
> **Dựa trên**: `/home/ngoctan/Desktop/cải thiện edumap.md` + `IMPROVEMENT_PLAN.md`

---

## ✅ ĐÃ HOÀN THẠNH (trước khi bắt đầu 8 features)

| Task | Status | Commit |
|------|--------|--------|
| Fix career/roadmap: thêm Authorization header | ✅ | `8c898b6` |
| Fix library summary: OpenRouter `curl --ipv4 --insecure` | ✅ | `8c898b6` |
| Fix learning-path: `AI_SERVICE_URL` + `String(userId)` | ✅ | `8c898b6` |
| Remove career/quiz route + sidebar link | ✅ | `8c898b6` |
| Switch primary LLM: Gemini → OpenRouter | ✅ | `8c898b6` |
| Fix RAG embedding chain: add OpenRouter embeddings + graceful degradation | ✅ | `c27d45b` |
| Update `.env`, `.env.example`, `spacers.yaml`, `start.sh` | ✅ | `c27d45b` |
| Verify compile: Python ✅, Frontend TS ✅, Backend TS ✅ | ✅ | — |

### RAG fix chi tiết (đã deploy trong commit `c27d45b`)

**Vấn đề**: Bot hiện "Lỗi kết nối kho dữ liệu" vì embedding chain chỉ có Gemini (key hết hạn) + Cloudflare (TLS bị chặn) → hết provider → `query()` crash → error string được inject vào prompt.

**Giải pháp**:
1. **`vector_store.py`**: Thêm `_openrouter_get_embedding()` — gọi `curl --ipv4 --insecure` tới `POST /v1/embeddings`
2. **`vector_store.py`**: `get_embedding()` thử OpenRouter **trước** Gemini/Cloudflare/HF/NVIDIA
3. **`vector_store.py`**: `query()` trả về empty results khi `collection is None` (graceful degradation)
4. **`vector_store.py`**: `search_similar()` return `[]` thay vì raise
5. **`llm_service.py`**: `chat_with_rag()` — set `docs_str` thông báo thân thiện thay vì "Lỗi kết nối kho dữ liệu"

```
Embedding chain sau fix:
  1. OpenRouter  (/v1/embeddings, curl) ← NEW PRIMARY
  2. Gemini      (embedContent, curl)
  3. Cloudflare  (Workers AI, urllib)
  4. HF Inference API (requests)
  5. NVIDIA NIM  (urllib)

Fallback: nếu TẤT CẢ fail → RAG skip, AI trả lời từ knowledge + history
```

---

## Kiến trúc HF Spaces hiện tại

| Service | Port | Tech | Storage |
|---------|------|------|---------|
| Frontend | 7680 (public) | Next.js 14 (SSR) | Static `/app/frontend/public/edumap.db` |
| Backend | 3000 (internal) | NestJS 10 | SQLite (read-write at runtime) |
| AI Service | 8000 (internal) | FastAPI + uvicorn | ChromaDB in-memory (`/tmp/chroma_db`) |
| Job Crawler | — | Python stdlib | SQLite |

**HF Spaces secrets** (set via UI → Settings → Secrets, NOT in repo):
```
JWT_SECRET, GOOGLE_CLIENT_ID, OPENROUTER_API_KEY, OPENROUTER_MODEL,
OPENROUTER_EMBEDDING_MODEL, GEMINI_API_KEY, NVIDIA_API_KEY,
CLOUDFLARE_API_TOKEN, HF_TOKEN, ORS_API_KEY,
ADZUNA_APP_ID, ADZUNA_APP_KEY
```

---

## HF Spaces constraints

| Constraint | Impact | Workaround |
|-----------|--------|------------|
| Single container, supervisord | Cannot run separate services (Redis, OSRM, Postgres) | In-memory cache, ORS API, SQLite |
| CPU: cpu-basic (1 vCPU) | Slow inference | Prefer lightweight models, caching |
| IPv6 blackhole | urllib/requests timeout | `curl --ipv4 --insecure` (✅ đã fix) |
| Cloudflare TLS blocked | Cannot use Cloudflare Workers AI | Skip, fallback to OpenRouter/Gemini/HF |
| ChromaDB ephemeral | Vector DB wiped on restart | Seed at startup (`seed_vector_db.py`) |
| No Redis | Cache + Socket.IO adapter | In-memory LRU (NestJS cache-manager) ✅ |
| No OSRM | Local routing server unavailable | Use ORS API (`ORS_API_KEY`) |
| Filesystem read-only except `/tmp`, `/app/uploads` | Cannot persist new data | SQLite write OK at `/app/frontend/public/edumap.db` |
| Docker layers cached | Rebuild chậm khi thay đổi requirements.txt | Chỉ sửa requirements.txt khi thật sự cần thiết |

---

## Phương án triển khai từng tính năng (+ lệnh terminal)

### 1. Dự đoán nghề nghiệp — Semantic Matching (🔴 Cao)

**Hiện trạng**: Career `/career/roadmap` dựa vào keyword matching + template.

**Phương án**: Thêm OpenRouter embedding vào semantic career matching.

**Commands**:
```bash
# 1. Tạo seed data cho collection 'careers' trong ChromaDB
# Seed từ Adzuna API (IT jobs) + existing career data
python3 ai-service/seed_vector_db.py --collection careers --source adzuna

# 2. Tạo endpoint FastAPI: POST /api/ai/career/semantic-match
# File: ai-service/routers/career.py
cat >> ai-service/routers/career.py << 'EOF'

@router.post("/semantic-match")
async def semantic_match(data: SemanticMatchRequest):
    from services.vector_store import vector_store
    vec = await asyncio.to_thread(vector_store.get_embedding, data.interest_text)
    results = vector_store.collection.query(
        query_embeddings=[vec], n_results=5,
        where={"category": data.category} if data.category else None
    )
    return {"matches": format_results(results)}
EOF
```

**HF Spaces considerations**:
- ChromaDB seed tại startup (~5-10s)
- Query ~2-3s (chỉ embedding + vector search, không cần OpenRouter LLM)
- Cache NestJS in-memory (TTL 300s)

---

### 2. Xu hưởng thị trường lao động — Adzuna (🟡 Trung)

**Phương án**: Set secrets + frontend component.

**Commands**:
```bash
# Chỉ cần set secrets trên HF Spaces UI:
#   ADZUNA_APP_ID, ADZUNA_APP_KEY, ADZUNA_COUNTRY=vn

# Frontend: thêm component Adzuna trends
# File: frontend/components/AdzunaTrends.tsx
grep -l "adzuna\|AdzunaTrends\|job-trend" frontend/components/ -rl

# Verify backend AdzunaService đã có
grep -n "adzuna\|Adzuna" backend/src/modules/ -rl
```

**HF Spaces considerations**:
- Adzuna API từ backend (port 3000) — egress OK
- Cache TTL 3600s trong NestJS
- Free tier: 5000 requests/tháng

---

### 3. Dự báo tăng trưởng giáo dục — Time-series (🟢 Thấp)

**Phương án**: Thêm `statsmodels` + ARIMA forecast.

**Commands**:
```bash
# 1. Thêm statsmodels vào requirements.txt
echo "statsmodels>=4.0" >> ai-service/requirements.txt

# 2. Tạo router forecast
# File: ai-service/routers/forecast.py
touch ai-service/routers/forecast.py

# 3. Register router trong main.py
# Thêm vào ai-service/main.py:
sed -i 's/from routers.career import router as career_router/from routers.forecast import router as forecast_router/' ai-service/main.py

# 4. Rebuild Docker (cần thiết — thay đổi Python deps)
docker compose build --no-cache ai-service
```

**HF Spaces considerations**:
- `statsmodels` ~30MB → tăng build ~1-2 phút
- ARIMA fit ~1-2s trên CPU ✅
- Cache TTL 86400s (24h)

---

### 4. Chatbot RAG — SSE + memory (🟡 Trung)

**Phương án**: Streaming SSE + SQLite session memory.

**Commands**:
```bash
# 1. Tạo SSE endpoint trong chat.py
# File: ai-service/routers/chat.py
# Thêm: POST /api/ai/chat/stream (yield JSON chunks via text/event-stream)

# 2. Tạo BFF proxy route
# File: frontend/app/api/ai/chat/stream/route.ts
mkdir -p frontend/app/api/ai/chat/stream
touch frontend/app/api/ai/chat/stream/route.ts

# 3. Sửa frontend ai-chat page để dùng EventSource
grep -n "fetch\|EventSource\|chat_api\|/api/ai/chat" frontend/app/ai-chat/page.tsx | head -5

# 4. Kiểm tra SQLite schema có chat_sessions table không
grep -n "chat_sessions\|session" backend/src/database/schema.sql | head -5
```

**HF Spaces considerations**:
- SSE qua Next.js BFF — giữ ở Node.js runtime (không Edge)
- SQLite `chat_sessions` table already in schema ✅
- OpenRouter streaming: `curl --ipv4 --insecure --stream`

---

### 5. Auto-embed khi thêm sách (🟡 Trung)

**Hiện trạng**: ChromaDB seed 1 lần tại startup, crawl không trigger embed.

**Phương án**: Backend hook → AI service embed API.

**Commands**:
```bash
# 1. Tạo endpoint FastAPI: POST /api/ai/embed (batch)
# File: ai-service/routers/library.py
cat >> ai-service/routers/library.py << 'EOF'

@router.post("/embed")
async def embed_documents(docs: List[EmbedRequest]):
    from services.vector_store import vector_store
    embeddings = [vector_store.get_embedding(d.text) for d in docs]
    vector_store.collection.upsert(
        documents=[d.text for d in docs],
        embeddings=embeddings,
        metadatas=[d.metadata for d in docs],
        ids=[d.id for d in docs]
    )
    return {"status": "ok", "count": len(docs)}
EOF

# 2. Hook vào backend library.service.ts
# File: backend/src/modules/library/library.service.ts
grep -n "create\|insert\|save" backend/src/modules/library/library.service.ts | head -5

# 3. Cập nhật seed_vector_db.py để include books
grep -n "edumap_docs\|books\|seed" ai-service/seed_vector_db.py | head -10
```

**HF Spaces considerations**:
- Backend → AI service nội bộ (`http://127.0.0.1:8000`) — không qua internet ✅
- Batch embed 100 sách: ~30-60s → async background job
- ChromaDB ephemeral → re-seed tại startup, incremental embed tại runtime

---

### 6. Mentor/scholarship pre-filter (🟡 Trung)

**Hiện trạng**: Gửi full mentor list vào prompt.

**Phương án**: SQL WHERE filter trước khi gửi prompt.

**Commands**:
```bash
# 1. Sửa backend career.service.ts
# File: backend/src/modules/career/career.service.ts
grep -n "mentor\|filter\|recommend" backend/src/modules/career/career.service.ts | head -10

# Thêm WHERE clause:
#   specialty ILIKE '%keyword%', rating_avg > 3.0, is_verified = true
#   LIMIT 10

# 2. Frontend: thêm filter UI
# File: frontend/app/career/page.tsx (hoặc recommendation component)
grep -rn "mentor\|recommend" frontend/app/career/ --include="*.tsx" | head -10
```

**HF Spaces considerations**:
- SQLite query <10ms ✅
- Giảm token input → giảm latency + chi phí OpenRouter

---

### 7. GeoAI → GeoJSON (🟡 Trung)

**Hiện trạng**: `analyze_geo_density` trả về format tùy chỉnh.

**Phương án**: Chuyển output thành GeoJSON FeatureCollection.

**Commands**:
```bash
# 1. Sửa models/geo_models.py — thêm GeoJSON response type
# File: ai-service/models/geo_models.py
grep -n "class\|GeoDensity\|return" ai-service/models/geo_models.py | head -10

# 2. Sửa llm_service.analyze_geo_density() — return GeoJSON format
grep -n "analyze_geo_density\|def " ai-service/services/llm_service.py | head -20

# 3. Sửa router geo.py — trả về GeoJSON
# File: ai-service/routers/geo.py
grep -n "def analyze_geo_density\|return\|jsonify\|JSONResponse" ai-service/routers/geo.py

# 4. Frontend — dùng L.geoJSON() để render
grep -rn "geo\|density\|heatmap\|map" frontend/app/ --include="*.tsx" | head -10
```

**HF Spaces considerations**:
- GeoJSON format chuẩn → Leaflet hỗ trợ sẵn ✅
- Output nhỏ gọn → không ảnh hưởng latency

---

### 8. Vẽ tuyến đường trên bản đồ — OSRM → ORS (🔴 Cao)

**Hiện trạng**: `routing.service.ts` dùng ORS API (fallback), `OSRM_URL` bị sai (`http://127.0.0.1:8000`).

**Phương án**: Fix ORS integration, loại bỏ OSRM dependency.

**Commands**:
```bash
# 1. Sửa Dockerfile — OSRM_URL không cần thiết trên HF Spaces
# Hiện tại: ENV OSRM_URL=http://127.0.0.1:8000 (sai!)
# Sửa: ENV OSRM_URL=
grep -n "OSRM_URL" Dockerfile

# 2. Sửa routing.service.ts — bỏ OSRM fallback, chỉ dùng ORS
# File: backend/src/modules/map/routing.service.ts
sed -i 's|this.osrmUrl||g' backend/src/modules/map/routing.service.ts

# 3. Set ORS_API_KEY trên HF Spaces UI
#   ORS_API_KEY=<your_key> (get from openrouteservice.org)

# 4. Frontend — render ORS route polyline trên Mapbox
grep -rn "Mapbox\|mapbox\|polyline\|route" frontend/app/map/ --include="*.tsx" | head -10
```

**HF Spaces considerations**:
- ORS API: 2,000 requests/ngày (free tier) — đủ cho demo
- `ORS_API_KEY` secret via HF Spaces UI
- Cần `ORS_URL=https://api.openrouteservice.org` (default, đã có trong code)

---

## Roadmap triển khai (phases)

### Phase 1 — Critical (1-2 ngày)
| # | Tính năng | Effort | Files |
|---|----------|--------|-------|
| 8 | Fix routing (ORS) | 30p | `routing.service.ts`, `Dockerfile` |
| 1 | Semantic career matching | 3h | `career.py`, `career.service.ts`, `seed_vector_db.py`, frontend |
| 4 | Chat SSE streaming | 4h | `chat.py:stream`, `chat/stream/route.ts`, `page.tsx` |

### Phase 2 — Medium (2-4 ngày)
| # | Tính năng | Effort | Files |
|---|----------|--------|-------|
| 2 | Adzuna job trends | 2h | Set secrets, frontend component |
| 5 | Auto-embed | 3h | `library.py:embed`, `library.service.ts`, seed update |
| 6 | Mentor pre-filter | 2h | `career.service.ts`, frontend filter |
| 7 | GeoAI → GeoJSON | 2h | `geo_models.py`, `geo.py`, `llm_service.py`, frontend |

### Phase 3 — Low (1-2 ngày)
| # | Tính năng | Effort | Files |
|---|----------|--------|-------|
| 3 | Time-series forecast | 4h | `requirements.txt`, `router/forecast.py`, frontend chart |

---

## Deployment checklist (HF Spaces)

1. ✅ RAG fix committed (`c27d45b`) — OpenRouter embeddings + graceful degradation
2. ✅ Primary LLM = OpenRouter (Gemini removed from text generation)
3. 🔄 Implement 8 features theo roadmap trên
4. 🔄 **Build & test locally**: `docker compose up --build` → verify endpoints
5. 🔄 **Set HF Spaces secrets** (qua UI):
   - `OPENROUTER_API_KEY` ✅ (primary LLM)
   - `OPENROUTER_EMBEDDING_MODEL` (RAG embeddings)
   - `ORS_API_KEY` (routing)
   - `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (job trends)
   - `GEMINI_API_KEY` (embeddings fallback)
6. 🔄 **Update `start.sh`**: đã thêm `OPENROUTER_API_KEY`, `NVIDIA_API_KEY` vào SECRET_VARS ✅
7. 🔄 **Push to GitHub**: `git push origin main` → GitHub Actions `deploy-hf.yml` auto-sync
8. 🔄 **Verify on HF Spaces**:
   - `POST /api/ai/chat` → 200, real AI response (không lỗi RAG)
   - `GET /career/quiz` → 404
   - `POST /api/ai/career/semantic-match` → 200, career matches
   - `POST /api/ai/chat/stream` → SSE streaming
   - `POST /api/map/route` → GeoJSON route
   - `GET /api/ai/geo/density` → GeoJSON FeatureCollection

### Lệnh deploy

```bash
# 1. Commit all changes
git add -A && git commit -m "feat: 8 improvements for HF Spaces"

# 2. Push — GitHub Actions sẽ auto-deploy lên HF Spaces
git push origin main

# 3. Hoặc deploy trực tiếp lên HF (nếu có HF_TOKEN)
git push hf main
```

> ⚠️ **Không thể tự động deploy** trong session này — không có `HF_TOKEN` hay GitHub credentials.
> User cần tự thực hiện `git push origin main` để CI/CD deploy.
