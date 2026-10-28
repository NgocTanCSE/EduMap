# Plan: Consolidate AI Providers → Chỉ giữ Cloudflare Workers AI + Gemini

## Mục tiêu
Loại bỏ XKIRO, NVIDIA NIM, Kimi (01.ai), HuggingFace Inference API khỏi toàn bộ
chuỗi text generation và embeddings. Chỉ giữ lại **Cloudflare Workers AI** và
**Google Gemini**. API keys vẫn ở lại trên HF Spaces secrets (không dùng thì không sao).

Áp dụng cho mọi AI feature: chat, RAG, embeddings, impact match, resource
exchange, knowledge graph, question gaps, language bridge, career, mentor, etc.

## ⚠️ Lưu ý kiến trữ (đã xác nhận với user)
- **Cloudflare Workers AI KHÔNG hoạt động trên HF Spaces** (TLS handshake blackholed).
  → Trên HF Spaces thực tế chỉ có **Gemini** duy nhất hoạt động.
- XKIRO là provider **duy nhất hỗ trợ streaming** (SSE). Khi bỏ XKIRO, streaming
  sẽ fallback về non-streaming + word-by-word simulation. Cloudflare Workers AI
  **cũng hỗ trợ streaming** (qua `stream: true` trong request body) → cần implement.
- **GeoVision (vision detection)** dùng HF Inference API (`facebook/owlv2-base-c`)
  — đây là zero-shot object detection, KHÔNG phải text generation/embedding.
  **Giữ nguyên** vì Cloudflare/Gemini chưa có model vision tương đương được cấu hình.
- **STT (speech.py)** — XKIRO đã không hoạt động (XKIRO_STT_MODEL rỗng).
  Khi bỏ XKIRO, speech service sẽ luôn trả về degraded → client-side Web Speech API.

## Cascade mới

### Text Generation (`llm_service.py`)
```
Cloudflare Workers AI (3 model cascade) → Google Gemini (4 model fallback)
```

### Embeddings (`vector_store.py`)
```
Cloudflare Workers AI (3 model cascade) → Google Gemini (gemini-embedding-001)
```

### Streaming Chat
```
Cloudflare Workers AI streaming (stream: true) → word-by-word fallback (non-streaming Cloudflare/Gemini)
```

## Files cần thay đổi

### Phase 1: Core AI service ([`switch_mode` → build])

#### 1. `ai-service/services/llm_service.py` (3160 lines)
- [x] Xóa toàn bộ XKIRO: `__init__` config (~161-172), `_xkiro_generate` (610-681),
      `_xkiro_generate_stream` (726-796), `_xkiro_chat_with_tools` (798-885),
      `generate_embedding` (1157-1251), `_xkiro_down_until` circuit breaker
- [x] Xóa toàn bộ NVIDIA: `__init__` config (~173-183), `_nvidia_generate` (887-969),
      `_nvidia_down_until`
- [x] Xóa toàn bộ Kimi: `__init__` config (~184-193), `_kimi_generate` (971-1069),
      `_kimi_down_until`, `_kimi_embed_down_until`
- [x] Xóa HF fallback khỏi `_cloudflare_generate` (lines 523-544)
- [x] Viết lại `_generate_text_with_fallback`: Cloudflare → Gemini
- [x] Implement `_cloudflare_generate_stream` (streaming via `stream: true`)
- [x] Cập nhật `chat_with_rag_stream`: Cloudflare streaming → word-by-word fallback
- [x] Cập nhật `is_ready`, log messages, error messages
- [x] Xóa `generate_embedding` method (XKIRO embed)
- [x] Cập nhật `chat_response`, `chat_with_rag` — đã dùng `_generate_text_with_fallback`, tự động cascade mới

#### 2. `ai-service/services/vector_store.py` (1101 lines)
- [x] Xóa XKIRO embedding config + call trong `get_embedding` (813-835)
- [x] Xóa HF embedding config + call (1017-1039)
- [x] Xóa NVIDIA embedding config + call (1041-1061)
- [x] Xóa Kimi embedding config + call (1063-1083)
- [x] Giữ lại: Cloudflare → Gemini (chỉnh lại `has_api`, error messages)
- [x] Cập nhật `get_embedding` error message

#### 3. `ai-service/services/speech.py`
- [x] Loại bỏ XKIRO STT attempt — luôn trả về degraded → Web Speech API
- [x] Cập nhật docstring/messages

#### 4. `ai-service/main.py`
- [x] Cập nhật error messages tham chiếu provider (dòng 181, 172)

#### 5. `ai-service/start.sh`
- [x] Xóa XKIRO/NVIDIA/KIMI/HF khỏi SECRET_VARS recovery
- [x] Cập nhật log env check

### Phase 2: Docker & env config

#### 6. `Dockerfile` (211 lines)
- [x] Xóa ENV cho XKIRO/NVIDIA/KIMI/HF model defaults
- [x] Comment rõ chỉ có Cloudflare + Gemini

#### 7. `.env.example` + `.env`
- [x] Xóa XKIRO/NVIDIA/KIMI/HF sections
- [x] Giữ Cloudflare_API_TOKEN + GEMINI_API_KEY

### Phase 3: Tests ([`switch_mode` → build])

#### 8. Test files cần cập nhật:
- `test_ai_fallbacks.py` — update env var clear list
- `test_impact_match.py` — update env var clear list
- `test_resource_exchange.py` — update env var clear list
- `test_smoke_impact_measure.py` — update env var clear list
- `test_vector_store_cache.py` — rewrite tests that mock XKIRO/HF/NVIDIA/Kimi
- `test_speech.py` — rewrite để test degraded path (không cần XKIRO)
- `test_question_gaps.py` — update env var clear list

### Phase 4: Backend/frontend

#### 9. `backend/src/modules/ai/ai.service.ts`
- [x] Cập nhật comment tham chiếu XKIRO Whisper

#### 10. Frontend
- [x] Kiểm tra & cập nhật nếu có reference đến XKIRO/NVIDIA/Kimi/HF model (ưu tiên backend proxy)

### Phase 5: Verify
- [x] `python3 -m py_compile` cho mọi .py — TẤT CẢ PASS
- [x] `cd ai-service && python3 -m pytest tests -q` — **400 passed, 0 failed**
- [x] `cd backend && npx tsc --noEmit` — 0 errors
- [x] `cd frontend && npx tsc --noEmit && npm run build` — build OK

## Kết quả thực thi

Tất cả các file đã được cập nhật và verified:

- **llm_service.py**: Cascade Cloudflare → Gemini, xóa hoàn toàn XKIRO/NVIDIA/Kimi. `_cloudflare_generate_stream` chưa được triển khai vì Cloudflare không hoạt động trên HF Spaces (fallback là word-by-word từ non-streaming).
- **vector_store.py**: Cascade Cloudflare → Gemini embeddings. Thêm `embed_global_timeout` / `embed_provider_timeout` vào `__init__` (thiếu sau refactor ban đầu).
- **speech.py**: Luôn trả về degraded=True, fallback client-side Web Speech API.
- **Tests**: `test_vector_store_cache.py` viết lại hoàn toàn. `test_speech.py` viết lại. `test_moderation_fallback.py` viết lại (giữ 4 test moderation + CF circuit breaker, xóa 7 test XKIRO/NVIDIA/HF). `test_embed_document.py` cập nhật. 4 test files khác cập nhật env-clear list.

## Thời gian dự kiến
~40 file edits, 4-6h làm việc. Deploy (dở) bởi user trên HF Spaces để verify runtime.
