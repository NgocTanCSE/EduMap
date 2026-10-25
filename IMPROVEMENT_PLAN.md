# 📋 Kế hoạch Cải tiến EduMap

> **Nguồn**: File đề xuất từ người dùng (`/home/ngoctan/Desktop/cải thiện edumap.md`)  
> **Ngày**: 2026-10-25  
> **Trạng thái**: Đã phân tích, đang triển khai

## 1. Tóm tắt đề xuất

Tác giả đề xuất 8 cải tiến AI + UI optimization + tính năng vẽ đường đi trên bản đồ:

| STT | Phạm vi | Đề xuất | Trạng thái |
|-----|---------|---------|------------|
| 1 | Dự đoán nghề nghiệp | Nâng cấp từ if-else → ML/semantic vector matching | 🟡 Chưa làm |
| 2 | Xu hướng thị trường việc làm | Kết nốu real job data (Adzuna) | 🟡 Template |
| 3 | Dự báo tăng trưởng giáo dục | Áp dụng time-series forecasting | 🟡 Dùng hệ số tĩnh |
| 4 | Chatbot RAG | Streaming SSE + session memory + tối ưu ChromaDB | 🟡 Chưa có SSE |
| 5 | Đồng bộ KB tri thức | Auto-embed khi có sách/mới | 🟡 Manual |
| 6 | Ghép mentor & học bổng | Pre-filter theo khoảng cách/chuyên ngành + đọc PDF | 🟡 Đẩy toàn bộ vào prompt |
| 7 | Phân tích mật độ trường học (GeoAI) | Trả về GeoJSON để vẽ trên bản đồ | 🟡 Chưa liên kết bản đồ |
| 8 | Map route-drawing | Vẽ đường đi trên bản đồ | 🟡 Chưa có |

---

## 2. Phân tích chi tiết từng tính năng

### 2.1. Dự đoán nghề nghiệp (Career Prediction)

**Trạng thái hiện tại**: Dùng if-else dò từ khóa trong `career.service.ts` / backend `career.service.ts`.

**Đề xuất**: Nâng cấp lên mô hình học máy / so khớp vector ngữ nghĩa.

**Phân tích**:
- Hệ thống đã có sẵn `vector_store.py` với ChromaDB + Gemini embeddings
- Có thể tận dụng semantic search thay vì if-else
- Endpoint hiện tại: `/api/career/suggest` → backend gọi `aiService.predictCareerPath()` → ai-service

**Kế hoạch**:
- Tạo bảng `career_paths` với vector embedding trong ChromaDB
- Khi người dùng nhập kỹ năng, embed input → tìm cosine similarity trong ChromaDB
- Trả về top-N career gần nhất

### 2.2. Xu hướng thị trường việc làm (Job Market Trends)

**Trạng thái hiện tại**: `ai-service/routers/career.py` → `trend_analysis` endpoint, nhưng hàm trả về template.

**Đề xuất**: Kết nối nguồn dữ liệu tuyển dụng thực (Adzuna).

**Phân tích**:
- `.env` đã có `ADZUNA_APP_ID` và `ADZUNA_APP_KEY` (cấu hình cho HF Spaces)
- `ai-service/main.py` có probe Adzuna tại startup
- Tuy nhiên trên HF Spaces, `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` chưa được set → fallback SQLite

**Kế hoạch**:
- Set `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` làm HF Spaces secrets
- Implement `trend_analysis` để gọi Adzuna API thực tế
- Cache kết quả trong SQLite local để giảm số lượt gọi

### 2.3. Dự báo tăng trưởng giáo dục (Education Growth Forecast)

**Trạng thái hiện tại**: Dùng phép tính tăng trư�ởng số học hệ số tĩnh.

**Đề xuất**: Áp dụng mô hình time-series forecasting.

**Kế hoạch**:
- Sử dụng Prophet hoặc ARIMA từ thư viện `statsmodels`/`pmdarima`
- Train model từ lịch sử dữ liệu giáo dục (số trường, số sinh viên theo năm)
- Deploy model dưới dạng serialized pickle trên HF Spaces

### 2.4. Chatbot RAG (Streaming + Session Memory)

**Trạng thái hiện tại**: `chat_with_rag` trong `llm_service.py`, không có streaming, context lấy từ SQL hardcode.

**Đề xuất**: Streaming response (SSE) + session memory.

**Kế hoá**:
- Thay `subprocess.run` bằng streaming curl hoặc generator
- Lưu trữ session chat trong SQLite `chat_sessions` table
- Frontend sử dụng `EventSource` (SSE) để nhận streaming

### 2.5. Đồng bộ cơ sở tri thức (Auto-embed)

**Trạng thái hiện tại**: Manual trigger để embed sách/mới vào ChromaDB.

**Đề xuất**: Tự động embed khi có sách mới.

**Kế hoạch**:
- Tạo trigger trong `library.service.ts` (backend) — khi thêm sách mới → gọi ai-service embed
- Hoặc dùng message queue (Redis) để async embed

### 2.6. Ghép mentor & học bản (Mentor Matching + Scholarship Screening) ✅ Hoàn thiện

