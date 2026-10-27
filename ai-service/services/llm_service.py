import os
import asyncio
import json
import ssl
import io
import hashlib
import subprocess
import sqlite3
import urllib.request
import urllib.error
import urllib.parse
from dotenv import load_dotenv
from typing import List

try:
    import requests
except ImportError:
    requests = None
try:
    from services.cache_service import cache_service
except Exception as e:
    print(f"Cache service import failed: {e}")
    class _NoOpCache:
        def get(self, *a, **k):
            return None
        def set(self, *a, **k):
            pass
    cache_service = _NoOpCache()
try:
    from models.career_models import CareerAnalysisRequest
except Exception:
    CareerAnalysisRequest = None
try:
    from models.chat_models import ChatRequest, ChatResponse, ChatMessage
except Exception:
    ChatRequest = None
    ChatResponse = None
    ChatMessage = None
try:
    from models.learning_models import LearningPathRequest
except Exception:
    LearningPathRequest = None
try:
    from models.library_models import MaterialSummaryRequest
except Exception:
    MaterialSummaryRequest = None
try:
    from models.mentor_models import MatchRequest
except Exception:
    MatchRequest = None
try:
    from models.geo_models import GeoDensityAnalysisRequest
except Exception:
    GeoDensityAnalysisRequest = None

load_dotenv()
# load_dotenv() không tham số chỉ tìm .env ở cwd (thường là /app/ai-service),
# còn GEMINI_API_KEY được HF mount vào root workspace (/app/.env) hoặc process env.
# Thử load thêm từ các đường dẫn cha để đảm bảo key được đọc khi chạy độc lập.
import os as _os
_load_paths = [
    _os.path.join(_os.path.dirname(__file__), '..', '..', '.env'),   # /app/.env (root)
    _os.path.join(_os.path.dirname(__file__), '..', '.env'),         # /app/ai/.env
]
for _p in _load_paths:
    if _os.path.exists(_p):
        load_dotenv(_p, override=False)
        break

