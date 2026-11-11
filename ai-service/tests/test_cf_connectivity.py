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

# The exact endpoint shape used by the provider chain in production.
_CF_EMBED_URL = (
    "https://api.cloudflare.com/client/v4/accounts/{acc}/ai/run/@cf/baai/bge-base-en-v1.5"
)


@pytest.fixture
def cf_service():
    """Fresh service, configured by env only (no persistent state)."""
    return VectorStoreService()


@pytest.fixture
def llm_service():
    """Fresh LLMService, configured by env only (no persistent state)."""
    return LLMService()


try:
    _CF_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")
    _CF_ACCOUNT = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
except Exception:
    _CF_TOKEN = ""
    _CF_ACCOUNT = ""


def _cf_run(args, timeout=30):
    """curl with the exact flags used by the provider chain (curl --ipv4)."""
    try:
        proc = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc
    except Exception as e:
        return type("Proc", (), {"returncode": 1, "stdout": "", "stderr": str(e)})()


def _cf_endpoint(url, token, account):
    base = "https://api.cloudflare.com/client/v4/accounts/%s/ai/run" % account
    proc = _cf_run(
        [
            "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
            "-H", f"Authorization: Bearer {token}",
            "-H", "Content-Type: application/json",
            "-d", '{"text": "xin chao"}',
            "--connect-timeout", "6",
            "--max-time", "12",
            f"{base}/@cf/baai/bge-base-en-v1.5",
        ]
    )
    return proc


@pytest.mark.skipif(
    not _CF_TOKEN or not _CF_ACCOUNT,
    reason="CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID not configured",
)
def test_cf_endpoint_returns_embedding():
    """The provider chain target (bge-base-en-v1.5) responds 200 + 768-dim vector."""
    proc = _cf_endpoint(None, _CF_TOKEN, _CF_ACCOUNT)
    assert proc.returncode == 0, f"curl exited {proc.returncode}: {proc.stderr[:500]}"
    try:
        data = json.loads(proc.stdout)
    except Exception:
        pytest.fail(f"invalid JSON: {proc.stdout[:200]!r}")
    assert data.get("success") is True, f"cf returned: {proc.stdout[:300]}"
    vec = data["result"]["data"][0]
    assert isinstance(vec, list) and len(vec) == 768


@pytest.mark.skipif(
    not _CF_TOKEN or not _CF_ACCOUNT,
    reason="CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID not configured",
)
def test_cf_embed_models_reachable():
    """All three configured embedding models respond."""
    models = [
        "@cf/baai/bge-base-en-v1.5",
        "@cf/baai/bge-m3",
        "@cf/qwen/qwen3-embedding-0.6b",
    ]
    for model in models:
        proc = _cf_run(
            [
                "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                "-H", f"Authorization: Bearer {os.getenv('CLOUDFLARE_API_TOKEN')}",
                "-H", "Content-Type: application/json",
                "-d", '{"text": "xin chao"}',
                "--connect-timeout", "6",
                "--max-time", "12",
                f"https://api.cloudflare.com/client/v4/accounts/{os.getenv('CLOUDFLARE_ACCOUNT_ID')}/ai/run/{model}",
            ]
        )
        assert proc.returncode == 0, f"{model}: curl exited {proc.returncode}: {proc.stderr[:500]}"
        data = json.loads(proc.stdout)
        assert data.get("success") is True, f"{model}: {proc.stdout[:200]}"
        vec = data["result"]["data"][0]
        assert isinstance(vec, list) and len(vec) > 0


@pytest.mark.skipif(
    not _CF_TOKEN or not _CF_ACCOUNT,
    reason="CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID not configured",
)
def test_cf_text_model_reachable():
    """LLM: @cf/meta/llama-3.1-8b-instruct-fp8 returns text (200 OK)."""
    proc = _cf_run(
        [
            "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
            "-H", f"Authorization: Bearer {os.getenv('CLOUDFLARE_API_TOKEN')}",
            "-H", "Content-Type: application/json",
            "-d", '{"prompt": "hello"}',
            "--connect-timeout", "6",
            "--max-time", "20",
            f"https://api.cloudflare.com/client/v4/accounts/{os.getenv('CLOUDFLARE_ACCOUNT_ID')}/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8",
        ]
    )
    assert proc.returncode == 0, f"curl exited {proc.returncode}: {proc.stderr[:500]}"
    data = json.loads(proc.stdout)
    assert data.get("success") is True
    assert isinstance(data["result"]["response"], str)
    assert len(data["result"]["response"]) > 0


@pytest.mark.skipif(
    not _CF_TOKEN or not _CF_ACCOUNT,
    reason="CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID not configured",
)
def test_vector_store_embedding_preflight(cf_service):
    """get_embedding() prefers Cloudflare and returns a scalar list when
    CLOUDFLARE_API_TOKEN/ACCOUNT_ID are configured (the actual deployed use)."""
    if not cf_service.has_cf_api:
        pytest.skip("cf_service not configured")
    try:
        vec = cf_service.get_embedding("xin chao")
    except RuntimeError as e:
        pytest.fail(f"get_embedding raised: {e}")
    assert isinstance(vec, list) and len(vec) > 0


@pytest.mark.skipif(
    not _CF_TOKEN or not _CF_ACCOUNT,
    reason="CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID not configured",
)
def test_llm_cloudflare_provider_schedule(llm_service):
    """LLMService._cloudflare_generate returns text when CF is configured."""
    if not llm_service.has_cf:
        pytest.skip("llm_service not configured")
    try:
        text = llm_service._cloudflare_generate("hello", temperature=0.7, max_tokens=32)
    except (RuntimeError, OSError) as e:
        pytest.fail(f"_cloudflare_generate raised: {e}")
    assert isinstance(text, str) and len(text) > 0


def test_environment_keys_all_present():
    """Deployment must ship CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID +
    GEMINI_API_KEY before any embedding/request flow can run."""
    for key in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "GEMINI_API_KEY"):
        value = os.getenv(key, "")
        assert value, f"{key} must be configured in the deployment environment"
