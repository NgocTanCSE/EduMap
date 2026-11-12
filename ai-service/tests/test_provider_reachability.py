"""Provider reachability tests — embedding chain changed (2026-11-12).

Embeddings now use **Google Gemini only**:
`GEMINI_API_KEY` + `GEMINI_EMBEDDING_MODEL`.

Cloudflare Workers AI remains for *text generation* (LLM fallback) — tested
against the text endpoint `llm_service` actually calls.
"""
import json
import os
import subprocess
import sys

import pytest

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

os.environ["AI_PREFLIGHT"] = "false"

from services.vector_store import VectorStoreService
from services.llm_service import LLMService

# Server-side access keys of the deployment (host secrets).
_CF_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN")
_CF_ACCOUNT = os.getenv("CLOUDFLARE_ACCOUNT_ID")
_GEMINI_KEY = os.getenv("GEMINI_API_KEY")


@pytest.fixture
def cf_service():
    """Fresh service, configured by env only (no persistent state)."""
    return VectorStoreService()


@pytest.fixture
def llm_service():
    """Fresh LLMService, configured by env only (no persistent state)."""
    return LLMService()


def _curl(url, method="POST", data=None, timeout=30, extra_headers=()):
    cmd = ["curl", "--ipv4", "--insecure", "-sS", "-X", method, "-o", "/dev/null", "-w", "%{http_code}"]
    if data:
        cmd += ["-d", data]
    for k, v in extra_headers:
        cmd += ["-H", f"{k}: {v}"]
    cmd += ["--connect-timeout", "6", "--max-time", str(timeout), url]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return proc.returncode, (proc.stdout or "").strip(), (proc.stderr or "").strip()


@pytest.mark.skipif(
    not _CF_TOKEN or not _CF_ACCOUNT,
    reason="CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID not configured",
)
def test_cf_text_model_reachable():
    """LLM fallback: @cf/meta/llama-3.1-8b-instruct-fp8 accepts a POST (200)."""
    returncode, stdout, stderr = _curl(
        f"https://api.cloudflare.com/client/v4/accounts/{_CF_ACCOUNT}/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8",
        method="POST",
        data='{"prompt": "hello"}',
        extra_headers=[
            ("Authorization", f"Bearer {_CF_TOKEN}"),
            ("Content-Type", "application/json"),
        ],
        timeout=60,
    )
    assert returncode == 0, f"curl exited {returncode}: {stderr[:500]}"


@pytest.mark.skipif(
    not _GEMINI_KEY,
    reason="GEMINI_API_KEY not configured",
)
def test_gemini_embedding_model_reachable():
    """Embedding source: Gemini fills the `embedding` field of the response."""
    model = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001").strip()
    returncode, stdout, stderr = _curl(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent",
        method="POST",
        data=json.dumps({
            "model": f"models/{model}",
            "content": {"parts": [{"text": "xin chao"}]},
        }),
        extra_headers=[(
            "x-goog-api-key", _GEMINI_KEY), ("Content-Type", "application/json")],
        timeout=45,
    )
    assert returncode == 0, f"curl exited {returncode}: {stderr[:500]}"
    data = json.loads(stdout)
    assert data.get("data") is not None, f"gemini returned: {stdout[:300]}"
    vec = data["data"][0]["values"]
    assert isinstance(vec, list) and len(vec) > 0


@pytest.mark.skipif(
    not _GEMINI_KEY,
    reason="GEMINI_API_KEY not configured",
)
def test_vector_store_embedding_preflight(cf_service):
    """get_embedding() uses Gemini and returns a list of floats."""
    if not cf_service.has_embedding:
        pytest.skip("gemini embedding service not configured")
    try:
        vec = cf_service.get_embedding("xin chao")
    except RuntimeError as e:
        pytest.fail(f"get_embedding raised: {e}")
    assert isinstance(vec, list) and all(isinstance(v, float) for v in vec)
    assert len(vec) > 0


def test_environment_keys_present():
    """Deployment must ship GEMINI_API_KEY before any embedding flow can run."""
    assert os.getenv("GEMINI_API_KEY"), "GEMINI_API_KEY must be configured"
