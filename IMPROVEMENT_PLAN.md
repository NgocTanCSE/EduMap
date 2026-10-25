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

### 2.6. Ghép mentor & học bản (Mentor Matching + Scholarship Screening)

**Trạng thái hiện tại**: Đẩy toàn bộ danh sách vào prompt → token overflow.

**Đề xuất**: Pre-filter trước (khoảng cách, chuyên ngành) + đọc file PDF bảng điểm.

**Kế hoạch**:
- Filter mentor trong DB trước khi gửi vào prompt (by location, expertise)
- Integrate PDF reader (PyPDF2) để extract transcript từ file upload
- Chỉ gửi kết quả filter (top 5-10) vào prompt

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
| 🟡 Trung | Map route-drawing | Tính năng mới được đề xuất |
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