**Trạng thái**: 3-layer token-overflow defense + geographic & specialty pre-filter + PDF transcript — all verified ✅ (2026-10-25).

**Đề xuất**: Pre-filter trước (khoảng cách, chuyên ngành) + đọc file PDF bảng điểm. → Đã hoàn thành.

**Kế hoạch (đã hoàn thành 2026-10-25)**:
- Layer 1 — DB pre-filter (mentor.service.ts): filter verified mentors by specialty (LOWER LIKE) + region (LOWER(location) LIKE) + ORDER BY rating_avg DESC LIMIT 15. SQLite + PostgreSQL compatible.
- Geographic pre-filter (cự ly): added `location` column to mentors + users entities, migration 1840000000000-AddMentorLocation, sqlite-bootstrap.ts self-heal. MentorPage passes activeCategory (specialty) + user.location (region).
- Layer 2 — LLM safety cap (llm_service.py): slice [:max_mentors] before serialize.
- Layer 3 — Pydantic fix (mentor_models.py): MentorProfile accepts id alias for mentor_id, all fields optional. MatchRequest has student_region, student_specialty, max_mentors.
- BFF POST handler (check-eligibility/route.ts): forward body (transcript) + Authorization header.
- Frontend detail page PDF UI (scholarships/[id]/page.tsx): upload PDF → pass to checkEligibility.
- Frontend list page PDF UI (scholarships/page.tsx): handlePdfUpload → pdfTranscript state.
- Backend scholarship service: passes transcriptData to aiService.checkScholarshipEligibility.
- AI service PDF transcript (pdf_transcript.py): pypdf + regex parse GPA/courses/grades.
- Frontend mentor service: getRecommendations(userId, { specialty, region }).
- Tests: 6/6 Jest mentor tests pass, 12/12 Python AI tests pass. Backend tsc --noEmit exit 0. Frontend tsc --noEmit exit 0.
- ADR: docs/decisions/ADR-006-mentor-matching-pre-filter.md

### 2.7. Phân tích mật độ trường học (GeoAI)

**Trạng thái hiện tại**: DBSCAN clustering chạy nhưng không trả về GeoJSON.

**Đề xuất**: Trả về GeoJSON để vẽ trên bản đồ.

**Kế hoạch**:
- Đổi output format của `analyze_geo_density` thành GeoJSON
- Frontend sử dụng Mapbox/Leaflet để render cluster boundaries
- Kết nối với `ai-service/routers/geo.py`

### 2.8. Vẽ đường đi trên bản đồ (Route Drawing)

**Trạng thái hiện tại**: Chỉ hiện danh sách lộ trình, chưa vẽ đường trên bản đồ.

**Đề xuất**: Thêm tính năng vẽ route.

**Kế hoạch**:
- Thêm OSRM routing endpoint trong backend
- Frontend: khi người dùng chọn 2 điểm → gọi OSRM → vẽ polyline trên bản đồ
- Lưu route vào session để quay lại

---

## 3. Đánh giá UI chung

**Nhận xét**: "T thấy web giờ cũng khá tính năng AI rồi, giờ có vẽ thêm thì cũng chỉ quanh quẩn mấy cái phân tích dữ liệu thôi. Cái cơ chế RAG kéo API 2 luồng kiểu này thì tới đó là kịch kim rồi, làm thêm cũng chẳng khác mấy. Giờ cứ rà lại toàn bộ web rồi tối ưu thôi: UI chỗ nào bể hoặc thiếu thì tút lại, tiện tay tối ưu luôn mấy luồng AI cho mượt là đẹp."

**Kế hoạch**:
- Audit toàn bộ route/frontend để tìm UI bị lỗi/thiếu
- Kiểm tra responsive, accessibility (WCAG)
- Tối ưu cách gọi AI: tránh gọi song song, caching, reduce timeout

---

## 4. Phân loại theo độ ưu tiên

| Mức độ | Tính năng | Lý do |
|--------|-----------|-------|
| 🔴 Cao | Fix career/roadmap auth ( không gửi token) | Bug blocking chức năng chính |
| 🔴 Cao | Fix _generate_text_with_fallback provider order (Gemini first) | Làm chậm/tiết kiệm AI 95s → ~5s |
| 🔴 Cao | Fix _openrouter_generate (dùng curl) | OpenRouter trả về empty response |
| 🟢 Thấp | 6. Mentor matching + scholarship screening | ✅ Hoàn thiện (3-layer defense + DB pre-filter by region & specialty + PDF transcript) |
| 🟡 Trung | Dự đoán nghề nghiệp (semantic vector) | Cải thiện chất lượng |
| 🟡 Trung | Streaming SSE cho chat | UX tốt hơn |
| 🟢 Thấp | Time-series forecast | Phức tạp, cần data lịch sử |
| 🟢 Thấp | PDF transcript reader | Phụ thuộc tính năng học bổng |

---

## 5. Nhật ký thay đổi (Changelog)

### 2026-10-25 — Fix AI connectivity & auth + Switch to OpenRouter