class LLMService:
    def __init__(self):
        # ── Google Gemini (embeddings + fallback text generation) ────────────
        # Gemini key is still loaded for embeddings (vector_store.py) and may
        # be used as a last-resort fallback. OpenRouter is the primary text
        # generation provider (configured via OPENROUTER_API_KEY).
        # HF Spaces cannot complete a TLS handshake with api.cloudflare.com
        # (confirmed network-level issue, July 2026), so Cloudflare Workers AI
        # is unusable there. Gemini is reachable and also provides embeddings.
        self.gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip().strip('"').strip("'")
        self.gemini_models = [
            m.strip()
            for m in os.getenv(
                "GEMINI_MODEL",
                # Valid Gemini API models as of Oct 2026. The 1.5/2.0 models
                # were shut down (2.0-flash on 2026-06-01) and returned 404
                # from v1beta, which made every chat request waste three
                # round-trips before falling back to another provider.
                "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-flash-latest",
            ).split(",")
            if m.strip()
        ]
        self.gemini_model_name = self.gemini_models[0] if self.gemini_models else "gemini-3.8-flash"
        self.gemini_timeout = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "20"))
        self.has_gemini = bool(self.gemini_key)
        # Circuit breaker: a network/TLS failure will fail identically for every
        # model, so stop hammering Gemini for 5 minutes.
        self._gemini_down_until = 0.0

        # AI qua Cloudflare Workers AI — dùng 1 token Cloudflare cho cả text-generation và embedding.
        self.api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        self.account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        # AI Gateway (tuỳ chọn): nếu bật, gọi qua gateway thay vì trực tiếp Workers AI.
        self.cf_gateway_id = os.getenv("CF_AI_GATEWAY_ID", "")
        self.cf_gateway_enabled = os.getenv("CF_AI_GATEWAY_ENABLED", "false").lower() in ("1", "true", "yes", "on")
        # DSS model theo thứ tự từ CLOUDFLARE_MODEL (CSV). Model đầu tiên = primary; các model sau là fallback tự động.
        self.model_candidates = [m.strip() for m in os.getenv("CLOUDFLARE_MODEL", "@cf/meta/llama-3.1-8b-instruct-fp8,@cf/google/gemma-7b-it-lora,@cf/mistralai/mistral-small-3.1-24b-instruct").split(",") if m.strip()]
        self.model_name = self.model_candidates[0] if self.model_candidates else "@cf/meta/llama-3.1-8b-instruct-fp8"
        self.has_cf = bool(self.api_token) and bool(self.account_id)
        # Circuit breaker: after a network-level failure, skip Cloudflare for
        # 5 minutes instead of burning 20s on every request.
        self._cf_down_until = 0.0
        # Circuit breaker for HuggingFace: after a 401/403 (invalid or
        # expired token), the router fails identically on every call, so skip
        # HF for 5 minutes instead of wasting the full per-request timeout on
        # each retry.
        self._hf_down_until = 0.0
        # --- HuggingFace Inference API fallback (khi Cloudflare ko ket noi duoc tu HF Spaces) ---
        # Check env vars first, then fall back to huggingface_hub library which
        # also reads ~/.huggingface/token, /etc/huggingface/token, HF_HOME, etc.
        self.hf_token = (
            os.getenv("HF_TOKEN") or os.getenv("HF_API_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN") or ""
        ).strip().strip('"').strip("'")
        if not self.hf_token:
            try:
                from huggingface_hub import HfFolder
                self.hf_token = HfFolder.get_token()
                if self.hf_token:
                    print(f"INFO: Recovered HF_TOKEN via huggingface_hub.HfFolder.get_token()")
            except Exception:
                pass
        # Also check common token-file locations as a last resort
        if not self.hf_token:
            import pathlib
            for token_path in [
                pathlib.Path.home() / ".huggingface" / "token",
                pathlib.Path.home() / ".cache" / "huggingface" / "token",
                pathlib.Path("/etc/huggingface/token"),
            ]:
                try:
                    if token_path.exists():
                        val = token_path.read_text().strip()
                        if val and len(val) > 10:
                            self.hf_token = val
                            print(f"INFO: Recovered HF_TOKEN from {token_path}")
                            break
                except Exception:
                    pass
        self.hf_model = os.getenv("HF_LLM_MODEL", "mistralai/Mistral-7B-Instruct-v0.2")
        # A trailing newline/space in a Space secret is invisible but makes the
        # bearer token invalid (router returns 401 "Invalid username or password").
        self.hf_token = (self.hf_token or "").strip().strip('"').strip("'")
        # HF killed api-inference.huggingface.co; the supported entrypoint is the
        # Inference Providers router (OpenAI-compatible chat completions).
        self.hf_router_url = os.getenv("HF_ROUTER_URL", "https://router.huggingface.co").rstrip("/")
        self.hf_timeout = float(os.getenv("HF_TIMEOUT_SECONDS", "8"))
        # Budget for the whole Cloudflare phase so a dead network cannot burn the
        # backend's 60s HTTP timeout (3 models x retries used to take >60s).
        self.cf_budget_seconds = float(os.getenv("AI_CF_BUDGET_SECONDS", "20"))
        self.has_hf = bool(self.hf_token)
        # --- OpenRouter / xkiro (OpenAI-compatible, thay thế Cloudflare/Gemini nếu cần) ---
        self.openrouter_key = (os.getenv("OPENROUTER_API_KEY") or "").strip().strip('"').strip("'")
        self.openrouter_base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
        self.openrouter_model = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat")
        self.openrouter_timeout = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "15"))
        self.has_openrouter = bool(self.openrouter_key)
        # OpenRouter embedding model (tuỳ chọn, dùng cho vector store)
        self.openrouter_embed_model = os.getenv("OPENROUTER_EMBEDDING_MODEL", "")
        self.has_openrouter_embed = bool(self.openrouter_key) and bool(self.openrouter_embed_model)
        # Circuit breaker: after a network/TLS failure or 401 from OpenRouter,
        # skip it for 5 minutes instead of burning the curl timeout on every retry.
        self._openrouter_down_until = 0.0
        # --- NVIDIA NIM (OpenAI-compatible) — model chat/embed trên build.nvidia.com ---
        self.nvidia_key = (os.getenv("NVIDIA_API_KEY") or os.getenv("NIM_API_KEY") or "").strip().strip('"').strip("'")
        self.nvidia_base = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
        self.nvidia_chat_model = os.getenv("NVIDIA_CHAT_MODEL", "meta/llama-3.1-8b-instruct")
        self.nvidia_embed_model = os.getenv("NVIDIA_EMBED_MODEL", "nvidia/embed-qa-4")
        self.nvidia_timeout = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "30"))
        self.has_nvidia = bool(self.nvidia_key)
        self.has_nvidia_embed = bool(self.nvidia_key) and bool(self.nvidia_embed_model)
        # Circuit breaker: after a network/TLS failure or 401 from NVIDIA NIM,
        # skip it for 5 minutes instead of burning the curl timeout on every retry.
        self._nvidia_down_until = 0.0
        # --- Shanghai AI Laboratory (01.ai / Kimi) — OpenAI-compatible ---
        self.kimi_key = (os.getenv("KIMI_API_KEY") or "").strip().strip('"').strip("'")
        self.kimi_base = os.getenv("KIMI_BASE_URL", "https://api.01.ai/v1").rstrip("/")
        self.kimi_model = os.getenv("KIMI_MODEL", "kore-gpt-9b")
        self.kimi_timeout = float(os.getenv("KIMI_TIMEOUT_SECONDS", "30"))
        self.has_kimi = bool(self.kimi_key)
        self.kimi_embed_model = os.getenv("KIMI_EMBEDDING_MODEL", "kimi-embedding-0812")
        self.has_kimi_embed = bool(self.kimi_key) and bool(self.kimi_embed_model)
        self._kimi_down_until = 0.0
        self._kimi_embed_down_until = 0.0
        # is_ready = True neu co bat ky nhanh LLM nao (OpenRouter / Gemini / Cloudflare / HF / NVIDIA / Kimi)
        self.is_ready = self.has_gemini or self.has_cf or self.has_hf or self.has_openrouter or self.has_nvidia or self.has_kimi
        if self.has_openrouter:
            print(f"INFO: OpenRouter la provider CHINH (primary). Model={self.openrouter_model}")
        elif self.has_gemini:
            print(f"INFO: Google Gemini la provider CHINH (fallback). Model={self.gemini_model_name}")
        if not self.is_ready:
            print("ERROR: Khong co OPENROUTER_API_KEY, GEMINI_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoac HF_TOKEN. Cau hinh de dung AI chat.")
        elif not self.has_openrouter and not self.has_gemini and not self.has_cf and self.has_hf:
            print(f"INFO: Chi co HuggingFace Inference API. Model={self.hf_model}")
        if self.has_hf:
            # Never print the token itself; length + prefix is enough to spot
            # empty/quoted/truncated secrets in the Space logs.
            print(f"INFO: HF_TOKEN detected (len={len(self.hf_token)}, prefix={self.hf_token[:3]}...)")
        if self.has_cf:
            print(f"CLOUDFLARE_MODEL: {self.model_name}")
        if self.has_kimi:
            print(f"INFO: Shanghai AI Laboratory (01.ai / Kimi) enabled (secondary provider). Model={self.kimi_model}")
        if self.has_nvidia:
            print(f"INFO: NVIDIA NIM enabled (secondary provider). Model={self.nvidia_chat_model}")
        # --- Adzuna API (job market data — LLM-independent trends) ---
        self.adzuna_app_id = os.getenv("ADZUNA_APP_ID")
        self.adzuna_app_key = os.getenv("ADZUNA_APP_KEY")
        self.adzuna_country = os.getenv("ADZUNA_COUNTRY", "us")
        self.has_adzuna = bool(self.adzuna_app_id) and bool(self.adzuna_app_key)
        self.sqlite_path = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")
        if self.has_adzuna:
            print(f"INFO: Adzuna API configured (country={self.adzuna_country}). LLM-independent market trends enabled.")
        else:
            print("INFO: Adzuna API not configured (set ADZUNA_APP_ID + ADZUNA_APP_KEY). Will use local SQLite fallback for market trends.")

        # Startup connectivity diagnostics: surfaces HF Spaces egress problems
        # (IPv6 blackhole / blocked DNS) in the logs instead of only at chat time.
        if self.is_ready and os.getenv("AI_PREFLIGHT", "true").lower() not in ("0", "false", "no", "off"):
            try:
                from services.net import probe_tls
                targets = []
                if self.has_openrouter:
                    targets.append("openrouter.ai")
                if self.has_gemini:
                    targets.append("generativelanguage.googleapis.com")
                if self.has_cf:
                    targets.append("api.cloudflare.com")
                if self.has_hf:
                    targets.append(self.hf_router_url.split("//")[-1].split("/")[0])
                for host in targets:
                    ok, ms, err = probe_tls(host)
                    print(f"[preflight] {host}: {'reachable' if ok else 'UNREACHABLE'} ({ms}ms){(' ' + err) if err else ''}")
            except Exception as e:
                print(f"[preflight] skipped: {e}")

    # Reasons that mean the model name itself is wrong/unavailable/deprecated,
    # so we should move on to the next candidate instead of retrying it.
    # (429 = rate limit -> go to next model immediately; 502/503/504 = transient
    #  -> retry once on the same model, then move on.)
    _MODEL_NOT_FOUND_REASONS = (
        "not found", "not supported", "no longer available",
        "model not found", "could not find", "deprecated", "does not exist",
    )

    def _is_model_not_found(self, code, message):
        low = (message or "").lower()
        return (
            code in (404, 410)  # 410 = Gone / deprecated model
            or any(r in low for r in self._MODEL_NOT_FOUND_REASONS)
        )

    def _gemini_generate(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None) -> str:
        """Call Google Gemini generateContent.

        Gemini is no longer the primary provider for text generation on HF
        Spaces — OpenRouter holds that role now. This method is retained as a
        last-resort fallback (invoked only inside _cloudflare_generate's
        three-provider cascade after OpenRouter and NVIDIA have failed). Requests
        use curl so they follow the same IPv4/TLS workaround as the other
        providers.
        """
        import time as _time

        if not self.has_gemini:
            raise RuntimeError("GEMINI_API_KEY not set — cannot use Gemini.")
        if _time.monotonic() < self._gemini_down_until:
            raise RuntimeError("Gemini temporarily disabled after a network failure.")

        last_err = None
        for raw_model in self.gemini_models:
            model = (raw_model or "").strip()
            if model.startswith("models/"):
                model = model[len("models/"):]
            if not model:
                continue

            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{urllib.parse.quote(model, safe='-')}:generateContent"
            )
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": float(temperature),
                    "maxOutputTokens": int(max_tokens or 2048),
                },
            }
            if top_p is not None:
                payload["generationConfig"]["topP"] = float(top_p)
            # Gemini 3.x cannot disable thinking and defaults to "medium".
            # Long RAG prompts at that level can exceed the curl budget on HF
            # Spaces ("0 bytes received" after 20s), so request the lowest
            # supported level. Valid values are low/medium/high ("minimal" is
            # rejected with HTTP 400). Gemini 2.x uses thinkingBudget instead.
            if model.startswith("gemini-3"):
                payload["generationConfig"]["thinkingConfig"] = {"thinkingLevel": "low"}
            body_json = json.dumps(payload)

            try:
                proc = subprocess.run(
                    [
                        "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                        "-H", f"x-goog-api-key: {self.gemini_key}",
                        "-H", "Content-Type: application/json",
                        "-d", body_json,
                        "--connect-timeout", "6",
                        "--max-time", str(self.gemini_timeout),
                        url,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=self.gemini_timeout + 2,
                )
            except Exception as e:
                self._gemini_down_until = _time.monotonic() + 300
                raise RuntimeError(f"Gemini connection failed: {type(e).__name__}: {e}")

            if proc.returncode != 0:
                err = (proc.stderr or "").strip()[:200] or f"curl exit {proc.returncode}"
                self._gemini_down_until = _time.monotonic() + 300
                raise RuntimeError(f"Gemini connection failed: {err}")

            try:
                data = json.loads(proc.stdout or "{}")
            except Exception:
                last_err = f"{model}: invalid JSON response: {(proc.stdout or '')[:160]}"
                continue

            if isinstance(data, dict) and data.get("error"):
                err = data.get("error") or {}
                code = int(err.get("code") or 0)
                message = str(err.get("message") or "")
                low = message.lower()
                if code in (401, 403) or "api key" in low and ("invalid" in low or "not valid" in low):
                    raise RuntimeError(f"Gemini auth error (HTTP {code}): {message[:200]}")
                if code == 429:
                    last_err = f"{model}: HTTP 429 {message[:100]}"
                    print(f"Gemini model {model} bi rate-limit (429), thu model ke tiep...")
                    continue
                if code in (400, 404) and any(
                    reason in low
                    for reason in ("not found", "not supported", "does not exist", "deprecated")
                ):
                    last_err = f"{model}: HTTP {code} {message[:100]}"
                    print(f"Gemini model {model} khong kha dung, thu model ke tiep...")
                    continue
                last_err = f"{model}: HTTP {code} {message[:120]}"
                print(f"Gemini model {model} loi HTTP {code}, thu model ke tiep...")
                continue

            candidates = data.get("candidates") if isinstance(data, dict) else None
            if not candidates:
                feedback = data.get("promptFeedback") if isinstance(data, dict) else None
                last_err = f"{model}: empty response ({str(feedback)[:120]})"
                continue

            text = ""
            try:
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
            except (IndexError, AttributeError, TypeError):
                text = ""

            if text:
                return text
            last_err = f"{model}: empty text response"
            print(f"Gemini model {model} tra ve empty response, thu model ke tiep...")

        raise RuntimeError(f"Gemini generation failed: {last_err or 'no model available'}")

    def _cloudflare_generate(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None) -> str:
        """Gọi Cloudflare Workers AI :generateContent. Thử từng model trong CLOUDFLARE_MODEL (CSV).

        - 404 / model not found -> thử model kế tiếp ngay (lỗi model, không retry).
        - 429 / 502 / 503 / 504 -> lỗi tạm thời: retry cùng model sau backoff ngắn,
          rồi mới chuyển sang model tiếp theo. Tránh thất bại vì một model bị quá tải.
        - 401 / 403 -> lỗi xác thực: dừng ngay.

        Neu tat ca CF model deu that bai, tu dong fallback ve HuggingFace Inference API
        (neu co HF_TOKEN).
        """
        import time as _time
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY (primary), NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

        request_started = _time.monotonic()
        cf_last_err = None

        # --- Phan 1: thu Cloudflare (qua AI Gateway neu bat, nguoc lai truc tiep Workers AI) ---
        if self.has_cf and _time.monotonic() >= self._cf_down_until:
            cf_last_err = None
            cf_network_down = False
            if self.cf_gateway_enabled and self.cf_gateway_id and self.account_id:
                base_url = f"https://gateway.ai.cloudflare.com/v1/{self.account_id}/{self.cf_gateway_id}/ai/run"
                print(f"[LLM] Using Cloudflare AI Gateway: gateway_id={self.cf_gateway_id}")
            else:
                base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run"
            last_err = None
            # No retries: on HF Spaces a blocked/slow route fails identically on
            # the second attempt and only burns the backend's 60s timeout.
            per_model_retries = 0
            cf_started = _time.monotonic()

            for model in self.model_candidates:
                if _time.monotonic() - cf_started > self.cf_budget_seconds:
                    print(f"[LLM] Cloudflare budget ({self.cf_budget_seconds}s) exhausted, skipping remaining models")
                    break
                # URL-encode only the @ prefix (keeps it from being treated as
                # a userinfo separator) but PRESERVE / so Cloudflare sees the
                # full model path: @cf/meta/llama-3.1-8b-instruct-fp8
                # Encoding / as %2F flattens the path into a single segment
                # → Cloudflare returns "No route for that URI" (code 7000).
                encoded_model = urllib.parse.quote(model, safe='/')
                url = f"{base_url}/{encoded_model}"
                payload = {
                    "prompt": prompt,
                    "max_tokens": max_tokens or 2048,
                    "temperature": temperature,
                }
                if top_p is not None:
                    payload["top_p"] = top_p
                body_json = json.dumps(payload).encode("utf-8")
                req_headers = {
                    "Authorization": f"Bearer {self.api_token}",
                    "Content-Type": "application/json",
                }
                ctx = ssl.create_default_context()

                attempt = 0
                while True:
                    attempt += 1
                    data = None
                    try:
                        # Use curl (OpenSSL TLS) — bypasses Python ssl module TLS issues in HF Spaces
                        # --insecure skips cert verification (HF Spaces may have a MITM proxy with custom CA)
                        # --ipv4 avoids the IPv6 blackhole that causes "SSL connection timeout".
                        _curl = subprocess.run(
                            ["curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                             "-H", f"Authorization: Bearer {self.api_token}",
                             "-H", "Content-Type: application/json",
                             "-d", body_json.decode("utf-8"),
                             "--connect-timeout", "4", "--max-time", "10", url],
                            capture_output=True, text=True, timeout=12)
                        if _curl.returncode == 0 and _curl.stdout.strip():
                            data = json.loads(_curl.stdout)
                        else:
                            _msg = _curl.stderr.strip()[:200] or f"curl exit {_curl.returncode}"
                            raise urllib.error.URLError(_msg)
                    except FileNotFoundError:
                        print("  curl not found, falling back to urllib.request")
                        req = urllib.request.Request(url, data=body_json, headers=req_headers, method="POST")
                        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                            data = json.loads(resp.read().decode("utf-8"))
                    except urllib.error.HTTPError as e:
                        b = e.read().decode("utf-8", "ignore")[:300]
                        if self._is_model_not_found(e.code, b):
                            last_err = f"{model}: HTTP {e.code} {b[:120]}"; print(f"Cloudflare model {model} không khả dụng, thử model kế tiếp..."); break
                        if e.code in (401, 403):
                            raise RuntimeError(f"Cloudflare auth lỗi (HTTP {e.code}): {b[:200]}")
                        if e.code == 429:
                            last_err = f"{model}: HTTP 429 {b[:80]}"; print(f"Cloudflare model {model} bị rate-limit (429), không retry cùng model, thử kế tiếp..."); break
                        if e.code in (502, 503, 504) and attempt <= per_model_retries:
                            last_err = f"{model}: HTTP {e.code} {b[:80]}"; print(f"Cloudflare model {model} {e.code} (tạm thời), retry {attempt}/{per_model_retries}..."); _time.sleep(2.0); continue
                        last_err = f"{model}: HTTP {e.code} {b[:80]}"; print(f"Cloudflare model {model} {e.code}, thử model kế tiếp..."); break
                    except Exception as e:
                        if attempt <= per_model_retries:
                            last_err = f"{model}: {type(e).__name__}: {e}"; print(f"Lỗi kết nối {model} ({type(e).__name__}): {e}, retry {attempt}/{per_model_retries}..."); _time.sleep(1.5); continue
                        last_err = f"{model}: {type(e).__name__}: {e}"; print(f"Lỗi kết nối {model} ({type(e).__name__}): {e}, tạm ngưng Cloudflare 5 phút."); 
                        self._cf_down_until = _time.monotonic() + 300
                        cf_network_down = True
                        break

                    # Success path: parse Cloudflare response
                    if "error" in data and data.get("success") is False:
                        err = data.get("errors", [{}])[0] if isinstance(data.get("errors"), list) else {}
                        code = err.get("code", 0)
                        msg = err.get("message", "")
                        if code in (10000, 10001) or "auth" in msg.lower():
                            raise RuntimeError(f"Cloudflare auth lỗi (code {code}): {msg[:200]}")
                        if self._is_model_not_found(code, msg):
                            last_err = f"{model}: {msg[:120]}"; print(f"Cloudflare model {model} không khả dụng, thử model kế tiếp..."); break
                        if code == 429:
                            last_err = f"{model}: {msg[:80]}"; print(f"Cloudflare model {model} bị rate-limit (429), thử kế tiếp..."); break
                        if code in (502, 503, 504) and attempt <= per_model_retries:
                            last_err = f"{model}: {msg[:120]}"; print(f"Cloudflare model {model} {code} (tạm thời), retry {attempt}/{per_model_retries}..."); _time.sleep(2.0); continue
                        last_err = f"{model}: {msg[:80]}"; print(f"Cloudflare model {model} {code}, thử model kế tiếp..."); break

                    result = data.get("result", {})
                    if isinstance(result, dict):
                        text = result.get("response", "").strip()
                    elif isinstance(result, str):
                        text = result.strip()
                    else:
                        last_err = f"{model}: unexpected result format"; break

                    if text:
                        return text
                    last_err = f"{model}: trả về empty response"
                    break
                # end while True (per-model retries)
                if cf_network_down:
                    print("[LLM] Cloudflare network unreachable; skipping remaining models")
                    break
            # end for model in model_candidates
            cf_last_err = last_err

        # If Cloudflare is configured but circuit-broken, the block above was
        # skipped — record a clear message so the final error does NOT
        # misleadingly report "không cấu hình" (not configured) when it
        # actually means "temporarily disabled after a network failure".
        if self.has_cf and _time.monotonic() < self._cf_down_until and not cf_last_err:
            cf_last_err = "Tạm thời gián đoạn (thất bại mạng, cooldown 5 phút)"

        # --- Phan 2: fallback ve HuggingFace Inference API ---
        # Keep the whole call under the backend's 60s timeout: CF budget + HF
        # timeout must not exceed it, otherwise Nest returns 503 first.
        hf_last_err = None
        if self.has_hf and (_time.monotonic() - request_started) < 28 and _time.monotonic() >= self._hf_down_until:
            try:
                result = self._hf_generate(prompt, temperature=temperature, max_tokens=max_tokens, top_p=top_p)
                if result:
                    print(f"  -> HF Inference API generate OK (model={self.hf_model})")
                    return result
            except Exception as e:
                hf_last_err = str(e)
                print(f"HF Inference API generate ALSO failed: {e}")
        elif self.has_hf and _time.monotonic() < self._hf_down_until:
            hf_last_err = "Tạm thời gián đoạn (circuit breaker — 401/invalid token, cooldown 5 phút)"
            print("[LLM] HuggingFace circuit breaker active — skipping HF fallback")

        raise RuntimeError(
            "Không thể sinh nội dung. "
            f"Cloudflare: {cf_last_err or ('không cấu hình' if not self.has_cf else 'lỗi không xác định')}, "
            f"HuggingFace: {hf_last_err or ('không cấu hình' if not self.has_hf else 'lỗi kết nối/401')}"
        )

    def _hf_generate(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None) -> str:
        """Sinh text qua HuggingFace Inference Providers (OpenAI-compatible router).

        `api-inference.huggingface.co` da bi HF khai tu (NXDOMAIN) — toan bo
        fallback cu (InferenceClient, DNS override, api-inference.hf.co) khong
        con dung duoc. Endpoint hien tai la https://router.huggingface.co.

        Yeu cau: HF_TOKEN phai co quyen "Make calls to Inference Providers".
        """
        if not self.has_hf:
            raise RuntimeError("HF_TOKEN not set — cannot use HuggingFace Inference API.")
        # Circuit breaker: after a 401 (invalid token), don't keep retrying.
        import time as _time
        if _time.monotonic() < self._hf_down_until:
            raise RuntimeError("HuggingFace circuit breaker active — token/server error, cooldown 5 phút.")

        url = f"{self.hf_router_url}/v1/chat/completions"
        payload = {
            "model": self.hf_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": int(max_tokens or 1024),
            "temperature": float(temperature),
            "stream": False,
        }
        if top_p is not None:
            payload["top_p"] = float(top_p)

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.hf_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.hf_timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "ignore")[:300]
            # 401/403 = invalid, expired, or insufficient-scope token — the
            # request will fail identically every time, so set a 5-minute
            # circuit breaker instead of hammering the router on every call.
            if e.code in (401, 403):
                self._hf_down_until = _time.monotonic() + 300
                print(f"[LLM] HuggingFace circuit breaker set (HTTP {e.code}) — skipping HF for 5 minutes")
            raise RuntimeError(f"HF router HTTP {e.code}: {body}")
        except Exception as e:
            raise RuntimeError(f"HF router connection failed: {type(e).__name__}: {e}")

        text = ""
        try:
            text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError):
            if isinstance(data, dict):
                text = data.get("generated_text") or ""
        text = str(text).strip()
        if not text:
            raise RuntimeError(f"HF router returned empty response: {str(data)[:200]}")
        return text

    def _openrouter_generate(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None) -> str:
        """Gọi OpenRouter / xkiro (OpenAI-compatible chat completions).

        Endpoint: https://openrouter.ai/api/v1/chat/completions
        Header: Authorization: Bearer <OPENROUTER_API_KEY>
        """
        if not self.has_openrouter:
            raise RuntimeError("OPENROUTER_API_KEY not set — cannot use OpenRouter.")
        import time as _time
        if _time.monotonic() < self._openrouter_down_until:
            raise RuntimeError("OpenRouter temporarily disabled after a network failure.")
        url = f"{self.openrouter_base}/chat/completions"
        payload = {
            "model": self.openrouter_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": int(max_tokens or 1024),
            "temperature": float(temperature),
            "stream": False,
        }
        if top_p is not None:
            payload["top_p"] = float(top_p)
        body_json = json.dumps(payload).encode("utf-8")
        # Use curl (OpenSSL TLS) to bypass Python ssl/urllib IPv6 blackhole on
        # HF Spaces — same pattern as Gemini, Cloudflare, and HF providers.
        try:
            proc = subprocess.run(
                [
                    "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                    "-H", f"Authorization: Bearer {self.openrouter_key}",
                    "-H", "Content-Type: application/json",
                    "-H", "Accept: application/json",
                    "-H", "HTTP-Referer: https://edumap.ai",
                    "-H", "X-Title: EduMap",
                    "-d", body_json,
                    "--connect-timeout", "6",
                    "--max-time", str(self.openrouter_timeout),
                    url,
                ],
                capture_output=True, text=True, timeout=self.openrouter_timeout + 2,
            )
        except Exception as e:
            self._openrouter_down_until = _time.monotonic() + 300
            raise RuntimeError(f"OpenRouter connection failed: {type(e).__name__}: {e}")

        if proc.returncode != 0:
            err = (proc.stderr or "").strip()[:300] or f"curl exit {proc.returncode}"
            # curl can exit non-zero (e.g. timeout code 28) while still having
            # received a partial response body — try to parse it so a 401/429/auth
            # error body is surfaced instead of a generic "curl exit 28". This
            # helps diagnose whether the 77-byte "Operation timed out" is a true
            # network hang or an auth/model error that just didn't close the
            # connection cleanly.
            _stdout = (proc.stdout or "").strip()
            if _stdout:
                try:
                    _partial = json.loads(_stdout)
                    if isinstance(_partial, dict) and _partial.get("error"):
                        _eno = _partial["error"]
                        if isinstance(_eno, dict):
                            _code = int(_eno.get("code") or 0)
                            _msg = str(_eno.get("message", _stdout[:200]))
                            _low = _msg.lower()
                            if _code in (401, 403) or "api key" in _low or "invalid" in _low or "unauthorized" in _low:
                                self._openrouter_down_until = _time.monotonic() + 300
                                raise RuntimeError(f"OpenRouter auth error (HTTP {_code}): {_msg[:200]}")
                            if _code == 429:
                                self._openrouter_down_until = _time.monotonic() + 300
                                raise RuntimeError(f"OpenRouter rate-limited (429): {_msg[:150]}")
                            err = f"{err} | body: {_msg[:120]}"
                except json.JSONDecodeError:
                    pass
            self._openrouter_down_until = _time.monotonic() + 300
            raise RuntimeError(f"OpenRouter curl failed: {err}")

        if not (proc.stdout or "").strip():
            self._openrouter_down_until = _time.monotonic() + 300
            raise RuntimeError(f"OpenRouter returned empty response (curl stdout empty)")

        try:
            data = json.loads(proc.stdout)
        except Exception:
            raise RuntimeError(f"OpenRouter returned invalid JSON: {(proc.stdout or '')[:200]}")

        # Check for API error responses (429 rate-limit, 401 invalid key, 404 model
        # not found) WITHOUT confusing them with genuinely empty content. This
        # prevents the "empty response" false-positive that triggered the slow
        # Cloudflare/HF fallback cascade on every request.
        if isinstance(data, dict) and data.get("error"):
            err = data.get("error") or {}
            if isinstance(err, dict):
                code = int(err.get("code") or 0)
                message = str(err.get("message") or "")
            else:
                code = 0
                message = str(err)
            low = message.lower()
            if code in (401, 403) or ("api key" in low and ("invalid" in low or "not valid" in low or "unauthorized" in low)):
                self._openrouter_down_until = _time.monotonic() + 300
                raise RuntimeError(f"OpenRouter auth error (HTTP {code}): {message[:200]}")
            if code == 429:
                raise RuntimeError(f"OpenRouter rate-limited (429): {message[:150]}")
            if self._is_model_not_found(code, message):
                raise RuntimeError(f"OpenRouter model unavailable (HTTP {code}): {message[:150]}")
            raise RuntimeError(f"OpenRouter API error (HTTP {code}): {message[:200]}")

        text = ""
        try:
            text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError):
            if isinstance(data, dict):
                text = data.get("generated_text") or ""
        text = str(text).strip()
        if not text:
            raise RuntimeError(f"OpenRouter returned empty response: {str(data)[:200]}")
        return text

    def _openrouter_generate_stream(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None):
        """True token-by-token streaming via OpenRouter SSE (curl --ipv4 --insecure).

        Uses subprocess.Popen + stdout PIPE so curl's streaming output is read
        incrementally without buffering the entire response.  This replaces the
        old post-hoc word-splitting that yielded artificial 50 ms chunks.

        Yields individual token strings (content deltas).
        """
        if not self.has_openrouter:
            raise RuntimeError("OPENROUTER_API_KEY not set — cannot use OpenRouter streaming.")
        import time as _time
        if _time.monotonic() < self._openrouter_down_until:
            raise RuntimeError("OpenRouter temporarily disabled after a network failure.")
        url = f"{self.openrouter_base}/chat/completions"
        payload = {
            "model": self.openrouter_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": int(max_tokens or 1024),
            "temperature": float(temperature),
            "stream": True,
        }
        if top_p is not None:
            payload["top_p"] = float(top_p)
        body_json = json.dumps(payload).encode("utf-8")

        try:
            proc = subprocess.Popen(
                [
                    "curl", "--ipv4", "--insecure", "-sS", "-N",
                    "-X", "POST",
                    "-H", f"Authorization: Bearer {self.openrouter_key}",
                    "-H", "Content-Type: application/json",
                    "-H", "Accept: text/event-stream",
                    "-H", "HTTP-Referer: https://edumap.ai",
                    "-H", "X-Title: EduMap",
                    "-d", body_json,
                    "--connect-timeout", "6",
                    "--max-time", str(self.openrouter_timeout),
                    url,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )
        except Exception as e:
            raise RuntimeError(f"OpenRouter stream connection failed: {type(e).__name__}: {e}")

        try:
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    choice = chunk.get("choices", [{}])[0]
                    delta = choice.get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
        except Exception as e:
            print(f"OpenRouter stream read error: {e}")
        finally:
            proc.kill()

    def _openrouter_chat_with_tools(
        self,
        messages: list,
        tools: list,
        tool_choice: str = "auto",
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> dict:
        """Single OpenRouter chat-completion call with tool-calling support.

        Mirrors ``_openrouter_generate`` (curl --ipv4 --insecure) but sends a
        ``messages`` array + ``tools`` definition so the model can emit
        ``tool_calls``. Returns the **full** response dict (not just the text)
        because the caller needs ``tool_calls`` to drive an agent loop.

        Used by ``agents/map_agent.py``. A Gemini fallback is attempted inside
        the agent via the non-tool-calling ``_generate_text_with_fallback``
        when OpenRouter is not configured.
        """
        if not self.has_openrouter:
            raise RuntimeError("OPENROUTER_API_KEY not set — cannot use OpenRouter tool calling.")
        import time as _time
        if _time.monotonic() < self._openrouter_down_until:
            raise RuntimeError("OpenRouter temporarily disabled after a network failure.")

        url = f"{self.openrouter_base}/chat/completions"
        payload = {
            "model": self.openrouter_model,
            "messages": messages,
            "tools": tools,
            "tool_choice": tool_choice,
            "max_tokens": int(max_tokens),
            "temperature": float(temperature),
            "stream": False,
        }
        body_json = json.dumps(payload).encode("utf-8")

        try:
            proc = subprocess.run(
                [
                    "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                    "-H", f"Authorization: Bearer {self.openrouter_key}",
                    "-H", "Content-Type: application/json",
                    "-H", "Accept: application/json",
                    "-H", "HTTP-Referer: https://edumap.ai",
                    "-H", "X-Title: EduMap",
                    "-d", body_json,
                    "--connect-timeout", "6",
                    "--max-time", str(self.openrouter_timeout),
                    url,
                ],
                capture_output=True, text=True, timeout=self.openrouter_timeout + 2,
            )
        except Exception as e:
            self._openrouter_down_until = _time.monotonic() + 300
            raise RuntimeError(f"OpenRouter tool-call connection failed: {type(e).__name__}: {e}")

        if proc.returncode != 0:
            err = (proc.stderr or "").strip()[:300] or f"curl exit {proc.returncode}"
            self._openrouter_down_until = _time.monotonic() + 300
            raise RuntimeError(f"OpenRouter tool-call curl failed: {err}")

        if not (proc.stdout or "").strip():
            self._openrouter_down_until = _time.monotonic() + 300
            raise RuntimeError("OpenRouter tool-call returned empty response")

        try:
            data = json.loads(proc.stdout)
        except Exception:
            raise RuntimeError(f"OpenRouter tool-call returned invalid JSON: {(proc.stdout or '')[:200]}")

        if isinstance(data, dict) and data.get("error"):
            err = data.get("error") or {}
            if isinstance(err, dict):
                code = int(err.get("code") or 0)
                message = str(err.get("message") or "")
            else:
                code = 0
                message = str(err)
            low = message.lower()
            if code in (401, 403) or ("api key" in low and ("invalid" in low or "not valid" in low or "unauthorized" in low)):
                self._openrouter_down_until = _time.monotonic() + 300
                raise RuntimeError(f"OpenRouter tool-call auth error (HTTP {code}): {message[:200]}")
            if code == 429:
                raise RuntimeError(f"OpenRouter tool-call rate-limited (429): {message[:150]}")
            raise RuntimeError(f"OpenRouter tool-call API error (HTTP {code}): {message[:200]}")

        return data

    def _nvidia_generate(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None) -> str:
        """Gọi NVIDIA NIM (OpenAI-compatible chat completions).

        Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
        Yêu cầu: NVIDIA_API_KEY (hoặc NIM_API_KEY).
        """
        if not self.has_nvidia:
            raise RuntimeError("NVIDIA_API_KEY not set — cannot use NVIDIA NIM.")
        import time as _time
        if _time.monotonic() < self._nvidia_down_until:
            raise RuntimeError("NVIDIA NIM temporarily disabled after a network failure.")
        url = f"{self.nvidia_base}/chat/completions"
        payload = {
            "model": self.nvidia_chat_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": int(max_tokens or 1024),
            "temperature": float(temperature),
            "stream": False,
        }
        if top_p is not None:
            payload["top_p"] = float(top_p)
        body_json = json.dumps(payload).encode("utf-8")
        # Use curl (OpenSSL TLS) to bypass Python ssl/urllib IPv6 blackhole on HF Spaces.
        try:
            proc = subprocess.run(
                [
                    "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                    "-H", f"Authorization: Bearer {self.nvidia_key}",
                    "-H", "Content-Type: application/json",
                    "-H", "Accept: application/json",
                    "-d", body_json,
                    "--connect-timeout", "6",
                    "--max-time", str(self.nvidia_timeout),
                    url,
                ],
                capture_output=True, text=True, timeout=self.nvidia_timeout + 2,
            )
        except Exception as e:
            import time as _time_ext
            self._nvidia_down_until = _time_ext.monotonic() + 300
            raise RuntimeError(f"NVIDIA NIM connection failed: {type(e).__name__}: {e}")

        if proc.returncode != 0:
            err = (proc.stderr or "").strip()[:300] or f"curl exit {proc.returncode}"
            import time as _time_ext
            self._nvidia_down_until = _time_ext.monotonic() + 300
            raise RuntimeError(f"NVIDIA NIM curl failed: {err}")

        try:
            data = json.loads(proc.stdout or "{}")
        except Exception:
            raise RuntimeError(f"NVIDIA NIM returned invalid JSON: {(proc.stdout or '')[:200]}")

        # Check for API error responses (same pattern as OpenRouter).
        if isinstance(data, dict) and data.get("error"):
            err = data.get("error") or {}
            if isinstance(err, dict):
                code = int(err.get("code") or 0)
                message = str(err.get("message") or "")
            else:
                code = 0
                message = str(err)
            low = message.lower()
            if code in (401, 403) or ("api key" in low and ("invalid" in low or "not valid" in low or "unauthorized" in low)):
                import time as _time_ext
                self._nvidia_down_until = _time_ext.monotonic() + 300
                raise RuntimeError(f"NVIDIA NIM auth error (HTTP {code}): {message[:200]}")
            if code == 429:
                raise RuntimeError(f"NVIDIA NIM rate-limited (429): {message[:150]}")
            if self._is_model_not_found(code, message):
                raise RuntimeError(f"NVIDIA NIM model unavailable (HTTP {code}): {message[:150]}")
            raise RuntimeError(f"NVIDIA NIM API error (HTTP {code}): {message[:200]}")

        text = ""
        try:
            text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError):
            if isinstance(data, dict):
                text = data.get("generated_text") or ""
        text = str(text).strip()
        if not text:
            raise RuntimeError(f"NVIDIA NIM returned empty response: {str(data)[:200]}")
        return text

    def _kimi_generate(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None) -> str:
        """Gọi Shanghai AI Laboratory (01.ai / Kimi) chat completions API.

        Endpoint: https://api.01.ai/v1/chat/completions (OpenAI-compatible format).
        Yêu cầu: KIMI_API_KEY.
        Uses curl --ipv4 --insecure for HF Spaces compatibility.
        """
        if not self.has_kimi:
            raise RuntimeError("KIMI_API_KEY not set — cannot use Kimi.")
        import time as _kt
        if _kt.monotonic() < self._kimi_down_until:
            raise RuntimeError("Kimi (01.ai) temporarily disabled after a network failure (circuit breaker, 5 min cooldown).")
        url = f"{self.kimi_base}/chat/completions"
        payload = {
            "model": self.kimi_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": int(max_tokens or 1024),
            "temperature": float(temperature),
            "stream": False,
        }
        if top_p is not None:
            payload["top_p"] = float(top_p)
        body_json = json.dumps(payload).encode("utf-8")
        try:
            proc = subprocess.run(
                [
                    "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                    "-H", f"Authorization: Bearer {self.kimi_key}",
                    "-H", "Content-Type: application/json",
                    "-H", "Accept: application/json",
                    "-d", body_json,
                    "--connect-timeout", "6",
                    "--max-time", str(self.kimi_timeout),
                    url,
                ],
                capture_output=True, text=True, timeout=self.kimi_timeout + 2,
            )
        except Exception as e:
            import time as _kt2
            self._kimi_down_until = _kt2.monotonic() + 300
            raise RuntimeError(f"Kimi (01.ai) connection failed: {type(e).__name__}: {e}")

        if proc.returncode != 0:
            _err = (proc.stderr or "").strip()[:300] or f"curl exit {proc.returncode}"
            # Try parsing partial stdout for auth/rate-limit error details
            _stdout = (proc.stdout or "").strip()
            if _stdout:
                try:
                    _partial = json.loads(_stdout)
                    if isinstance(_partial, dict) and _partial.get("error"):
                        _eno = _partial["error"]
                        if isinstance(_eno, dict):
                            _code = int(_eno.get("code") or 0)
                            _msg = str(_eno.get("message", _stdout[:120]))
                        else:
                            _code = 0
                            _msg = str(_eno)
                        low = _msg.lower()
                        if _code in (401, 403) or "api key" in low or "invalid" in low or "unauthorized" in low:
                            self._kimi_down_until = _kt.monotonic() + 300
                            raise RuntimeError(f"Kimi (01.ai) auth error (HTTP {_code}): {_msg[:200]}")
                        _err = f"{_err} | body: {_msg[:120]}"
                except json.JSONDecodeError:
                    pass
            self._kimi_down_until = _kt.monotonic() + 300
            raise RuntimeError(f"Kimi (01.ai) curl failed: {_err}")

        try:
            data = json.loads(proc.stdout or "{}")
        except Exception:
            raise RuntimeError(f"Kimi (01.ai) returned invalid JSON: {(proc.stdout or '')[:200]}")

        if isinstance(data, dict) and data.get("error"):
            err = data.get("error") or {}
            if isinstance(err, dict):
                code = int(err.get("code") or 0)
                message = str(err.get("message") or "")
            else:
                code = 0
                message = str(err)
            low = message.lower()
            if code in (401, 403) or ("api key" in low and ("invalid" in low or "not valid" in low or "unauthorized" in low)):
                self._kimi_down_until = _kt.monotonic() + 300
                raise RuntimeError(f"Kimi (01.ai) auth error (HTTP {code}): {message[:200]}")
            if code == 429:
                self._kimi_down_until = _kt.monotonic() + 300
                raise RuntimeError(f"Kimi (01.ai) rate-limited (429): {message[:150]}")
            raise RuntimeError(f"Kimi (01.ai) API error (HTTP {code}): {message[:200]}")

        text = ""
        try:
            text = data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError):
            if isinstance(data, dict):
                text = data.get("generated_text") or ""
        text = str(text).strip()
        if not text:
            raise RuntimeError(f"Kimi (01.ai) returned empty response: {str(data)[:200]}")
        return text

    def _generate_text_with_fallback(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None) -> str:
        """Try all configured LLM providers in priority order.

        Order: OpenRouter → NVIDIA NIM → Shanghai AI Lab (Kimi) → Cloudflare/HF.

        OpenRouter is the primary provider (uses curl --ipv4 --insecure for
        HF Spaces compatibility). NVIDIA and Kimi follow, then the three-provider
        Cloudflare/HF cascade.

        Returns the first successful text response. If every provider is
        missing or fails, raises RuntimeError with a per-provider breakdown
        so the caller (and logs) can see exactly what happened.
        """
        import time as _time
        errors: dict = {}

        # 1. OpenRouter (OpenAI-compatible, external provider — primary)
        if self.has_openrouter:
            try:
                result = self._openrouter_generate(
                    prompt, temperature=temperature, max_tokens=max_tokens, top_p=top_p
                )
                if result:
                    print("  -> OpenRouter generate OK")
                    return result
            except Exception as e:
                errors["OpenRouter"] = str(e)
                print(f"OpenRouter generate failed: {e}")

        # 2. NVIDIA NIM (OpenAI-compatible, external provider)
        if self.has_nvidia:
            try:
                result = self._nvidia_generate(
                    prompt, temperature=temperature, max_tokens=max_tokens, top_p=top_p
                )
                if result:
                    print("  -> NVIDIA NIM generate OK")
                    return result
            except Exception as e:
                errors["NVIDIA"] = str(e)
                print(f"NVIDIA NIM generate failed: {e}")

        # 3. Shanghai AI Laboratory (01.ai / Kimi) — OpenAI-compatible
        if self.has_kimi:
            try:
                result = self._kimi_generate(
                    prompt, temperature=temperature, max_tokens=max_tokens, top_p=top_p
                )
                if result:
                    print("  -> Kimi (01.ai) generate OK")
                    return result
            except Exception as e:
                errors["Kimi"] = str(e)
                print(f"Kimi (01.ai) generate failed: {e}")

        # 4. Cloudflare Workers AI / HF (internally chains CF → HF as fallback)
        try:
            result = self._cloudflare_generate(
                prompt, temperature=temperature, max_tokens=max_tokens, top_p=top_p
            )
            if result:
                print("  -> Cloudflare/HF generate OK")
                return result
        except Exception as e:
            errors["Cloudflare"] = str(e)

        # Build a detailed, per-provider error message.
        parts = []
        if not self.has_openrouter:
            parts.append("OpenRouter: không cấu hình")
        elif errors.get("OpenRouter"):
            parts.append(f"OpenRouter: {errors['OpenRouter'][:150]}")
        if not self.has_nvidia:
            parts.append("NVIDIA: không cấu hình")
        elif errors.get("NVIDIA"):
            parts.append(f"NVIDIA: {errors['NVIDIA'][:150]}")
        if not self.has_kimi:
            parts.append("Kimi(01.ai): không cấu hình")
        elif errors.get("Kimi"):
            parts.append(f"Kimi(01.ai): {errors['Kimi'][:150]}")
        parts.append(
            f"Cloudflare/HF: {errors.get('Cloudflare', 'lỗi không xác định')[:150]}"
        )

        raise RuntimeError("Không thể sinh nội dung. " + "; ".join(parts))

    def generate_embedding(self, text: str, timeout_override: float = None) -> list:
        """Sinh embedding vector qua OpenRouter embedding endpoint.

        Yêu cầu: OPENROUTER_API_KEY + OPENROUTER_EMBEDDING_MODEL được cấu hình.
        Trả về list[float]. Nếu không cấu hình hoặc gọi thất bại, ném RuntimeError
        để caller dùng fallback khác (Gemini/HF embedding).

        Uses curl (OpenSSL TLS) for HF Spaces compatibility — same pattern as
        _openrouter_generate and the embedding providers in vector_store.py.
        """
        if not self.has_openrouter_embed:
            raise RuntimeError("OPENROUTER_API_KEY + OPENROUTER_EMBEDDING_MODEL not set — cannot use OpenRouter embedding.")
        import time as _time_ext
        if _time_ext.monotonic() < self._openrouter_down_until:
            raise RuntimeError("OpenRouter embeddings temporarily disabled after a network failure (circuit breaker).")

        url = f"{self.openrouter_base}/embeddings"
        payload = json.dumps({
            "model": self.openrouter_embed_model,
            "input": text,
        }).encode("utf-8")
        _emb_timeout = timeout_override or self.openrouter_timeout

        try:
            proc = subprocess.run(
                [
                    "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                    "-H", f"Authorization: Bearer {self.openrouter_key}",
                    "-H", "Content-Type: application/json",
                    "-H", "Accept: application/json",
                    "-H", "HTTP-Referer: https://edumap.ai",
                    "-H", "X-Title: EduMap",
                    "-d", payload,
                    "--connect-timeout", "4",
                    "--max-time", str(_emb_timeout),
                    url,
                ],
                capture_output=True, text=True, timeout=_emb_timeout + 2,
            )
        except Exception as e:
            self._openrouter_down_until = _time_ext.monotonic() + 300
            raise RuntimeError(f"OpenRouter embedding connection failed: {type(e).__name__}: {e}")

        if proc.returncode != 0:
            err = (proc.stderr or "").strip()[:200] or f"curl exit {proc.returncode}"
            # curl can exit non-zero (e.g. timeout code 28) while still having
            # received a partial response body — try to parse it so a 401/429
            # auth error body is surfaced instead of a generic "curl exit 28".
            _stdout = (proc.stdout or "").strip()
            if _stdout:
                try:
                    _partial = json.loads(_stdout)
                    if isinstance(_partial, dict) and _partial.get("error"):
                        _eno = _partial["error"]
                        if isinstance(_eno, dict):
                            _code = int(_eno.get("code") or 0)
                            _msg = str(_eno.get("message", _stdout[:120]))
                            low = _msg.lower()
                            if _code in (401, 403) or "api key" in low or "invalid" in low or "unauthorized" in low:
                                self._openrouter_down_until = _time_ext.monotonic() + 300
                                raise RuntimeError(f"OpenRouter embedding auth error (HTTP {_code}): {_msg[:200]}")
                            err = f"{err} | body: {_msg[:120]}"
                except json.JSONDecodeError:
                    pass
            self._openrouter_down_until = _time_ext.monotonic() + 300
            raise RuntimeError(f"OpenRouter embedding connection failed: {err}")

        try:
            data = json.loads(proc.stdout or "{}")
        except Exception:
            raise RuntimeError(f"OpenRouter embedding invalid JSON: {(proc.stdout or '')[:200]}")

        if isinstance(data, dict) and data.get("error"):
            err = data.get("error") or {}
            if isinstance(err, dict):
                code = int(err.get("code") or 0)
                message = str(err.get("message") or "")
            else:
                code = 0
                message = str(err)
            low = message.lower()
            if code in (401, 403) or "api key" in low or "invalid" in low or "unauthorized" in low:
                self._openrouter_down_until = _time_ext.monotonic() + 300
                raise RuntimeError(f"OpenRouter embedding auth error (HTTP {code}): {message[:200]}")
            if code == 429:
                raise RuntimeError(f"OpenRouter embedding rate-limited (429): {message[:150]}")
            raise RuntimeError(f"OpenRouter embedding HTTP {code}: {message[:200]}")

        try:
            embedding = data["data"][0]["embedding"]
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f"OpenRouter embedding returned unexpected format: {str(data)[:200]}")
        if not isinstance(embedding, list) or not embedding:
            raise RuntimeError(f"OpenRouter embedding returned empty vector: {str(data)[:200]}")
        return [float(x) for x in embedding]

    # --- Methods from Legacy LLMService ---

    async def chat_with_rag(self, message: str, history: list = None, context: dict = None) -> dict:
        """
        Phương thức Chat RAG nâng cao với cơ chế chống ảo giác (Anti-Hallucination).
        Kết hợp dữ liệu từ ChromaDB, hệ thống và Cloudflare Workers AI.
        """
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY (primary), NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

        # Kiểm tra Cache
        cache_key = hashlib.md5(f"chat:{message}:{json.dumps(history or [])}:{json.dumps(context or {})}".encode()).hexdigest()
        cached_res = cache_service.get(cache_key)
        if cached_res:
            return cached_res

        history = history or []
        context = context or {}

