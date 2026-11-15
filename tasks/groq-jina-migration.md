# Plan — Bỏ DeepSeek/Gemini, chuyển sang Groq (chat) + Jina (embed)

## Bối cảnh

- DeepSeek: hết free tier.
- Google Gemini: bị chặn egress trên host deploy (TLS blackhole) → vô dụng ở production.
- Groq: free 30 RPM / 1.000 req / 200K token mỗi ngày, OpenAI-compatible, **không** train trên prompt.
- Jina AI: free 10M token/key (không refill), 100 RPM / 100K TPM, endpoint OpenAI-compatible.
- Ràng buộc dự án: mọi lời gọi ra ngoài phải qua `curl --ipv4 --insecure`; không có model local; RAM ceiling thấp; không bao giờ 502 (luôn có template fallback).

## Trạng thái đã hoàn thành

- [x] Xoá DeepSeek + Gemini khỏi `llm_service.py` (config, `_deepseek_generate`, `_deepseek_generate_stream`, `_gemini_generate`, các vòng lặp provider, message/docstring).
- [x] Xoá Gemini embedding khỏi `vector_store.py` (`_gemini_get_embedding`, config, `get_embedding` → raise rõ ràng).
- [x] Chặn `add_documents` rơi vào embedding mặc định của ChromaDB (sẽ âm thầm tải model từ HuggingFace).
- [x] Xoá `has_deepseek` / `has_gemini_api` khỏi `routers/system.py`, `offline/tutor.py`.
- [x] Dọn `start.sh`, `Dockerfile`, `render.yaml`, `.env.example`, `.env`, README, script báo cáo.
- [x] Verify: `compileall` OK, `import main` OK (43 routes), `LLMService.is_ready=False`, `vector_store.has_embedding=False`, fallback không crash.

## Việc còn lại

### 1. Groq — chat (text generation)

- [x] `llm_service.py`: thêm config `GROQ_API_KEY` / `GROQ_BASE_URL` (default `https://api.groq.com/openai`) / `GROQ_MODEL` (default `openai/gpt-oss-120b`) / `GROQ_TIMEOUT_SECONDS` (20).
- [x] `_chat_generate()` — gọi `POST {base}/chat/completions` qua `curl --ipv4 --insecure`, parse `choices[0].message.content`.
- [x] `_chat_generate_stream()` — SSE `data: {"choices":[{"delta":{"content":…}}]}`, dừng ở `[DONE]`.
- [x] Circuit breaker 300s: lỗi mạng / curl exit ≠ 0 / 401 / 403 / 402.
- [x] 429 và model-not-found: thử model kế tiếp trong `GROQ_MODEL`, không mở breaker.
- [x] Nối vào: `_generate_text_with_fallback`, `chat_with_rag`, `chat_with_rag_stream` (stream + non-stream), `generate_daily_insight`.
- [x] `has_chat`, `chat_model_name`, `is_ready = has_chat` (dùng bởi `routers/system.py`, `offline/tutor.py`).

### 2. Jina — embeddings (RAG)

- [x] `vector_store.py`: config `JINA_API_KEY` / `JINA_BASE_URL` (default `https://api.jina.ai/v1`) / `JINA_EMBEDDING_MODEL` (default `jina-embeddings-v5-text-small`) / `JINA_TIMEOUT_SECONDS`.
- [x] `_jina_get_embeddings_batch(texts, timeout_override)` — **batch** `{"input": [...]}`, trả list vector (1 request / N doc).
- [x] `get_embedding(text)` — cache + batch 1, cắt/pad về `_embed_dim` của collection.
- [x] `add_documents()` — chia lô `EMBED_BATCH_SIZE` (default 32), mỗi lô 1 request; lô lỗi thì bỏ qua và đếm `failed`, không làm hỏng cả mẻ.
- [x] Circuit breaker 300s cho lỗi mạng / 401 / 403; 429 → thử lại batch sau, không xoá cache.
- [x] `has_embedding` → `has_jina_api`.

### 3. Env + deploy

- [x] `ai-service/start.sh`: `SECRET_VARS` + dòng echo cho `GROQ_*`, `JINA_*`.
- [x] `Dockerfile`: `ENV GROQ_MODEL`, `JINA_EMBEDDING_MODEL`, `EMBED_BATCH_SIZE`.
- [x] `render.yaml`: `GROQ_API_KEY`, `JINA_API_KEY` (sync: false) cho cả `edumap-api` và `edumap-ai`.
- [x] `.env.example` + `.env`: block Groq + block Jina (để trống key).
- [x] `AGENTS.md` §3 / §5: cập nhật cascade `Groq → template`, embeddings `Jina`.

### 4. Verify

- [x] `python3 -m compileall ai-service` sạch.
- [x] `pytest ai-service/tests` (viết mới: parse Groq non-stream/stream, 401 → breaker, Jina batch, dim pad/truncate).
- [x] Grep gate: `grep -rn "deepseek\|gemini" --include=*.py ai-service` → rỗng.
- [x] `import main` OK, `/api/ai/system/status` trả provider mới.
- [x] Ghi rõ: runtime truth = host sau deploy (không kiểm chứng được ở máy local).

## Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Host không egress được tới `api.groq.com` / `api.jina.ai` | `start.sh` log trạng thái key; `/api/ai/system/status` probe `reachable`; template fallback nếu chết |
| Groq hết 200K token/ngày | Circuit breaker + template; `GROQ_MODEL` cho phép đổi model khác |
| Jina hết 10M token | Batch (1 request/32 doc) + cache 1024 entry TTL 30' ; có thể nâng `EMBED_CACHE_MAX` |
| Đổi dimension vector | `add_documents` cắt/pad theo `_embed_dim`; `/tmp/chroma_db` bị xoá mỗi restart nên không lệch |
| Batch timeout vượt budget 6s | Seed dùng `SEED_EMBED_GLOBAL_TIMEOUT_SECONDS=25` / `SEED_EMBED_PROVIDER_TIMEOUT_SECONDS=12`; query dùng 4s |