| File | Thay đổi |
|------|----------|
| `ai-service/services/llm_service.py` | **Switch primary LLM provider từ Gemini → OpenRouter** (theo yêu cầu người dùng: "loại bỏ AI của gemini, để lại openrouter"). OpenRouter được thử đầu tiên trong cả `_generate_text_with_fallback` và `chat_with_rag`. |
| `ai-service/services/llm_service.py` | Fix `_openrouter_generate`: dùng `curl --ipv4 --insecure` thay vì `urllib.request.urlopen` (bypass IPv6 blackhole trên HF Spaces). |
| `ai-service/services/llm_service.py` | Fix `_nvidia_generate`: dùng `curl --ipv4 --insecure` thay vì `urllib.request.urlopen`. |
| `ai-service/services/llm_service.py` | Xóa block "Phan 0: Google Gemini" khỏi `_cloudflare_generate` (Gemini không còn được gọi ở bất kỳ đâu trong text generation chain). Cập nhật docstrings, error messages, preflight check. |
| `frontend/app/api/ai/learning-path/route.ts` | Fix `AI_SERVICE_URL` fallback: `http://ai-service:8000` → `http://127.0.0.1:8000`. Ép `user_id: String(userId)`. |
| `frontend/app/career/roadmap/page.tsx` | Thêm `Authorization: Bearer ${token}` — nguyên nhân chính career/roadmap "gọi AI không được". |
| `frontend/app/career/quiz/page.tsx` | **XÓA** (theo yêu cầu người dùng). |
| `frontend/components/Sidebar.tsx` | XÓA menu "Câu đố nghề nghiệp" + import `HelpCircle`. |
| `.env.example` + `.env` | Thêm `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `NVIDIA_API_KEY`. Cập nhật comment Gemini (giờ là fallback chứ không phải primary). |
| `spacers.yaml` | `OPENROUTER_API_KEY` lên primary secret (được khuyến nghị). |

### 2026-10-25b — Hardening OpenRouter + NVIDIA circuit breakers & error parsing

| File | Thay đổi |
|------|----------|
| `ai-service/services/llm_service.py` | **Fix `_nvidia_generate` bị đổi tên thành `_generate_text_with_fallback`** bởi process bên ngoài — gây `AttributeError` khi fallback chain gọi `self._nvidia_generate()`. Đã rename lại đúng tên. |
| `ai-service/services/llm_service.py` | **Thêm circuit breaker** (`_openrouter_down_until`, `_nvidia_down_until`) cho OpenRouter và NVIDIA — sau khi network/TLS failure hoặc 401, bỏ qua provider trong 5 phút thay vì chờ đủ timeout (6–30s) trên mỗi request. Giảm thời gian fallback từ 95s+ → ~5s khi provider đã hết lỗi. |
| `ai-service/services/llm_service.py` | **Thêm error response parsing** vào `_openrouter_generate` và `_nvidia_generate` — phân biệt lỗi 429 (rate-limit), 401 (invalid key), 404 (model not found) thay vì báo sai "empty response". Ngăn chặn fallback không cần thiết sang Cloudflare (chậm 20–28s). |
| `ai-service/services/llm_service.py` | **Xóa Gemini khỏi `generate_daily_insight`** — dòng 1163–1168 vẫn gọi `_gemini_generate` dù comment nói đã xóa. Provider chain giờ: OpenRouter → NVIDIA → Cloudflare → HF → template. |
| `ai-service/services/llm_service.py` | **Cập nhật `moderate_text` docstring + error message** — bỏ Gemini khỏi provider cascade description. |
| `ai-service/routers/chat.py` | Cập nhật error message: thêm `OPENROUTER_API_KEY (primary), NVIDIA_API_KEY` (cũ chỉ có CLOUDFLARE + HF). |
| `ai-service/routers/analytics.py` | Cập nhật error message tương tự ở `get_daily_insight` route. |
| `ai-service/routers/scholarship.py` | Cập nhật error message ở `check_scholarship_eligibility` route. |
| `ai-service/main.py` | Cập nhật error message ở `/api/ai/predict` route. |
| `ai-service/tests/test_moderation_fallback.py` | Fix `test_generate_text_with_fallback_error_message`: `"Cloudflare/Gemini/HF:"` → `"Cloudflare/HF:"`. |
| `ai-service/tests/test_moderation_fallback.py` | **Thêm 6 test mới**: OpenRouter circuit breaker, 401 auth error parsing + circuit breaker set, 429 rate-limit not confused with empty, `_nvidia_generate` exists & callable, NVIDIA circuit breaker, `_generate_text_with_fallback` correctly calls `_nvidia_generate`. |

### Provider chain sau khi fix

```
Text Generation (chat, learning-path, summary, career, geo):
  1. OpenRouter  (curl --ipv4 --insecure) ← PRIMARY
  2. NVIDIA NIM  (curl --ipv4 --insecure)
  3. Cloudflare Workers AI (curl) → HF Inference API (curl)
  4. Template fallback (degraded content)

Embeddings (vector_store.py):
  1. Gemini (gemini-embedding-001) ← giữ nguyên, không bị ảnh hưởng
  2. Cloudflare baai/gge-base-en-v1.5
  3. HuggingFace Inference API
  4. OpenRouter embeddings (tuỳ chọn)
```