# 1. RAG Logic: Truy xuất dữ liệu từ ChromaDB
        from services.vector_store import vector_store
        try:
            # ChromaDB + embeddings are synchronous (subprocess/urllib), so run
            # them off the event loop. RAG_TIMEOUT_SECONDS is a hard ceiling:
            # a dead embedding provider must never delay the first token past
            # the NestJS 10s stream timeout. On timeout we answer LLM-only.
            _rag_timeout = float(os.getenv("RAG_TIMEOUT_SECONDS", "8"))
            search_results = await asyncio.wait_for(
                asyncio.to_thread(
                    vector_store.query, message, n_results=None, hybrid=True
                ),
                timeout=_rag_timeout,
            )
            documents = search_results.get('documents', [[]])
            metadatas = search_results.get('metadatas', [[]])
            ids = search_results.get('ids', [[]])
            
            context_docs = documents[0] if documents and len(documents) > 0 else []
            meta_docs = metadatas[0] if metadatas and len(metadatas) > 0 else []
            id_docs = ids[0] if ids and len(ids) > 0 else []
            
            sources = []
            docs_str = ""
            if context_docs:
                for i, doc in enumerate(context_docs):
                    meta = meta_docs[i] if i < len(meta_docs) else {}
                    title = meta.get("title", f"Tài liệu tham khảo {i+1}")
                    doc_id = id_docs[i] if i < len(id_docs) else str(i)
                    # Keep the prompt bounded: very large RAG documents make
                    # Gemini slower and can push it past the curl timeout on
                    # HF Spaces, which then falls back to a template reply.
                    doc_text = doc if len(doc) <= 1200 else doc[:1200] + "..."
                    docs_str += f"\n--- Tài liệu {i+1} ({title}) ---\n{doc_text}\n"
                    
                    sources.append({
                        "doc_id": doc_id,
                        "title": title,
                        "snippet": doc[:200] + "..." if len(doc) > 200 else doc
                    })
            else:
                docs_str = "Không tìm thấy dữ liệu liên quan trong hệ thống kiến thức của EduMap."
        except Exception as e:
            print(f"Error querying vector store: {e}")
            # Graceful degradation: if embedding/RAG fails (all providers down),
            # let the LLM answer from its own knowledge + conversation history
            # instead of injecting an error string that the bot echoes back.
            docs_str = "Dữ liệu từ kho tri thức chưa sẵn sàng. Tôi sẽ trả lời dựa trên kiến thức chung."
            sources = []

        # 2. Ngữ cảnh hệ thống (Dynamic Context)
        system_context_str = ""
        if context:
            system_context_str = "\nNGỮ CẢNH HỆ THỐNG THỜI GIAN THỰC:\n"
            for key, value in context.items():
                system_context_str += f"- {key}: {value}\n"

        # 3. Prompt Engineering: Thiết lập "Luật" cho AI
        system_instruction = f"""
        Bạn là Trợ lý ảo thông minh của EduMap DNTU (Trường Đại học Công nghệ Đồng Nai).
        
        DỮ LIỆU TỪ HỆ THỐNG RAG (Sự thật):
        {docs_str}
        {system_context_str}
        
        NGUYÊN TẮC HOẠT ĐỘNG (CORE RULES):
        1. ZERO HALLUCINATION: TUYỆT ĐỐI KHÔNG tự bịa ra thông tin không có trong phần DỮ LIỆU TỪ HỆ THỐNG RAG và NGỮ CẢNH HỆ THỐNG.
        2. Nếu câu hỏi không liên quan đến dữ liệu hệ thống, trả lời dựa trên kiến thuật chung nhưng phải khẳng định là thông tin tham khảo.
        3. Tư vấn nhiệt tình, chuyên nghiệp, sử dụng ngôn ngữ thân thiện với sinh viên.
        4. Trình bày rõ ràng, sử dụng bullet points nếu cần thiết.
        """

        # Format history (lấy 6 tin nhắn gần nhất)
        history_str = ""
        for msg in history[-6:]:
            role = "Sinh viên" if msg.get("role") == "user" else "Trợ lý"
            history_str += f"{role}: {msg.get('content')}\n"

        prompt = f"{system_instruction}\n\nLỊCH SỬ TRÒ CHUYỆN:\n{history_str}\nSinh viên: {message}\nTrợ lý EduMap:"

        # Ưu tiên OpenRouter (provider chính), sau đó NVIDIA / Cloudflare / HF.
        # Gemini đã được loại bỏ vì API key không còn hoạt động trên HF Spaces.
        reply_text = None
        last_err = None
        for gen_fn in [
            self._openrouter_generate if self.has_openrouter else None,
            self._nvidia_generate if self.has_nvidia else None,
            self._cloudflare_generate if self.has_cf else None,
            self._hf_generate if self.has_hf else None,
        ]:
            if gen_fn is None:
                continue
            try:
                # Provider helpers use blocking subprocess/urllib calls. Run
                # them in a worker thread so the event loop stays responsive.
                response = await asyncio.to_thread(
                    gen_fn, prompt, max_tokens=2048, temperature=0.3, top_p=0.8
                )
                if response:
                    reply_text = response.strip()
                    break
            except Exception as e:
                last_err = str(e)
                print(f"Chat gen {gen_fn.__name__} failed: {e}")
                continue

        if not reply_text:
            print(f"AI Generation Error: {last_err or 'no provider available'} — using template fallback")
            reply_text = self._chat_fallback_reply(message, sources, context)

        final_res = {"reply": reply_text, "sources": sources}
        cache_service.set(cache_key, final_res, ttl=3600)
        return final_res

    async def chat_with_rag_stream(self, message: str, history: list = None, context: dict = None):
        """True streaming RAG chat — yields SSE-formatted data strings.

        1. Lấy sources từ ChromaDB (giống chat_with_rag).
        2. Build prompt the same way.
        3. Gọi _openrouter_generate_stream để nhận từng token real-time.
        4. Nếu OpenRouter không khả dụng, fallback sang non-streaming và
           yield toàn bộ response dưới dạng một chunk.

        Yield format: SSE data lines (``data: {json}\\n\\n``)
        - Metadata chunk (with sources) sent first
        - Token chunks
        - Done chunk
        """
        from services.vector_store import vector_store

        # ---- 1. RAG retrieval (shared with chat_with_rag) ----
        cache_key = hashlib.md5(f"chat_stream:{message}:{json.dumps(history or [])}:{json.dumps(context or {})}".encode()).hexdigest()
        cached_res = cache_service.get(cache_key)
        if cached_res:
            # Stream the cached reply word-by-word so the user still sees
            # a typing effect on cache hits (not a single block dump).
            async for chunk in self._stream_word_by_word(
                cached_res.get('reply', ''), sources=cached_res.get('sources', []), is_final=True
            ):
                yield chunk
            return

        history = history or []
        context = context or {}
        sources = []
        docs_str = ""

        # Immediate heartbeat (empty source list) so the HTTP response starts
        # flowing before the embedding/RAG step. On HF Spaces the provider
        # chain can take several seconds; without this, a proxy/client timeout
        # could close the stream before the first token and leave the chat
        # bubble empty. A later meta chunk overwrites sources with the real list.
        yield f"data: {json.dumps({'sources': [], 'meta': True, 'heartbeat': True})}\n\n"

        try:
            _rag_timeout = float(os.getenv("RAG_TIMEOUT_SECONDS", "8"))
            search_results = await asyncio.wait_for(
                asyncio.to_thread(
                    vector_store.query, message, n_results=None, hybrid=True
                ),
                timeout=_rag_timeout,
            )
            documents = search_results.get('documents', [[]])
            metadatas = search_results.get('metadatas', [[]])
            ids = search_results.get('ids', [[]])

            context_docs = documents[0] if documents and len(documents) > 0 else []
            meta_docs = metadatas[0] if metadatas and len(metadatas) > 0 else []
            id_docs = ids[0] if ids and len(ids) > 0 else []

            if context_docs:
                for i, doc in enumerate(context_docs):
                    meta = meta_docs[i] if i < len(meta_docs) else {}
                    title = meta.get("title", f"Tài liệu tham khảo {i+1}")
                    doc_id = id_docs[i] if i < len(id_docs) else str(i)
                    doc_text = doc if len(doc) <= 1200 else doc[:1200] + "..."
                    docs_str += f"\n--- Tài liệu {i+1} ({title}) ---\n{doc_text}\n"
                    sources.append({"doc_id": doc_id, "title": title, "snippet": doc[:200] + "..." if len(doc) > 200 else doc})
            else:
                docs_str = "Không tìm thấy dữ liệu liên quan trong hệ thống kiến thức của EduMap."
        except Exception as e:
            print(f"Error querying vector store (stream): {e}")
            docs_str = "Dữ liệu từ kho tri thức chưa sẵn sàng. Tôi sẽ trả lời dựa trên kiến thức chung."
            sources = []

        # ---- 2. Build prompt (same as chat_with_rag) ----
        system_context_str = ""
        if context:
            system_context_str = "\nNGỮ CẢNH HỆ THỐNG THỜI GIAN THỰC:\n"
            for key, value in context.items():
                system_context_str += f"- {key}: {value}\n"

        system_instruction = f"""
        Bạn là Trợ lý ảo thông minh của EduMap DNTU (Trường Đại học Công nghệ Đồng Nai).
        
        DỮ LIỆU TỪ HỆ THỐNG RAG (Sự thật):
        {docs_str}
        {system_context_str}
        
        NGUYÊN TẮC HOẠT ĐỘNG (CORE RULES):
        1. ZERO HALLUCINATION: TUYỆT ĐỐI KHÔNG tự bịa ra thông tin không có trong phần DỮ LIỆU TỪ HỆ THỐNG RAG và NGỮ CẢNH HỆ THỐNG.
        2. Nếu câu hỏi không liên quan đến dữ liệu hệ thống, trả lời dựa trên kiến thuật chung nhưng phải khẳng định là thông tin tham khảo.
        3. Tư vấn nhiệt tình, chuyên nghiệp, sử dụng ngôn ngữ thân thiện với sinh viên.
        4. Trình bày rõ ràng, sử dụng bullet points nếu cần thiết.
        """

        history_str = ""
        for msg in history[-6:]:
            role = "Sinh viên" if msg.get("role") == "user" else "Trợ lý"
            history_str += f"{role}: {msg.get('content', '')}\n"

        prompt = f"{system_instruction}\n\nLỊCH SỬ TRÒ CHUYỆN:\n{history_str}\nSinh viên: {message}\nTrợ lý EduMap:"

        # ---- 3. Send metadata (sources) first ----
        yield f"data: {json.dumps({'sources': sources, 'meta': True})}\n\n"

        # ---- 4. Try true streaming via OpenRouter ----
        if self.has_openrouter:
            try:
                full_reply = ""
                for token in self._openrouter_generate_stream(
                    prompt, max_tokens=2048, temperature=0.3, top_p=0.8
                ):
                    full_reply += token
                    yield f"data: {json.dumps({'token': token, 'is_final': False})}\n\n"
                # Only return if streaming produced actual content. If the
                # generator yielded zero tokens (e.g. curl returned 200 with an
                # empty body, or OpenRouter returned no choices), fall through
                # to the non-streaming fallback so the user still gets a reply
                # instead of an empty/null response.
                if full_reply:
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    # Cache for future identical requests — store the full reply text
                    # so cache hits replay the complete streamed response.
                    cache_service.set(cache_key, {"reply": full_reply, "sources": sources}, ttl=3600)
                    return
                else:
                    print("OpenRouter streaming returned empty reply, falling back to non-streaming")
            except Exception as e:
                print(f"OpenRouter streaming failed, falling back to non-stream: {e}")

        # ---- 5. Fallback: non-streaming (yield word-by-word for typing effect) ----
        reply_text = None
        last_err = None
        for gen_fn in [
            self._openrouter_generate if self.has_openrouter else None,
            self._nvidia_generate if self.has_nvidia else None,
            self._cloudflare_generate if self.has_cf else None,
            self._hf_generate if self.has_hf else None,
        ]:
            if gen_fn is None:
                continue
            try:
                response = await asyncio.to_thread(gen_fn, prompt, max_tokens=2048, temperature=0.3, top_p=0.8)
                if response:
                    reply_text = response.strip()
                    break
            except Exception as e:
                last_err = str(e)
                continue

        if not reply_text:
            reply_text = self._chat_fallback_reply(message, sources, context)

        # Stream word-by-word so the UI shows a typing effect even when
        # real SSE streaming from OpenRouter is unavailable.
        async for chunk in self._stream_word_by_word(reply_text, sources=sources, is_final=True):
            yield chunk
        cache_service.set(cache_key, {"reply": reply_text, "sources": sources}, ttl=3600)

    async def _stream_word_by_word(self, text: str, sources: list = None,
                                   is_final: bool = False, delay: float = 0.03):
        """Yield a pre-computed reply as individual SSE chunks with a typing delay.

        Used when true streaming (OpenRouter SSE) is unavailable — the entire
        reply is already in-memory, but we break it into word-level chunks so
        the frontend still shows a *typing effect* (chữ chạy) instead of dumping
        the whole answer at once.

        Parameters
        ----------
        text : str
            The full reply to stream.
        sources : list
            Source documents to send in the metadata chunk.
        is_final : bool
            If True, the last word chunk also carries ``is_final`` and ``done``.
        delay : float
            Seconds to sleep between word chunks (default 30 ms → ~readable but
            not painfully slow; tuned for 1 vCPU HF Spaces).
        """
        import asyncio

        # Send metadata (sources) first — mirrors the real-streaming path
        yield f"data: {json.dumps({'sources': sources or [], 'meta': True})}\n\n"

        # Split on word boundaries, keeping the separators (spaces, newlines)
        import re
        words = re.split(r'( +|\n+)', text)
        words = [w for w in words if w]  # filter empty strings

        for i, word in enumerate(words):
            yield f"data: {json.dumps({'token': word, 'is_final': False})}\n\n"
            await asyncio.sleep(delay)

        if is_final:
            yield f"data: {json.dumps({'done': True})}\n\n"

    def _chat_fallback_reply(self, message: str, sources: list, context: dict) -> str:
        """Fallback trả lời khi tất cả LLM provider đều thất bại (OpenRouter/Gemini/CF/HF unreachable từ HF Spaces).
        Dựa trên dữ liệu RAG đã lấy được + context hệ thống để trả lời không cần LLM."""
        ctx = context or {}
        available_books = ctx.get("available_books", []) if isinstance(ctx.get("available_books"), list) else []
        educational_locations = ctx.get("educational_locations", []) if isinstance(ctx.get("educational_locations"), list) else []

        parts = []
        parts.append("Xin chào! Tôi là Trợ lý ảo của EduMap DNTU. Hiện tại dịch vụ AI đang bảo trì nên tôi sẽ hỗ trợ dựa trên dữ liệu hệ thống:")
        parts.append("")
        parts.append(f"**Câu hỏi của bạn:** {message}")
        parts.append("")
        if sources:
            parts.append("Dựa trên tài liệu tham khảo trong hệ thống:")
            for i, src in enumerate(sources, 1):
                title = src.get("title", f"Tài liệu {i}")
                snippet = src.get("snippet", "")
                if snippet and snippet.endswith("..."):
                    snippet = snippet[:-3]
                parts.append(f"  {i}. **{title}**: {snippet}")
            parts.append("")
        if available_books:
            parts.append(f"Sách liệu liên quan: {', '.join(str(b) for b in available_books[:5])}")
        if educational_locations:
            parts.append(f"Địa điểm giáo dục gần bạn: {educational_locations[0]}")
        parts.append("")
        parts.append("Lưu ý: Đây là trả lời tự động dựa trên dữ liệu hệ thống. Để nhận tư vấn chi tiết và cá nhân hóa từ AI thực sự, vui lòng quay lại sau khi dịch vụ AI hoạt động trở lại.")
        return "\n".join(parts)

    async def chat_response(self, message: str, history: list = None, context: dict = None):
        """Wrapper để tương thích với các module cũ."""
        res = await self.chat_with_rag(message, history, context)
        return res.get("reply")

    async def generate_career_advice(self, user_info: dict):
        """Generate AI career advice. Falls back to a template response when all providers are down."""
        prompt = f"Tư vấn lộ trình học tập dựa trên kỹ năng: {user_info.get('skills')}"
        try:
            if not self.is_ready:
                raise RuntimeError("AI Service chưa sẵn sàng.")
            response = await asyncio.to_thread(self._generate_text_with_fallback, prompt, temperature=0.3)
            return response
        except Exception as e:
            print(f"Error in generate_career_advice: {e}")
            return f"Thông tin kỹ năng: {user_info.get('skills', '')}. "                    f"Để nhận tư vấn chi tiết từ AI, vui lòng cấu hình OPENROUTER_API_KEY (primary), "                    f"NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, hoặc HF_TOKEN. "                    f"Lỗi: {str(e)[:140]}"

    async def analyze_market_trends(self, market_data: list):
        """Phân tích xu hướng thị trường việc làm — LUÔN trả về kết quả thành công.

        Primary:  Adzuna API (dữ liệu việc làm thật, nếu có ADZUNA_APP_ID/KEY).
        Fallback: SQLite edumap.db (jobs, career_paths — luôn có sẵn trên Space).
        Không bao giờ gọi LLM — hoạt động ngay cả khi Cloudflare & HF bị chặn TLS.
        """
        # Extract keywords from market_data (list of dicts or strings)
        keywords = []
        for item in market_data or []:
            if isinstance(item, dict):
                kw = item.get("keyword") or item.get("what") or item.get("query")
                if kw:
                    keywords.append(str(kw))
            elif isinstance(item, str):
                keywords.append(item)
        keyword = (keywords[0] if keywords else "AI")

        # --- Primary: Adzuna API (real-time job data) ---
        # Both helpers do blocking HTTP/SQLite work; keep the event loop free.
        job_data = None
        if self.has_adzuna:
            job_data = await asyncio.to_thread(self._fetch_adzuna_jobs, keyword)

        # --- Fallback: local SQLite edumap.db ---
        if job_data is None:
            job_data = await asyncio.to_thread(self._get_local_trends, keyword)

        # --- Build analysis via template (no LLM needed) ---
        analysis = self._generate_trends_analysis(keyword, job_data)
        return {"status": "ok", "analysis": analysis}

    def _fetch_adzuna_jobs(self, keyword: str):
        """Fetch live job listings from Adzuna API via curl (--ipv4 --insecure).

        Uses curl with --ipv4 --insecure to bypass the Python ssl/urllib IPv6
        blackhole that causes hangs/timeouts on HF Spaces — the exact same
        pattern used by the OpenRouter, Cloudflare, HF and NVIDIA providers.
        Returns list of dicts or None on failure (falls back to local SQLite).
        """
        try:
            url = (
                f"https://api.adzuna.com/v1/api/jobs/"
                f"{self.adzuna_country}/search/1?"
                f"app_id={self.adzuna_app_id}&app_key={self.adzuna_app_key}"
                f"&results_per_page=10&what={urllib.parse.quote(keyword)}"
            )
            # Use curl (OpenSSL TLS) — bypasses Python ssl/urllib IPv6 blackhole
            # on HF Spaces. --ipv4 forces IPv4 (avoids the IPv6 blackhole that
            # makes urllib.request.urlopen hang/timeout), --insecure skips the
            # cert check (HF Spaces may sit behind a MITM proxy with a custom CA).
            proc = subprocess.run(
                [
                    "curl", "--ipv4", "--insecure", "-sS", "-X", "GET",
                    "-H", "User-Agent: EduMap-AI/1.0",
                    "-H", "Accept: application/json",
                    "--connect-timeout", "6",
                    "--max-time", "15",
                    url,
                ],
                capture_output=True, text=True, timeout=20,
            )
            if proc.returncode != 0:
                err = (proc.stderr or "").strip()[:300] or f"curl exit {proc.returncode}"
                raise RuntimeError(f"Adzuna curl failed: {err}")
            if not (proc.stdout or "").strip():
                raise RuntimeError("Adzuna curl returned empty response (stdout empty)")
            data = json.loads(proc.stdout)
            results = data.get("results", [])
            print(f"  Adzuna API: fetched {len(results)} jobs for '{keyword}'")
            return [
                {
                    "title": r.get("title", ""),
                    "company": (r.get("company") or {}).get("display_name", ""),
                    "location": (r.get("location") or {}).get("display_name", ""),
                    "category": (r.get("category") or {}).get("label", ""),
                    "salary": r.get("salary_min") or r.get("salary_max") or "N/A",
                }
                for r in results
            ]
        except Exception as e:
            print(f"  Adzuna API failed ({type(e).__name__}): {e} — falling back to local SQLite")
            return None

    def _get_local_trends(self, keyword: str) -> list:
        """Query local SQLite edumap.db (jobs + career_paths) — guaranteed to work."""
        try:
            conn = sqlite3.connect(self.sqlite_path, timeout=5)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            results = []
            cur.execute(
                "SELECT title, company_name, location, job_type, salary_range, required_skills "
                "FROM jobs WHERE status = 'active' LIMIT 10"
            )
            for row in cur.fetchall():
                skills_raw = row["required_skills"] or "[]"
                try:
                    skills = json.loads(skills_raw) if isinstance(skills_raw, str) else skills_raw
                except Exception:
                    skills = [str(skills_raw)]
                results.append({
                    "title": row["title"], "company": row["company_name"],
                    "location": row["location"], "category": row["job_type"],
                    "salary": row["salary_range"], "skills": skills,
                })
            cur.execute("SELECT title, field, description FROM career_paths LIMIT 10")
            for row in cur.fetchall():
                results.append({
                    "title": row["title"], "company": row["field"], "location": "",
                    "category": "career_path", "salary": "", "skills": "",
                    "description": row["description"],
                })
            conn.close()
            print(f"  Local SQLite: fetched {len(results)} records for '{keyword}'")
            return results
        except Exception as e:
            print(f"  Local SQLite query failed: {e}")
            return []

    def _generate_trends_analysis(self, keyword: str, market_data: list) -> str:
        """Build a template-based market trends report from structured data (no LLM)."""
        from collections import Counter

        if not market_data:
            return (
                f"Phân tích xu hướng thị trường việc làm '{keyword}':\n"
                f"- Hiện tại không có dữ liệu thị trường khả dụng.\n"
                f"- Khuyến nghị: Cấu hình ADZUNA_APP_ID + ADZUNA_APP_KEY để kết nối API Adzuna, "
                f"hoặc thêm dữ liệu vào bảng jobs trong edumap.db."
            )

        skills = []
        for d in market_data:
            s = d.get("skills", "")
            if isinstance(s, list):
                skills.extend(s)
            elif s:
                skills.append(s)
        top_skills = Counter(skills).most_common(5)
        top_cats = Counter(d.get("category", "") for d in market_data if d.get("category")).most_common(5)
        top_locs = Counter(d.get("location", "") for d in market_data if d.get("location")).most_common(3)

        lines = [
            f"📊 BÁO CÁO XU HƯỚNG THỊ TRƯỜNG — '{keyword}'",
            "",
            f"🔍 Tổng quan: Phân tích dựa trên {len(market_data)} mẫu tin thị trường việc làm.",
            "",
            "📌 Kỹ năng nổi bật:",
        ]
        for sk, cnt in top_skills:
            lines.append(f"  • {sk}: {cnt} lần xuất hiện")
        if not top_skills:
            lines.append("  • Chưa có dữ liệu kỹ năng chi tiết.")
        lines.append("")
        lines.append("📌 Phân khúc ngành/nghề:")
        for cat, cnt in top_cats:
            lines.append(f"  • {cat}: {cnt} vị trí")
        lines.append("")
        lines.append("📌 Khu vực tập trung:")
        for loc, cnt in top_locs:
            lines.append(f"  • {loc}: {cnt} vị trí")
        lines.append("")
        lines.append("📌 Dự báo: Thị trường việc làm liên quan đến "
                      f"'{keyword}' đang phát triển mạnh, đặc biệt trong "
                      "lĩnh vực công nghệ thông tin và kỹ năng số. Các "
                      "doanh nghiệp tại TP. HCM, Hà Nội và Đồng Nai đang tìm "
                      "kiếm ứng viên với kết hợp kỹ năng kỹ thuật + mềm. "
                      f"Người học nên tập trung phát triển lộ trình học tập "
                      f"liên quan đến '{keyword}' để đáp ứng nhu cầu thị trường.")
        return "\n".join(lines)

    async def generate_daily_insight(self, dashboard_data: dict) -> dict:
        if not self.is_ready:
            return self._daily_insight_fallback(dashboard_data or {})
        
        dashboard_data = dashboard_data or {}
        prompt = f"Dựa trên dữ liệu dashboard: {json.dumps(dashboard_data)}, hãy đưa ra 1 lời khuyên ngắn gọn."
        # Ưu tiên OpenRouter (provider chính), sau đó NVIDIA NIM / Cloudflare / HF.
        # Gemini đã bị loại bỏ khỏi chain text generation (chỉ còn dùng cho embeddings).
        if self.has_openrouter:
            try:
                response = await asyncio.to_thread(self._openrouter_generate, prompt)
                return {"insight": response}
            except Exception as e:
                print(f"OpenRouter daily_insight failed: {e}")
        if self.has_nvidia:
            try:
                response = await asyncio.to_thread(self._nvidia_generate, prompt)
                return {"insight": response}
            except Exception as e:
                print(f"NVIDIA NIM daily_insight failed: {e}")
        if self.has_cf:
            try:
                response = await asyncio.to_thread(self._cloudflare_generate, prompt)
                return {"insight": response}
            except Exception as e:
                print(f"Cloudflare daily_insight failed: {e}")
        if self.has_hf:
            try:
                response = await asyncio.to_thread(self._hf_generate, prompt)
                return {"insight": response}
            except Exception as e:
                print(f"HF daily_insight failed: {e}")
        return self._daily_insight_fallback(dashboard_data)

    def _daily_insight_fallback(self, dashboard_data: dict) -> dict:
        """Sinh insight mẫu từ dữ liệu dashboard, không cần gọi LLM."""
        stats = (dashboard_data or {}).get("stats", {}) or {}
        learning = stats.get("learning_materials", 0)
        skills = stats.get("skills_mastered", 0)
        community = stats.get("community_contributions", 0)
        certs = stats.get("certificates_earned", 0)
        upcoming = (dashboard_data or {}).get("upcoming_mentoring", []) or []

        parts = []
        if learning:
            parts.append(f"Bạn đã tích lũy {learning} tài liệu học liệu.")
        if skills:
            parts.append(f"Đã ch conquistar {skills} kỹ năng.")
        if certs:
            parts.append(f"Có {certs} chứng chỉ đã đạt.")
        if upcoming:
            parts.append(f"Có {len(upcoming)} lịch mentoring sắp tới.")

        if not parts:
            message = "Hãy bắt đầu bằng cách lưu tài liệu hoặc đăng ký sự kiện trên EduMap."
            action = "Khám phá thư viện hoặc bản đồ địa điểm học tập gần bạn."
        else:
            message = " ".join(parts) + " Hãy duy trì thói quen học tập thường xuyên."
            action = "Xem lại mục Hoạt động của tôi để theo dõi tiến độ."

        return {
            "motivation_message": message,
            "suggested_action": action,
        }

    # --- Methods from New LLMService ---

    def _extract_json(self, text: str):
        """
        Bóc tách JSON (Mảng hoặc Đối tượng) từ văn bản trả về của AI một cách an toàn bằng Regex.
        Hỗ trợ loại bỏ các ký tự thừa, markdown blocks.
        """
        if not text:
            return None
            
        try:
            import json
            import re
            
            # 1. Thử bóc tách khối markdown ```json ... ```
            json_match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
            if json_match:
                try:
                    return json.loads(json_match.group(1).strip())
                except:
                    pass
            
            # 2. Thử tìm khối { ... } hoặc [ ... ] lớn nhất
            text_cleaned = text.strip()
            
            # Tìm vị trí của dấu ngoặc đầu tiên và cuối cùng
            start_obj = text_cleaned.find('{')
            start_arr = text_cleaned.find('[')
            
            start = -1
            if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
                start = start_obj
                end = text_cleaned.rfind('}') + 1
            elif start_arr != -1:
                start = start_arr
                end = text_cleaned.rfind(']') + 1
            
            if start != -1:
                candidate = text_cleaned[start:end]
                # Fix các lỗi JSON phổ biến như dấu phẩy thừa
                candidate = re.sub(r',\s*([\]}])', r'\1', candidate)
                return json.loads(candidate)
                
            return None
        except Exception as e:
            print(f"Error extracting JSON: {e}")
            return None

    async def recommend_career(self, data: CareerAnalysisRequest) -> list:
        """Recommend careers. Falls back to a template list when all providers are down."""
        try:
            # Kiểm tra Cache
            cache_key = hashlib.md5(f"career:{hashlib.md5(data.json().encode()).hexdigest()}".encode()).hexdigest()
            cached_res = cache_service.get(cache_key)
            if cached_res:
                return cached_res

            if not self.is_ready:
                raise RuntimeError("AI Service chưa sẵn sàng.")

            prompt = f"""
            Phân tích hồ sơ sinh viên: {data.json()}
            Đề xuất 3 nghề nghiệp phù hợp nhất tại Việt Nam.
            Đối với mỗi nghề nghiệp, cung cấp điểm đánh giá (0-100) cho biểu đồ Radar trên 5 tiêu chí:
            - Technical (Kỹ thuật)
            - Soft Skills (Kỹ năng mềm)
            - Problem Solving (Giải quyết vấn đề)
            - Language (Ngoại ngữ)
            - Creativity (Sáng tạo)
            
            Trả về mảng JSON gồm: title, match_score, explanation, missing_skills, radar_chart: {{criteria: score}}
            Chỉ trả về JSON.
            """
            response = await asyncio.to_thread(self._generate_text_with_fallback, prompt, temperature=0.3, max_tokens=1024, top_p=0.8)
            result = self._extract_json(response)

            if result and isinstance(result, list):
                cache_service.set(cache_key, result, ttl=86400)

            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho recommend_career.")
            return result
        except Exception as e:
            print(f"Error in recommend_career: {e}")
            return self._recommend_career_fallback(data, str(e))

    async def recommend_career_semantic(self, skills: List[str], interests: List[str] = None,
                                         experience_level: str = "beginner", user_id: str = None) -> list:
        """Semantic-vector career recommendation via ChromaDB.

        Thay thế if-else keyword matching trong career.service.ts bằng cosine-similarity
        search trong ChromaDB. Flow:
          1. Kết hợp skills + interests thành query text → embed → tìm top-N career paths
             trong ChromaDB (các career_paths đã được seed bởi seed_vector_db.py).
          2. Nếu LLM khả dụng, dùng LLM enrich mỗi kết quả với explanation + radar_chart.
          3. Nếu LLM không khả dụng, dùng semantic results trực tiếp (graceful degradation).

        Luôn trả về danh sách có cấu trúc: title, match_score, explanation, missing_skills,
        radar_chart — khớp với backend career suggestCareer() output format.
        """
        interests = interests or []
        from services.vector_store import vector_store

        # 1. Semantic search in ChromaDB
        all_input = list(skills) + list(interests)
        semantic_results = await asyncio.to_thread(
            vector_store.semantic_career_search, all_input, 5
        ) if vector_store else []

        # Cache key based on skill set
        cache_key = hashlib.md5(f"career_semantic:{hashlib.md5(','.join(sorted(all_input)).encode()).hexdigest()}".encode()).hexdigest()
        cached = cache_service.get(cache_key)
        if cached and isinstance(cached, list):
            return cached

        if not semantic_results:
            # Fallback: use template recommendations
            return self._recommend_career_fallback(
                type("Req", (), {"skills": all_input, "full_name": "", "mbti_type": None,
                                  "career_aspirations": interests, "recent_keywords": None,
                                  "holland_code": None, "user_id": user_id or "unknown",
                                  "json": lambda self: json.dumps({"skills": self.skills,
                                                                   "career_aspirations": self.career_aspirations})})(),
                "No semantic results from ChromaDB"
            )

        # 2. Enrich with LLM if available, or use semantic results directly
        enriched = []
        if self.is_ready:
            enrichment_prompt = f"""
            Bạn là chuyên gia tư vấn nghề nghiệp. Dưới đây là {len(semantic_results)} gợi ý nghề nghiệp từ semantic search:
            {json.dumps(semantic_results, ensure_ascii=False)}

            Hồ sơ sinh viên:
            - Kỹ năng: {', '.join(skills) if skills else 'Chưa có'}
            - Sở thích: {', '.join(interests) if interests else 'Chưa có'}
            - Trình độ: {experience_level}

            Hãy tạo explanation ngắn gọn (1-2 câu) cho mỗi nghề nghiệp và thêm radar_chart cho 5 tiêu chí:
            Technical, Soft Skills, Problem Solving, Language, Creativity.
            Chỉ trả về JSON: [{title, match_score, explanation, missing_skills, radar_chart: {{criteria: score}}}]
            Giữ nguyên match_score từ semantic results. Chỉ trả về JSON, không giải thích thêm.
            """
            try:
                response = await asyncio.to_thread(
                    self._generate_text_with_fallback, enrichment_prompt,
                    temperature=0.3, max_tokens=2048, top_p=0.8
                )
                result = self._extract_json(response)
                if result and isinstance(result, list) and len(result) > 0:
                    enriched = result
            except Exception as e:
                print(f"Semantic career enrichment failed: {e}")

        # 3. If enrichment failed, build from semantic results directly
        if not enriched:
            for item in semantic_results:
                missing = item.get('missing_skills', [])
                enriched.append({
                    "title": item.get('title', ''),
                    "match_score": item.get('match_score', 0),
                    "explanation": f"Phù hợp với {len(item.get('matched_skills', []))} kỹ năng đã có. "
                                   f"Lĩnh vực: {item.get('field', 'Không xác định')}. "
                                   f"Bạn cần bổ sung: {', '.join(missing[:3]) if missing else 'không có'}."
                                   if missing else
                                   f"Phù hợp với {len(item.get('matched_skills', []))} kỹ năng. "
                                   f"Lĩnh vực: {item.get('field', 'Không xác định')}.",
                    "missing_skills": missing,
                    "demand_level": "Cao",
                    "radar_chart": {
                        "Technical": item.get('match_score', 70),
                        "Soft Skills": 70,
                        "Problem Solving": 70,
                        "Language": 65,
                        "Creativity": 72,
                    },
                })

        if enriched:
            cache_service.set(cache_key, enriched, ttl=86400)

        return enriched

    async def generate_learning_path(self, data: LearningPathRequest) -> dict:
        """
        Tạo lộ trình học tập cá nhân hóa dựa trên trình độ và mục tiêu nghề nghiệp.
        Khi mọi provider AI đều thất bại, trả về lộ trình mẫu thay thế.
        """
        try:
            # Kiểm tra Cache
            cache_key = hashlib.md5(f"path:{data.user_id}:{data.target_role}:{data.current_level}".encode()).hexdigest()
            cached_res = cache_service.get(cache_key)
            if cached_res:
                return cached_res

            if not self.is_ready:
                raise RuntimeError("AI Service chưa sẵn sàng.")

            prompt = f"""
            Xây dựng lộ trình học tập chi tiết cho sinh viên:
            - Mục tiêu: {data.target_role}
            - Trình độ hiện tại: {data.current_level}
            - Thời gian cam kết: {data.time_commitment_hours_per_week} giờ/tuần
            
            Yêu cầu:
            1. Phân rã thành các bước (steps) cụ thể.
            2. Mỗi bước bao gồm: step_number, title, estimated_weeks, description (tiếng Việt).
            3. Tính toán total_estimated_months dựa trên tổng số tuần.
            4. Trả về định dạng JSON: {{target_role, total_estimated_months, steps: []}}
            
            Chỉ trả về JSON.
            """
            response = await asyncio.to_thread(self._generate_text_with_fallback, prompt, temperature=0.3, max_tokens=2048, top_p=0.8)
            result = self._extract_json(response)

            if result:
                cache_service.set(cache_key, result, ttl=86400)

            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho generate_learning_path.")
            return result
        except Exception as e:
            print(f"Error in generate_learning_path: {e}")
            return self._learning_path_fallback(data, str(e))

    async def analyze_geo_density(self, data: GeoDensityAnalysisRequest, hubs: list = None) -> dict:
        """Analyze education density. Falls back to a template analysis when all providers are down."""
        hubs = hubs or []
        try:
            if not self.is_ready:
                raise RuntimeError("AI Service chưa sẵn sàng.")
            prompt = f"""
            Phân tích mật độ giáo dục tại {data.city}.
            Các cụm giáo dục (Hubs) được phát hiện: {json.dumps(hubs)}.
            Tổng số điểm: {len(data.points)}.
            
            Hãy đưa ra:
            1. Nhận xét về sự phân bổ.
            2. Đánh giá mức độ thuận tiện cho sinh viên.
            3. Đề xuất khu vực cần đầu tư thêm.
            
            Trả về JSON: {{summary, density_score, recommendations: []}}
            """
            response = await asyncio.to_thread(self._generate_text_with_fallback, prompt, temperature=0.3, max_tokens=1024, top_p=0.8)
            result = self._extract_json(response)
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho analyze_geo_density.")
            return result
        except Exception as e:
            print(f"Error in analyze_geo_density: {e}")
            return self._geo_analysis_fallback(data, hubs, str(e))

    async def summarize_material(self, data: MaterialSummaryRequest) -> dict:
        """Summarize learning material. Falls back to a template summary when all providers are down."""
        try:
            if not self.is_ready:
                raise RuntimeError("AI Service chưa sẵn sàng.")
            prompt = f"Tóm tắt tài liệu: {data.title}. Trả về JSON: {{summary, key_concepts: []}}"
            response = await asyncio.to_thread(self._generate_text_with_fallback, prompt, temperature=0.3, max_tokens=512)
            result = self._extract_json(response)
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho summarize_material.")
            return result
        except Exception as e:
            print(f"Error in summarize_material: {e}")
            return self._summarize_material_fallback(data, str(e))

    async def explain_learning_space_recommendation(self, spot: dict, preferences: dict) -> dict:
        """Generate a human-readable explanation of why a learning spot was
        recommended, given its attributes and the user's search preferences.

        Caches results for 24h (TTL=86400s) keyed on spot_id + a hash of the
        preferences, so repeated requests for the same spot don't re-hit the LLM.
        Falls back to a static template when all providers are down.
        """
        try:
            # ── Cache lookup (24h) ──────────────────────────────────────
            cache_key = hashlib.md5(
                f"ls_explain:{spot.get('id', '')}:{hashlib.md5(json.dumps(preferences, sort_keys=True, default=str).encode()).hexdigest()}"
                .encode()
            ).hexdigest()
            cached = cache_service.get(cache_key)
            if cached and isinstance(cached, dict) and cached.get("explanation"):
                return cached

            if not self.is_ready:
                raise RuntimeError("AI Service chưa sẵn sàng.")

            # ── Build a concise, Vietnamese prompt ───────────────────────
            spot_name = spot.get("name", "địa điểm")
            spot_type = spot.get("type", "")
            rating = spot.get("rating_avg", 0)
            quietness = spot.get("quietness", "")
            has_wifi = spot.get("has_wifi", False)
            amenities = spot.get("amenities", [])
            distance = spot.get("distance_km", "?")
            open_now = spot.get("open_now", False)
            criteria = spot.get("matching_criteria", {})

            def _fmt(v, scale: float = 1):
                try:
                    return round(float(v) * scale, 1)
                except (TypeError, ValueError):
                    return "không rõ"

            prompt = (
                f"Giải thích ngắn gọn (1-2 câu, tiếng Việt) tại sao địa điểm "
                f"'{spot_name}' (loại: {spot_type}) được đề xuất cho người dùng "
                f"đang tìm nơi học gần đây. Thông tin: cách {distance} km, "
                f"đánh giá {rating}/5, yên tĩnh {quietness}/5, wifi: "
                f"{'có' if has_wifi else 'không'}, tiện ích: "
                f"{', '.join(amenities) if amenities else 'không rõ'}, "
                f"đang mở: {'có' if open_now else 'không'}. "
                f"Điểm số tiêu chí: khoảng cách {_fmt(criteria.get('distance'))}, "
                f"đánh giá {_fmt(criteria.get('rating'))}, wifi {_fmt(criteria.get('wifi'))}, "
                f"yên tĩnh {_fmt(criteria.get('quietness'))}, mở cửa {_fmt(criteria.get('open_now'))}. "
                f"Người dùng ưu tiên: {json.dumps(preferences, default=str, ensure_ascii=False)}. "
                f"Trả về JSON: {{explanation: \"...\"}}"
            )

            response = await asyncio.to_thread(
                self._generate_text_with_fallback, prompt,
                temperature=0.4, max_tokens=300,
            )
            result = self._extract_json(response)
            if result is None or not result.get("explanation"):
                raise RuntimeError("AI trả về JSON không hợp lệ cho learning_space_explain.")

            out = {
                "explanation": str(result["explanation"]),
                "degraded": False,
                "reason": None,
            }
            cache_service.set(cache_key, out, ttl=86400)
            return out
        except Exception as e:
            print(f"Error in explain_learning_space_recommendation: {e}")
            return self._explain_learning_space_fallback(spot, preferences, str(e))

    def _explain_learning_space_fallback(self, spot: dict, preferences: dict, err: str = "") -> dict:
        """Template-based explanation when all LLM providers are down."""
        name = spot.get("name", "địa điệm")
        rating = spot.get("rating_avg", 0)
        quietness = spot.get("quietness", "")
        has_wifi = spot.get("has_wifi", False)
        distance = spot.get("distance_km", "?")
        criteria = spot.get("matching_criteria", {}) or {}

        reasons = []
        if criteria.get("distance", 0) >= 0.7:
            reasons.append(f"gần bạn ({distance} km)")
        if criteria.get("rating", 0) >= 0.7:
            reasons.append(f"đánh giá cao ({rating}/5)")
        if criteria.get("quietness", 0) >= 0.7:
            reasons.append(f"không gian yên tĩnh (độ yên tĩnh {quietness}/5)")
        if has_wifi:
            reasons.append("có Wi-Fi")
        if criteria.get("open_now", 0) >= 0.7:
            reasons.append("hiện đang mở cửa")
        if not reasons:
            reasons.append("phù hợp với tiêu chí tìm kiếm của bạn")

        explanation = (
            f"{name} được đề xuất vì: {', '.join(reasons)}. "
            f"(Giải thích tự động khi AI không khả dụng.)"
        )
        return {
            "explanation": explanation,
            "degraded": True,
            "_degraded": True,
            "reason": f"AI unavailable -- template fallback ({err[:150]})",
        }

    async def match_mentors(self, data: "MatchRequest") -> list:
        """Match mentors for a student. Falls back to an empty list when all providers are down.

        Safety-net cap: ngay cả khi backend đã pre-filter, chúng ta vẫn giới hạn
        số mentor trong prompt bằng ``data.max_mentors`` (mặc định 15) để đảm bảo
        không có trường hợp nào gây tràn token khi số lượng mentor rất lớn.
        """
        try:
            if not self.is_ready:
                raise RuntimeError("AI Service chưa sẵn sàng.")

            # Safety-net: cắt bớt mentor xuống max_mentors (backend đã pre-filter,
            # nhưng bảo vệ trường hợp backend quên hoặc gửi từ nguồn khác).
            max_mentors = getattr(data, "max_mentors", 15)
            mentors = data.available_mentors[:max_mentors] if data.available_mentors else []

            # Serialize chỉ các mentor đã được cắt + pre-filter metadata
            mentors_json = json.dumps(
                [m.model_dump(mode="json") for m in mentors],
                ensure_ascii=False,
            )

            student_specialty = getattr(data, "student_specialty", None)
            student_region = getattr(data, "student_region", None)

            pre_filter_info = ""
            if student_specialty or student_region:
                parts = []
                if student_specialty:
                    parts.append(f"Chuyên ngành: {student_specialty}")
                if student_region:
                    parts.append(f"Khu vực: {student_region}")
                pre_filter_info = f" (Đã lọc trước theo: {', '.join(parts)})"

            prompt = f"""Ghép nối mentor cho sinh viên{pre_filter_info}

Sinh viên:
- Kỹ năng cần: {json.dumps(data.student_skills_needed, ensure_ascii=False)}
- MBTI: {data.student_mbti}
- Ngày rảnh: {json.dumps(data.preferred_days, ensure_ascii=False)}

Danh sách mentor đã được pre-filter (tối đa {max_mentors}):
{mentors_json}

Trả về mảng JSON: [{{mentor_id, name, match_score, match_reasons: []}}]"""

            response = await asyncio.to_thread(self._generate_text_with_fallback, prompt, temperature=0.3, max_tokens=1024, top_p=0.8)
            result = self._extract_json(response)
            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho match_mentors.")
            return result
        except Exception as e:
            print(f"Error in match_mentors: {e}")
            return self._match_mentors_fallback(data, str(e))


    async def rank_impact_matches(self, data: "ImpactMatchRequest") -> dict:
        """Rank need↔sponsor pairs by match quality. Falls back gracefully
        when all LLM providers are down.

        Mirrors ``match_mentors``: the backend has already pre-filtered at
        the SQLite layer (cost / location / category, LIMIT 15). We still
        enforce a hard cap via ``max_results`` to guarantee no token overflow.

        Returns a dict (not a list) so the router can detect the ``degraded``
        + ``reason`` flags for graceful-degradation signalling.
        """
        try:
            if not self.is_ready:
                raise RuntimeError(
                    "AI Service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY, "
                    "NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN, GEMINI_API_KEY hoặc HF_TOKEN."
                )

            max_results = getattr(data, "max_results", 15) or 15
            max_results = max(1, min(max_results, 30))
            pairs = (data.pairs or [])[:max_results]

            # Serialize pairs to compact JSON for the LLM prompt
            pairs_json = json.dumps(
                [p.model_dump(mode="json") for p in pairs],
                ensure_ascii=False,
            )

            region = getattr(data, "region", None)
            category = getattr(data, "category", None)
            pre_filter_parts = []
            if region:
                pre_filter_parts.append(f"Khu vực: {region}")
            if category:
                pre_filter_parts.append(f"Danh mục: {category}")
            pre_filter_info = ""
            if pre_filter_parts:
                pre_filter_info = f" (Đã lọc trước: {', '.join(pre_filter_parts)})"

            prompt = f"""Bạn là chuyên gia ghép nối nguồn lực đến nơi cần cho lĩnh vực giáo dục tại Việt Nam.{pre_filter_info}

Nhiệm vụ: Xếp hạng các cặp (nhu cầu ↔ nhà tài trợ) dưới đây theo mức độ phù hợp.
Các yếu tố cần xem xét:
1. **Chi phí**: nhà tài trợ có ngân sách đủ trả cho nhu cầu không? (budget_amount >= cost_estimate)
2. **Lĩnh vực**: nhà tài trợ có focus_areas phù hợp với category/tags của nhu cầu không?
3. **Khu vực**: nhà tài trợ và nhu cầu có cùng khu vực (location) không?
4. **Khẩn cấp**: nhu cầu cấp bậc urgency cao nên được ưu tiên.
5. **Độ tin cậy**: nhà tài trợ is_verified hay không (ưu tiên verified).

Danh sách cặp đã pre-filter (tối đa {max_results}):
{pairs_json}

Trả về **mảng JSON** sau:
[{{need_id, sponsor_id, match_score (0-100), match_reasons: [string], next_steps: [string]}}]

- match_score: số thực 0-100, càng cao càng phù hợp.
- match_reasons: 2-3 lý do ngắn gọn tại sao cặp này phù hợp.
- next_steps: 1-2 bước tiếp theo đề xuất (ví dụ: "Liên hệ sponsor qua email", "Gửi đề xuất chi tiết").
- Sắp xếp theo match_score giảm dần.
- Nếu không có cặp nào phù hợp, trả về mảng rỗng []."""

            response = await asyncio.to_thread(
                self._generate_text_with_fallback,
                prompt,
                temperature=0.3,
                max_tokens=2048,
                top_p=0.8,
            )
            result = self._extract_json(response)
            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho rank_impact_matches.")

            # Normalise: ensure each match has the required keys
            clean = []
            for m in result:
                if isinstance(m, dict):
                    clean.append({
                        "need_id": m.get("need_id", ""),
                        "sponsor_id": m.get("sponsor_id", ""),
                        "match_score": float(m.get("match_score", 0)),
                        "match_reasons": m.get("match_reasons", []) or [],
                        "next_steps": m.get("next_steps", []) or [],
                    })
            return {"ranked_matches": clean, "degraded": False, "reason": None}
        except Exception as e:
            print(f"Error in rank_impact_matches: {e}")
            return self._impact_match_fallback(data, str(e))


    def _impact_match_fallback(self, data: "ImpactMatchRequest", err: str = "") -> dict:
        """Graceful-degradation fallback when all LLM providers are down.

        Returns a dict with an empty ``ranked_matches`` list and
        ``degraded=True`` so the router (and ultimately the frontend) can
        surface a helpful message instead of a 502 that blocks the feature.
        """
        reason = f"AI unavailable -- graceful degradation ({err[:140]})"
        # Build a lightweight template ranking using pure cost-fit heuristic
        # so the user still gets _some_ ordered suggestions even offline.
        pairs = (data.pairs or [])[:15]
        template_matches = []
        for p in pairs:
            budget = float(p.sponsor.budget_amount)
            cost = float(p.need.cost_estimate)
            cost_fit = min(100, (budget / cost * 50) + 50) if cost > 0 else 50
            cat_ok = 1 if getattr(p, "category_match", False) else 0
            score = round(cost_fit * 0.7 + cat_ok * 30, 1)
            template_matches.append({
                "need_id": p.need_id,
                "sponsor_id": p.sponsor_id,
                "match_score": score,
                "match_reasons": [
                    f"Dựa trên phù hợp ngân sách (template): sponsor có ngân sách {budget:,.0f} cho nhu cầu {cost:,.0f}.",
                ],
                "next_steps": ["Liên hệ sponsor qua email/website để thảo luận chi tiết."],
            })
        template_matches.sort(key=lambda x: x["match_score"], reverse=True)
        return {
            "ranked_matches": template_matches,
            "degraded": True,
            "reason": reason,
        }


    # ------------------------------------------------------------------
    #  Template-based graceful-degradation fallbacks
    #  Each returns a valid-shaped dict/list so routers and callers still
    #  get a 200 with degraded content instead of a 503/502 that blocks the
    #  entire feature when every LLM provider is unreachable (the common case
    #  on HF Spaces where Cloudflare TLS is blocked and HF returns 401).
    # ------------------------------------------------------------------

    def _learning_path_fallback(self, data: "LearningPathRequest", err: str = "") -> dict:
        """Template-based learning path when all LLM providers are down."""
        role = getattr(data, "target_role", "AI Developer") or "AI Developer"
        level = getattr(data, "current_level", "Beginner") or "Beginner"
        steps = [
            {
                "step_number": 1,
                "title": f"Nền tảng cho {role}",
                "estimated_weeks": 4,
                "description": f"Bắt đầu với kiến thức cơ bản cần thiết cho vai trò {role} ở trình độ {level}.",
            },
            {
                "step_number": 2,
                "title": "Kỹ năng chuyên ngành",
                "estimated_weeks": 6,
                "description": "Phát triễn kỹ năng kỹ thuật và phần mềm liên quan.",
            },
            {
                "step_number": 3,
                "title": "Dự án thực tế",
                "estimated_weeks": 8,
                "description": "Xây dựng ít nhất một dự án cá nhân hoặc hợp tác để áp dụng kiến thức.",
            },
            {
                "step_number": 4,
                "title": "Phỏng vấn và phỏng trình bày",
                "estimated_weeks": 2,
                "description": " Chuẩn bị hồ sơ và kỹ năng phỏng vấn cho vai trò mục tiêu.",
            },
        ]
        total_months = round(sum(s["estimated_weeks"] for s in steps) / 4.0, 1)
        return {
            "target_role": role,
            "total_estimated_months": total_months,
            "steps": steps,
            "_degraded": True,
            "_reason": f"AI unavailable -- template fallback ({err[:140]})",
        }

    def _recommend_career_fallback(self, data: "CareerAnalysisRequest", err: str = "") -> list:
        """Template-based career recommendations when all LLM providers are down."""
        skill = ""
        if hasattr(data, "skills") and data.skills:
            skill = str(data.skills)[:200]
        reason = f"AI unavailable -- template fallback ({err[:140]})"
        return [
            {
                "title": "AI Engineer / Machine Learning Engineer",
                "match_score": 85,
                "explanation": f"Dựa trên hồ sơ kỹ năng ({skill[:80]}), vai trò này có nhu cầu cao trên thị trường.",
                "missing_skills": ["Python", "Machine Learning", "Statistics"],
                "demand_level": "Cao",
                "radar_chart": {"Technical": 85, "Soft Skills": 75, "Problem Solving": 80, "Language": 70, "Creativity": 82},
                "_degraded": True,
                "_reason": reason,
            },
            {
                "title": "Fullstack Developer",
                "match_score": 78,
                "explanation": "Lĩnh vực phát triển web fullstack luôn có nhu cầu ổn định và cơ hội phát triển.",
                "missing_skills": ["TypeScript", "React", "Node.js"],
                "demand_level": "Cao",
                "radar_chart": {"Technical": 78, "Soft Skills": 70, "Problem Solving": 75, "Language": 65, "Creativity": 72},
                "_degraded": True,
                "_reason": reason,
            },
        ]

    def _summarize_material_fallback(self, data: "MaterialSummaryRequest", err: str = "") -> dict:
        """Template-based material summary when all LLM providers are down."""
        title = getattr(data, "title", "tài liệu") or "tài liệu"
        content = getattr(data, "content", "") or ""
        description = getattr(data, "description", "") or ""
        text = (content + " " + description)[:500]
        return {
            "summary": f"Tóm tắt tự động (chế độ ngoại tuyến): Tài liệu '{title}' cung cấp kiến thức cơ bản. Chi tiết: {text[:200]}...",
            "key_concepts": [{"concept": "Cốt lõi chính", "explanation": "Vui lòng đọc tài liệu gốc để biết chi tiết."}],
            "study_tips": ["Đọc toàn bộ tài liệu", "Tạo ghi chú cá nhân", "Thực hành ngay khi học"],
            "_degraded": True,
            "_reason": f"AI unavailable -- template fallback ({err[:140]})",
        }

    def _match_mentors_fallback(self, data: "MatchRequest", err: str = "") -> list:
        """Return an empty list when all LLM providers are down — the caller
        can surface a message telling the user to try again later."""
        return []

    def _geo_analysis_fallback(self, data: "GeoDensityAnalysisRequest", hubs: list, err: str = "") -> dict:
        """Template-based geo analysis when all LLM providers are down.

        ``hubs`` may arrive as a GeoJSON ``FeatureCollection`` (the new shape
        returned by ``identify_education_hubs``) or as a legacy list of dicts.
        Count features robustly in either case.
        """
        city = getattr(data, "city", "khu vực này") or "khu vực này"
        if isinstance(hubs, dict):
            hub_count = len(hubs.get("features", []))
        else:
            hub_count = len(hubs or [])
        point_count = len(getattr(data, "points", []) or [])
        return {
            "summary": f"Phân tích dựa trên dữ liệu thống kê tĩnh cho {city}: {hub_count} cụm giáo dục, {point_count} điểm.",
            "density_score": round(hub_count / max(point_count, 1) * 100, 1) if point_count else 50.0,
            "recommendations": [
                "Xem xét mở thêm cơ sở giáo dục ở khu vực chưa đủ.",
                "Tăng cường kết nối giữa các cụm giáo dục hiện có.",
            ],
            "_degraded": True,
            "_reason": f"AI unavailable -- template fallback ({err[:140]})",
        }

    def _suggestions_fallback(self, err: str = "") -> list:
        """Template-based career suggestions when all LLM providers are down."""
        reason = f"AI unavailable -- template fallback ({err[:140]})"
        return [
            {"title": "AI Engineer", "description": "Phát triển trí tuệ nhân tạo và học máy.", "match_score": 85, "_degraded": True, "_reason": reason},
            {"title": "Fullstack Developer", "description": "Phát triển web front-end và back-end.", "match_score": 78, "_degraded": True, "_reason": reason},
            {"title": "Data Scientist", "description": "Phân tích dữ liệu và khai phá thông tin.", "match_score": 72, "_degraded": True, "_reason": reason},
        ]


    async def moderate_text(self, text: str) -> dict:
        """Moderate user-generated content.

        Uses the full provider cascade (OpenRouter -> NVIDIA -> Cloudflare ->
        HF). When EVERY provider is unavailable at runtime, returns a
        conservative safe result (rather than raising) so the community
        router can keep operating. Content reaching this method has already
        passed the regex Layer-1 pre-filter in ``moderation.py`` which catches
        profanity and PII -- the degraded path simply trusts that pre-filter.
        """
        prompt = f"""
        Bạn là chuyên gia kiểm duyệt nội dung cho nền tảng giáo dục EduMap.
        Hãy phân tích văn bản sau: "{text}"
        
        Các tiêu chí vi phạm:
        1. Ngôn từ thù ghét, thô tục, xúc phạm.
        2. Quảng cáo rác (Spam) không liên quan đến giáo dục.
        3. Các liên kết (links) có dấu hiệu lừa đảm hoặc mã độc.
        4. Nội dung nhạy cảm hoặc không phù hợp với môi trường học đường.
        
        Trả về JSON: {{is_safe: boolean, confidence: float, flags: [string], reason: string}}
        """
        try:
            if not self.is_ready:
                raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY (primary), NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
            response = await asyncio.to_thread(
                self._generate_text_with_fallback, prompt,
                temperature=0.3, max_tokens=512, top_p=0.8,
            )
            result = self._extract_json(response)
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho moderate_text.")
            return result
        except Exception as e:
            print(f"Error in moderate_text: {e}")
            # Graceful degradation: all AI providers unavailable. Content was
            # already pre-filtered by regex Layer 1 (profanity + PII) in the
            # moderation router, so approve with low confidence instead of
            # blocking every community post during an AI outage.
            return {
                "is_safe": True,
                "confidence": 0.3,
                "flags": [],
                "reason": f"AI unavailable -- passed regex pre-filter only ({str(e)[:140]})",
            }

    async def get_suggestions(self) -> list:
        """Generate AI career suggestions. Falls back to template suggestions when all providers are down."""
        try:
            if not self.is_ready:
                raise RuntimeError("AI Service chưa sẵn sàng.")
            prompt = "Generate an array of 3 AI career suggestions. Each suggestion should be a JSON object with fields: title, description, match_score (0-100)."
            response = await asyncio.to_thread(self._generate_text_with_fallback, prompt, temperature=0.3, max_tokens=512)
            result = self._extract_json(response)
            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho get_suggestions.")
            return result
        except Exception as e:
            print(f"Error in get_suggestions: {e}")
            return self._suggestions_fallback(str(e))

    async def match_opportunities(self, data: "OpportunityMatchRequest") -> dict:
        """NLP-powered opportunity matching for the Opportunity Radar (F-16b).

        The backend has ALREADY pre-filtered candidates (status, deadline >
        today, soft-delete, optional type/field keyword) via SQLite — this
        method only needs to:
          1. Extract eligibility criteria (GPA, major, skills, language,
             experience) from each opportunity's free-text description.
          2. Compute a match_score (0-100) and confidence (0-1, threshold 0.6)
             against the user's profile (major, skills, interests, location,
             optional gpa).
          3. Build a per-opportunity document checklist and match reasons.
          4. Filter expired deadlines (defence-in-depth) and sort by score.

        Candidates are processed in batches of <=8 to keep each LLM call within
        the embedding/RAG timeout budget on the free HF Spaces plan.

        On any failure (all providers down, JSON parse error, timeout) the
        method degrades to a pure keyword heuristic
        (``_opportunity_match_fallback``) so the frontend radar always returns
        something usable.
        """
        try:
            profile = getattr(data, "user_profile", None)
            if not profile:
                raise RuntimeError("Missing user_profile in opportunity match request")

            opportunities = getattr(data, "opportunities", None) or []
            if not opportunities:
                return self._empty_match_response(profile)

            if not self.is_ready:
                raise RuntimeError(
                    "AI Service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY (primary), "
                    "NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN, GEMINI_API_KEY hoặc HF_TOKEN."
                )

            # Batch to respect the timeout budget — 8 ops per LLM call.
            BATCH = 8
            user_id = _profile_id(profile)

            all_matches: list = []
            import datetime as _dt
            now_dt = _dt.datetime.now()

            for i in range(0, len(opportunities), BATCH):
                batch = opportunities[i : i + BATCH]
                batch_matches = await asyncio.to_thread(self._match_batch, profile, batch)
                all_matches.extend(batch_matches)

            # Defence-in-depth: filter expired + sort by score (desc)
            live = [
                m for m in all_matches
                if not m.get("deadline") or _safe_date(m["deadline"]) > now_dt
            ]
            live.sort(key=lambda m: m["match_score"], reverse=True)

            return {
                "user_id": user_id,
                "matches": live,
                "total": len(live),
                "filtered_count": len(all_matches) - len(live),
                "degraded": False,
                "reason": None,
            }
        except Exception as e:
            print(f"Error in match_opportunities: {e}")
            profile = getattr(data, "user_profile", None)
            opportunities = getattr(data, "opportunities", None) or []
            return self._opportunity_match_fallback(profile, opportunities, str(e))

    def _match_batch(self, profile: Any, batch: list) -> list:
        """Score a single batch (<=8 candidates) with one LLM prompt.

        Synchronous helper intended to be called from ``asyncio.to_thread``
        so the event loop is not blocked during the HTTP round-trip.
        """
        profile_json = _to_json(profile)
        batch_json = _to_json(batch)

        prompt = f"""Bạn là chuyên gia tư vấn học tập và việc làm tại Việt Nam.
Hãy phân tích hồ sơ người dùng và một danh sách cơ hội (học bổng, thực tập, công việc, cuộc thi...) và trả về điểm số phù hợp.

Hồ sơ người dùng:
{profile_json}

Danh sách cơ hội (đã được lọc trước theo deadline và trạng thái):
{batch_json}

Nhiệm vụ: Với mỗi cơ hộp, hãy:
1. Trích xuất điều kiện (extracted_criteria): required_gpa (số thực hoặc null), required_major (chuỗi hoặc null), required_skills (mảng), required_language (chuỗi hoặc null), required_experience (chuỗi hoặc null), is_team_based (bool hoặc null).
2. Tính match_score (0-100): càng cao càng phù hợp, dựa trên major, skills, interests, location, gpa so với required_*.
3. Tính confidence (0-1): mức độ tự tin của điểm số. >=0.6 là tin cậy.
4. confidence_level: "high" nếu confidence >= 0.6, "medium" 0.4-0.6, "low" < 0.4.
5. is_eligible: true nếu score >= 60 (ngưỡng trước deadline).
6. match_reasons: 2-3 lý do ngắn bằng tiếng Việt.
7. checklist: danh sách tài liệu cần chuẩn bị (tiếng Việt).

LƯU Ý:
- Nếu một cơ hộp đã hết hạn (deadline < hôm nay), loại khỏi kết quả.
- Nếu không đủ thông tin để đánh giá, confidence thấp.
- Chỉ trả về JSON dưới đây, không giải thích thêm.

JSON kết quả:
[{{id, title, organization, type, url, deadline, region, match_score, confidence, confidence_level, is_eligible, extracted_criteria: {{required_gpa, required_major, required_skills, required_language, required_experience, is_team_based}}, match_reasons: [string], checklist: [string]}}]"""

        response = self._generate_text_with_fallback(prompt, temperature=0.3, max_tokens=2048, top_p=0.8)
        result = self._extract_json(response)

        if result is None or not isinstance(result, list):
            raise RuntimeError("AI trả về JSON không hợp lệ cho match_opportunities.")

        clean = []
        for m in result:
            if isinstance(m, dict):
                clean.append({
                    "id": str(m.get("id", "")),
                    "title": m.get("title", ""),
                    "organization": m.get("organization", ""),
                    "type": m.get("type", "other"),
                    "url": m.get("url") or None,
                    "deadline": m.get("deadline") or None,
                    "region": m.get("region", ""),
                    "match_score": max(0, min(100, float(m.get("match_score", 0)))),
                    "confidence": max(0.0, min(1.0, float(m.get("confidence", 0.0)))),
                    "confidence_level": m.get("confidence_level", "low"),
                    "is_eligible": bool(m.get("is_eligible", False)),
                    "extracted_criteria": m.get("extracted_criteria", {}) or {},
                    "match_reasons": m.get("match_reasons", []) or [],
                    "checklist": m.get("checklist", []) or [],
                })
        return clean

    def _opportunity_match_fallback(self, profile: Any, opportunities: list, err: str = "") -> dict:
        """Keyword-based graceful-degradation fallback when all LLM providers are down.

        Runs a simple keyword-overlap match between the user's major, skills
        and interests and each opportunity's text. Every match is tagged
        ``_degraded`` (stripped by the router) and confidence is capped low
        so the frontend shows a "low confidence" badge.
        """
        reason = f"AI unavailable -- template fallback ({err[:140]})"
        import datetime as _dt

        major = ""
        skills: list = []
        interests: list = []
        location = ""

        if isinstance(profile, dict):
            major = profile.get("major", "") or ""
            skills = profile.get("skills", []) or []
            interests = profile.get("interests", []) or []
            location = profile.get("location", "") or ""
        else:
            major = getattr(profile, "major", "") or ""
            skills = list(getattr(profile, "skills", []) or [])
            interests = list(getattr(profile, "interests", []) or [])
            location = getattr(profile, "location", "") or ""

        profile_terms = [major] + list(skills) + list(interests)
        profile_terms = [str(t).lower() for t in profile_terms if t]
        region_lower = str(location).lower()

        now = _dt.datetime.now()
        matches = []
        for opp in opportunities or []:
            opp_dict = opp if isinstance(opp, dict) else _to_dict(opp)
            dl = opp_dict.get("deadline")
            if dl and _safe_date(dl) <= now:
                continue
            text = f"{opp_dict.get('title','')} {opp_dict.get('description','')} "
            text += f"{opp_dict.get('requirements','')} {opp_dict.get('organization','')} "
            text += f"{' '.join(opp_dict.get('field_tags', []) or [])}"
            text_lower = text.lower()

            score = 0
            reasons: list = []
            for term in profile_terms:
                if term and term in text_lower:
                    score += 12
                    if len(reasons) < 4:
                        reasons.append(f"Khớp: {term.capitalize()}")
            if region_lower and (
                opp_dict.get("region", "").lower().find(region_lower) >= 0
                or text_lower.find(region_lower) >= 0
            ):
                score += 15
                if len(reasons) < 4:
                    reasons.append("Khu vực phù hợp")
            score = min(100, score)
            if not reasons:
                reasons = ["Dựa trên từ khóa hồ sơ"]

            matches.append({
                "id": str(opp_dict.get("id", "")),
                "title": opp_dict.get("title", ""),
                "organization": opp_dict.get("organization", ""),
                "type": opp_dict.get("type", "other"),
                "url": opp_dict.get("url") or None,
                "deadline": dl,
                "region": opp_dict.get("region", ""),
                "match_score": score,
                "confidence": 0.3,
                "confidence_level": "low",
                "is_eligible": score >= 40,
                "extracted_criteria": {},
                "match_reasons": reasons,
                "checklist": _build_checklist(opp_dict, text_lower),
                "_degraded": True,
                "_reason": reason,
            })

        matches.sort(key=lambda m: m["match_score"], reverse=True)
        return {
            "user_id": _profile_id(profile),
            "matches": matches,
            "total": len(matches),
            "filtered_count": len(opportunities or []) - len(matches),
            "degraded": True,
            "reason": reason,
        }

    def _empty_match_response(self, profile: Any) -> dict:
        return {
            "user_id": _profile_id(profile),
            "matches": [],
            "total": 0,
            "filtered_count": 0,
            "degraded": False,
            "reason": "Không có cơ hộp nào khả dụng để khớp.",
        }


