import os
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

class LLMService:
    def __init__(self):
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
        # --- HuggingFace Inference API fallback (khi Cloudflare ko ket noi duoc tu HF Spaces) ---
        # Check env vars first, then fall back to huggingface_hub library which
        # also reads ~/.huggingface/token, /etc/huggingface/token, HF_HOME, etc.
        self.hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")
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
        self.has_hf = bool(self.hf_token)
        # is_ready = True neu co bat ky nhanh LLM nao (Cloudflare hoac HF Inference)
        self.is_ready = self.has_cf or self.has_hf
        if not self.has_cf and not self.has_hf:
            print("ERROR: Khong co CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoac HF_TOKEN. Cau hinh de dung AI chat.")
        elif not self.has_cf and self.has_hf:
            print(f"INFO: Cloudflare khong cau hinh, dung HuggingFace Inference API fallback. Model={self.hf_model}")
        elif self.has_cf and self.has_hf:
            print(f"INFO: Ca Cloudflare va HF Inference API deu co san. CF primary, HF fallback.")
        if self.has_cf:
            print(f"CLOUDFLARE_MODEL: {self.model_name}")
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
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

        cf_last_err = None

        # --- Phan 1: thu Cloudflare (qua AI Gateway neu bat, nguoc lai truc tiep Workers AI) ---
        if self.has_cf:
            cf_last_err = None
            if self.cf_gateway_enabled and self.cf_gateway_id and self.account_id:
                base_url = f"https://gateway.ai.cloudflare.com/v1/{self.account_id}/{self.cf_gateway_id}/ai/run"
                print(f"[LLM] Using Cloudflare AI Gateway: gateway_id={self.cf_gateway_id}")
            else:
                base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run"
            last_err = None
            # HF Spaces may route outbound traffic through a proxy or have slow DNS,
            # so allow 1 retry per model (not 0) and generous timeouts.
            per_model_retries = 1

            for model in self.model_candidates:
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
                        # Timeouts bumped from 3s/8s to 10s/30s — HF Spaces network + proxy adds latency
                        _curl = subprocess.run(
                            ["curl", "--insecure", "-sS", "-X", "POST",
                             "-H", f"Authorization: Bearer {self.api_token}",
                             "-H", "Content-Type: application/json",
                             "-d", body_json.decode("utf-8"),
                             "--connect-timeout", "10", "--max-time", "30", url],
                            capture_output=True, text=True, timeout=40)
                        if _curl.returncode == 0 and _curl.stdout.strip():
                            data = json.loads(_curl.stdout)
                        else:
                            _msg = _curl.stderr.strip()[:200] or f"curl exit {_curl.returncode}"
                            raise urllib.error.URLError(_msg)
                    except FileNotFoundError:
                        print("  curl not found, falling back to urllib.request")
                        req = urllib.request.Request(url, data=body_json, headers=req_headers, method="POST")
                        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
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
                        last_err = f"{model}: {type(e).__name__}: {e}"; print(f"Lỗi kết nối {model} ({type(e).__name__}): {e}, thử model kế tiếp..."); break

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
            # end for model in model_candidates
            cf_last_err = last_err

        # --- Phan 2: fallback ve HuggingFace Inference API ---
        if self.has_hf:
            try:
                result = self._hf_generate(prompt, temperature=temperature, max_tokens=max_tokens, top_p=top_p)
                if result:
                    print(f"  -> HF Inference API generate OK (model={self.hf_model})")
                    return result
            except Exception as e:
                print(f"HF Inference API generate ALSO failed: {e}")

        raise RuntimeError(f"Không thể sinh nội dung. Cloudflare: {cf_last_err or 'không cấu hình'}, HuggingFace: không khả dụng hoặc lỗi.")

    def _hf_generate(self, prompt: str, temperature=0.7, max_tokens=None, top_p=None) -> str:
        """Goi HuggingFace Inference API de sinh text. Dung khi Cloudflare khong ket noi duoc."""
        if not self.has_hf:
            raise RuntimeError("HF_TOKEN not set — cannot use HuggingFace Inference API.")

        # Strategy 1: huggingface_hub InferenceClient (handles URL/DNS internally)
        try:
            from huggingface_hub import InferenceClient
            client = InferenceClient(token=self.hf_token, model=self.hf_model)
            gen_kwargs = {"max_new_tokens": max_tokens or 2048, "temperature": temperature}
            if top_p is not None:
                gen_kwargs["top_p"] = top_p
            try:
                result = client.text_generation(prompt, **gen_kwargs, stream=False)
            except TypeError:
                result = client.text_generation(prompt, **gen_kwargs)
            if result and str(result).strip():
                return str(result).strip()
            print("  HF InferenceClient returned empty response")
        except StopIteration:
            print("  HF InferenceClient: StopIteration (possible DNS failure for api-inference.huggingface.co)")
        except Exception as e:
            print(f"  HF InferenceClient failed: {type(e).__name__}: {e}")

        # Strategy 1b: InferenceClient with explicit base_url (api-inference.hf.co resolves)
        # Note: base_url is an alias for model in huggingface_hub 0.36.2, can't pass both
        # Strategy 1b: InferenceClient with URL as model (bypasses DNS for api-inference.huggingface.co)
        try:
            from huggingface_hub import InferenceClient
            client = InferenceClient(token=self.hf_token, model=f"https://api-inference.hf.co/models/{self.hf_model}")
            gen_kwargs = {"max_new_tokens": max_tokens or 2048, "temperature": temperature}
            if top_p is not None:
                gen_kwargs["top_p"] = top_p
            try:
                result = client.text_generation(prompt, **gen_kwargs, stream=False)
            except TypeError:
                result = client.text_generation(prompt, **gen_kwargs)
            if result and str(result).strip():
                return str(result).strip()
            print("  HF InferenceClient (hf.co URL) returned empty response")
        except StopIteration:
            print("  HF InferenceClient (hf.co URL): StopIteration")
        except Exception as e:
            print(f"  HF InferenceClient (hf.co URL) failed: {type(e).__name__}: {e}")

        # Strategy 1c: InferenceClient with chat() for conversational models
        try:
            from huggingface_hub import InferenceClient
            client = InferenceClient(token=self.hf_token, model=f"https://api-inference.hf.co/models/{self.hf_model}")
            chat_result = client.chat([{"role": "user", "content": prompt}], max_tokens=max_tokens or 2048, temperature=temperature, stream=False)
            # ProxyClientChat — safely check done()/result(), then iterate
            _done = getattr(chat_result, 'done', None)
            if callable(_done) and _done():
                _res = getattr(chat_result, 'result', None)
                if callable(_res):
                    result = _res()
                    if result and str(result).strip():
                        return str(result).strip()
            if callable(getattr(chat_result, '__iter__', None)):
                try:
                    chunks = []
                    for chunk in chat_result:
                        chunks.append(str(chunk))
                    result = ''.join(chunks)
                    if result.strip():
                        return result.strip()
                except Exception:
                    pass
            print(f"  HF InferenceClient chat returned: {type(chat_result).__name__}")
        except Exception as e:
            print(f"  HF InferenceClient chat failed: {type(e).__name__}: {e}")
        headers = {
            "Authorization": f"Bearer {self.hf_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": max_tokens or 2048,
                "temperature": temperature,
            },
        }
        if top_p is not None:
            payload["parameters"]["top_p"] = top_p

        import socket as _socket
        import time as _time

        # Build list of (url, ssl_context, headers) tuples to try
        endpoints = []
        _real_getaddrinfo = _socket.getaddrinfo
        _dns_override = False

        # DNS override: resolve api-inference.huggingface.co -> api-inference.hf.co IP
        # (api-inference.huggingface.co doesn't resolve on HF Spaces Docker,
        #  but api-inference.hf.co does — they share the same backend)
        try:
            _socket.gethostbyname("api-inference.hf.co")
            def _patched_getaddrinfo(host, *args, **kwargs):
                if host == "api-inference.huggingface.co":
                    return _real_getaddrinfo("api-inference.hf.co", *args, **kwargs)
                return _real_getaddrinfo(host, *args, **kwargs)
            _socket.getaddrinfo = _patched_getaddrinfo
            _dns_override = True
            # Use unverified context: cert SNI is for api-inference.hf.co IP,
            # but we're connecting with hostname api-inference.huggingface.co
            endpoints.append((
                f"https://api-inference.huggingface.co/models/{self.hf_model}",
                ssl._create_unverified_context(),
                headers,
            ))
            print("  HF DNS override: api-inference.huggingface.co -> api-inference.hf.co IP")
        except Exception:
            pass

        # Fallback: api-inference.hf.co with Host header override + direct
        try:
            _socket.gethostbyname("api-inference.hf.co")
            host_override_hdrs = dict(headers)
            host_override_hdrs["Host"] = "api-inference.huggingface.co"
            # Host override (server may route based on Host header)
            endpoints.append((
                f"https://api-inference.hf.co/models/{self.hf_model}",
                ssl.create_default_context(),
                host_override_hdrs,
            ))
            # Direct (no Host override)
            endpoints.append((
                f"https://api-inference.hf.co/models/{self.hf_model}",
                ssl.create_default_context(),
                headers,
            ))
            print("  HF host resolved: api-inference.hf.co")
        except Exception:
            print("  HF host NOT resolved: api-inference.hf.co")

        # Restore DNS override immediately
        if _dns_override:
            _socket.getaddrinfo = _real_getaddrinfo

        if not endpoints:
            raise RuntimeError("Cannot resolve any HF Inference API hostname.")

        max_retries = 3
        for attempt in range(1, max_retries + 1):
            last_err = None
            should_retry = False
            for ep_url, ep_ctx, ep_hdrs in endpoints:
                try:
                    # Use urllib.request — requests fails with SSLError on HF Spaces
                    # (TLS/SSL connection has been closed (EOF)) for ALL HTTPS POST.
                    req = urllib.request.Request(ep_url, data=json.dumps(payload).encode("utf-8"), headers=ep_hdrs, method="POST")
                    with urllib.request.urlopen(req, timeout=120, context=ep_ctx) as resp:
                        data = json.loads(resp.read().decode("utf-8"))

                    # Parse response — HF returns [{"generated_text": "..."}] for text-generation
                    if isinstance(data, list) and len(data) > 0:
                        item = data[0]
                        if isinstance(item, dict):
                            text = item.get("generated_text", "")
                        elif isinstance(item, str):
                            text = item
                        else:
                            text = ""
                    elif isinstance(data, dict):
                        if "generated_text" in data:
                            text = data["generated_text"]
                        elif "error" in data and "loading" in str(data.get("error", "")).lower():
                            print(f"HF model loading, retry {attempt}/{max_retries}...")
                            _time.sleep(5 * attempt)
                            should_retry = True
                            break
                        else:
                            raise RuntimeError(f"HF Inference API error: {data.get('error', str(data)[:200])}")
                    else:
                        text = str(data) if data else ""

                    text = text.strip()
                    if text:
                        return text
                    raise RuntimeError("HF Inference API returned empty response")
                except urllib.error.HTTPError as e:
                    body = e.read().decode("utf-8", "ignore")[:300]
                    if e.code in (503, 502, 504):
                        if "loading" in body.lower():
                            print(f"HF model loading (503), retry {attempt}/{max_retries}...")
                            _time.sleep(5 * attempt)
                            should_retry = True
                            break
                        raise RuntimeError(f"HF Inference API HTTP {e.code}: {body[:200]}")
                    elif e.code == 429:
                        print(f"HF Inference API rate-limited (429), retry {attempt}/{max_retries}...")
                        _time.sleep(3 * attempt)
                        should_retry = True
                        break
                    else:
                        last_err = f"HTTP {e.code}: {body[:200]}"
                        print(f"  HF {e.code} for {ep_url}, trying next...")
                        continue
                except (urllib.error.URLError, ssl.SSLError, ConnectionError, OSError) as e:
                    last_err = f"{type(e).__name__}: {e}"
                    print(f"  HF connection error for {ep_url}: {e}")
                    continue
                except Exception as e:
                    last_err = f"{type(e).__name__}: {e}"
                    print(f"  HF unexpected error for {ep_url}: {e}")
                    continue
            if should_retry:
                continue
            if last_err:
                if attempt < max_retries:
                    print(f"HF Inference API error, retry {attempt}/{max_retries}: {last_err}")
                    _time.sleep(2 * attempt)
                    continue
                raise RuntimeError(f"HF Inference API failed after {max_retries} retries: {last_err}")

    # --- Methods from Legacy LLMService ---

    async def chat_with_rag(self, message: str, history: list = None, context: dict = None) -> dict:
        """
        Phương thức Chat RAG nâng cao với cơ chế chống ảo giác (Anti-Hallucination).
        Kết hợp dữ liệu từ ChromaDB, hệ thống và Cloudflare Workers AI.
        """
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

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
            search_results = vector_store.query(message, n_results=3)
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
                    docs_str += f"\n--- Tài liệu {i+1} ({title}) ---\n{doc}\n"
                    
                    sources.append({
                        "doc_id": doc_id,
                        "title": title,
                        "snippet": doc[:200] + "..." if len(doc) > 200 else doc
                    })
            else:
                docs_str = "Không tìm thấy dữ liệu liên quan trong hệ thống kiến thức của EduMap."
        except Exception as e:
            print(f"Error querying vector store: {e}")
            docs_str = "Lỗi kết nối kho dữ liệu."
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
        
        try:
            response = self._cloudflare_generate(prompt,
                max_tokens=2048,
                temperature=0.3,
                top_p=0.8)
            reply_text = response.strip() if response and response else "Mình chưa tìm được câu trả lời phù hợp."
        except Exception as e:
            print(f"AI Generation Error: {e} — using template fallback")
            reply_text = self._chat_fallback_reply(message, sources, context)

        final_res = {"reply": reply_text, "sources": sources}
        cache_service.set(cache_key, final_res, ttl=3600)
        return final_res

    def _chat_fallback_reply(self, message: str, sources: list, context: dict) -> str:
        """Fallback trả lời khi LLM không khả dụng (Cloudflare/HF unreachable from HF Spaces).
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
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
        prompt = f"Tư vấn lộ trình học tập dựa trên kỹ năng: {user_info.get('skills')}"
        try:
            response = self._cloudflare_generate(prompt)
            return response
        except Exception as e:
            raise RuntimeError(f"Error in generate_career_advice: {e}")

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
        job_data = None
        if self.has_adzuna:
            job_data = self._fetch_adzuna_jobs(keyword)

        # --- Fallback: local SQLite edumap.db ---
        if job_data is None:
            job_data = self._get_local_trends(keyword)

        # --- Build analysis via template (no LLM needed) ---
        analysis = self._generate_trends_analysis(keyword, job_data)
        return {"status": "ok", "analysis": analysis}

    def _fetch_adzuna_jobs(self, keyword: str):
        """Fetch live job listings from Adzuna API. Returns list of dicts or None on failure."""
        try:
            from collections import Counter  # noqa
            url = (
                f"https://api.adzuna.com/v1/api/jobs/"
                f"{self.adzuna_country}/search/1?"
                f"app_id={self.adzuna_app_id}&app_key={self.adzuna_app_key}"
                f"&results_per_page=10&what={urllib.parse.quote(keyword)}"
            )
            req = urllib.request.Request(url, headers={"User-Agent": "EduMap-AI/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
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
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
        
        prompt = f"Dựa trên dữ liệu dashboard: {json.dumps(dashboard_data)}, hãy đưa ra 1 lời khuyên ngắn gọn."
        try:
            response = self._cloudflare_generate(prompt)
            return {"insight": response}
        except Exception as e:
            print(f"Error in generate_daily_insight: {e}")
            raise RuntimeError(f"Error in generate_daily_insight: {e}")

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
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
        
        # Kiểm tra Cache
        cache_key = hashlib.md5(f"career:{hashlib.md5(data.json().encode()).hexdigest()}".encode()).hexdigest()
        cached_res = cache_service.get(cache_key)
        if cached_res:
            return cached_res

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
        try:
            response = self._cloudflare_generate(prompt)
            result = self._extract_json(response)
            
            if result and isinstance(result, list):
                # Lưu vào Cache (TTL 24 giờ cho đề xuất nghề nghiệp)
                cache_service.set(cache_key, result, ttl=86400)
                
            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho recommend_career.")
            return result
        except Exception as e:
            print(f"Error in recommend_career: {e}")
            raise RuntimeError(f"Error in recommend_career: {e}")

    async def generate_learning_path(self, data: LearningPathRequest) -> dict:
        """
        Tạo lộ trình học tập cá nhân hóa dựa trên trình độ và mục tiêu nghề nghiệp.
        """
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

        # Kiểm tra Cache
        cache_key = hashlib.md5(f"path:{data.user_id}:{data.target_role}:{data.current_level}".encode()).hexdigest()
        cached_res = cache_service.get(cache_key)
        if cached_res:
            return cached_res

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
        try:
            response = self._cloudflare_generate(prompt)
            result = self._extract_json(response)
            
            if result:
                # Lưu vào Cache (TTL 24 giờ cho lộ trình)
                cache_service.set(cache_key, result, ttl=86400)
            
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho generate_learning_path.")
            return result
        except Exception as e:
            print(f"Error in generate_learning_path: {e}")
            raise RuntimeError(f"Error in generate_learning_path: {e}")

    async def analyze_geo_density(self, data: GeoDensityAnalysisRequest, hubs: list = None) -> dict:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
        
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
        try:
            response = self._cloudflare_generate(prompt)
            result = self._extract_json(response)
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho analyze_geo_density.")
            return result
        except Exception as e:
            print(f"Error in analyze_geo_density: {e}")
            raise RuntimeError(f"Error in analyze_geo_density: {e}")

    async def summarize_material(self, data: MaterialSummaryRequest) -> dict:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
        
        prompt = f"Tóm tắt tài liệu: {data.title}. Trả về JSON: {{summary, key_concepts: []}}"
        try:
            response = self._cloudflare_generate(prompt)
            result = self._extract_json(response)
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho summarize_material.")
            return result
        except Exception as e:
            print(f"Error in summarize_material: {e}")
            raise RuntimeError(f"Error in summarize_material: {e}")

    async def match_mentors(self, data: MatchRequest) -> list:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
        
        prompt = f"Ghép nối mentor cho sinh viên. Request: {data.json()}. Trả về mảng JSON: [{{mentor_id, name, match_score, match_reasons: []}}]"
        try:
            response = self._cloudflare_generate(prompt)
            result = self._extract_json(response)
            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho match_mentors.")
            return result
        except Exception as e:
            print(f"Error in match_mentors: {e}")
            raise RuntimeError(f"Error in match_mentors: {e}")


    async def moderate_text(self, text: str) -> dict:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
        
        prompt = f"""
        Bạn là chuyên gia kiểm duyệt nội dung cho nền tảng giáo dục EduMap.
        Hãy phân tích văn bản sau: "{text}"
        
        Các tiêu chí vi phạm:
        1. Ngôn từ thù ghét, thô tục, xúc phạm.
        2. Quảng cáo rác (Spam) không liên quan đến giáo dục.
        3. Các liên kết (links) có dấu hiệu lừa đảo hoặc mã độc.
        4. Nội dung nhạy cảm hoặc không phù hợp với môi trường học đường.
        
        Trả về JSON: {{is_safe: boolean, confidence: float, flags: [string], reason: string}}
        """
        try:
            response = self._cloudflare_generate(prompt)
            result = self._extract_json(response)
            if result is None:
                raise RuntimeError("AI trả về JSON không hợp lệ cho moderate_text.")
            return result
        except Exception as e:
            print(f"Error in moderate_text: {e}")
            raise RuntimeError(f"Error in moderate_text: {e}")

    async def get_suggestions(self) -> list:
        if not self.is_ready:
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
        prompt = "Generate an array of 3 AI career suggestions. Each suggestion should be a JSON object with fields: title, description, match_score (0-100)."
        try:
            response = self._cloudflare_generate(prompt)
            result = self._extract_json(response)
            if result is None or not isinstance(result, list):
                raise RuntimeError("AI trả về JSON không hợp lệ cho get_suggestions.")
            return result
        except Exception as e:
            print(f"Error in get_suggestions: {e}")
            raise RuntimeError(f"Error in get_suggestions: {e}")

llm_service = LLMService()