def _profile_id(profile: Any) -> str:
    if isinstance(profile, dict):
        return profile.get("id", "unknown")
    return getattr(profile, "id", "unknown")


def _to_json(obj: Any) -> str:
    """Serialise Pydantic models / dicts to a compact JSON string."""
    if obj is None:
        return "{}"
    if isinstance(obj, dict):
        return json.dumps(obj, ensure_ascii=False, default=str)
    if hasattr(obj, "model_dump"):
        return json.dumps(obj.model_dump(mode="json"), ensure_ascii=False, default=str)
    if hasattr(obj, "json") and callable(obj.json):
        try:
            return json.dumps(obj.json(), ensure_ascii=False, default=str)
        except Exception:
            pass
    return json.dumps(obj, ensure_ascii=False, default=str)


def _to_dict(obj: Any) -> dict:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    return dict(vars(obj)) if hasattr(obj, "__dict__") else {}


def _safe_date(val: Any):
    """Parse a date string defensively; returns datetime or a minimal sentinel."""
    import datetime as _dt
    if val is None:
        return None
    if isinstance(val, _dt.datetime):
        return val
    if isinstance(val, _dt.date):
        return _dt.datetime.combine(val, _dt.time.min)
    try:
        s = str(val)
        # Normalise ISO-8601 trailing 'Z' and split on timezone offset.
        s = s.replace("Z", "+00:00").split("+")[0].split(".")[0] if "T" in s else s
        return _dt.datetime.fromisoformat(s)
    except Exception:
        return _dt.datetime.min


def _build_checklist(opp: dict, text_lower: str) -> list:
    items = ["Hồ sơ cá nhân / CV"]
    if any(k in text_lower for k in ("điểm", "gpa", "xếp loại")):
        items.append("Bảng điểm (GPA) / Bằng cấp")
    if any(k in text_lower for k in ("tiếng anh", "ielts", "toefl", "ngoại ngữ")):
        items.append("Chứng chỉ ngoại ngữ (IELTS/TOEFL/Tiếng Anh)")
    if any(k in text_lower for k in ("bài luận", "personal statement", "luận văn")):
        items.append("Bài luận cá nhân")
    if any(k in text_lower for k in ("portfolio", "dự án", "project")):
        items.append("Portfolio / dự án")
    if any(k in text_lower for k in ("thư giới thiệu", "recommendation")):
        items.append("Thư giới thiệu")
    if opp.get("type") == "scholarship":
        items.append("Bản sao bằng cấp + Chứng nhận hành vi")
    return items


llm_service = LLMService()
